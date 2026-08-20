import type Phaser from 'phaser'

import {
  ACTOR_ANIMATIONS,
  ACTOR_ATLAS,
  BOSS_VISUAL,
  ENEMY_VISUAL,
  PLAYER_VISUAL,
  getBossAnimation,
  getEnemyVisualState,
  type ActorAnimationDefinition,
  type BossVisualId,
  type BossVisualState,
  type EnemyVisualAction,
  type EnemyVisualKind,
  type EnemyVisualState,
  type PlayerVisualState,
} from './visual-manifest'

export type ActorPlayResult =
  | 'started'
  | 'already-current'
  | 'latched'
  | 'queued'
  | 'blocked'
  | 'terminal'
  | 'destroyed'

export type ActorPlayOptions = Readonly<{
  onComplete?: () => void
}>

export interface ActorVisualController<State extends string> {
  play(state: State, options?: ActorPlayOptions): ActorPlayResult
  current(): State | null
  isLocked(): boolean
  pause(): void
  resume(): void
  reset(state?: State): void
  destroy(): void
}

export interface ActorAnimationDriver {
  play(definition: ActorAnimationDefinition, onComplete: () => void): () => void
  setVisible(visible: boolean): void
  pause(): void
  resume(): void
  stop(): void
}

type PendingState<State extends string> = Readonly<{
  state: State
  options?: ActorPlayOptions
}>

export type CreateActorVisualControllerOptions<State extends string> = Readonly<{
  definitions: Readonly<Record<State, ActorAnimationDefinition>>
  fallbackState: State
  driver: ActorAnimationDriver
}>

/**
 * Owns animation priority and one-shot lifecycle without knowing about physics.
 * A completed one-shot is latched until the caller requests a different state,
 * so update loops cannot accidentally restart jump, land, hit or defeat.
 */
export function createActorVisualController<State extends string>({
  definitions,
  fallbackState,
  driver,
}: CreateActorVisualControllerOptions<State>): ActorVisualController<State> {
  let currentState: State | null = null
  let currentDefinition: ActorAnimationDefinition | null = null
  let currentOptions: ActorPlayOptions | undefined
  let queued: PendingState<State> | null = null
  let completedOneShot: State | null = null
  let cancelPlayback: (() => void) | null = null
  let playbackToken = 0
  let terminal = false
  let destroyed = false

  const cancelCurrentPlayback = () => {
    playbackToken += 1
    cancelPlayback?.()
    cancelPlayback = null
  }

  const start = (
    state: State,
    options: ActorPlayOptions | undefined,
    preserveCompletedLatch = false,
  ): ActorPlayResult => {
    const definition = definitions[state]
    if (!preserveCompletedLatch) completedOneShot = null
    cancelCurrentPlayback()
    currentState = state
    currentDefinition = definition
    currentOptions = options
    driver.setVisible(true)
    const token = playbackToken

    cancelPlayback = driver.play(definition, () => {
      if (destroyed || token !== playbackToken || currentState !== state) return

      cancelPlayback = null
      currentState = null
      currentDefinition = null
      const completedOptions = currentOptions
      currentOptions = undefined

      if (definition.lockUntilComplete) completedOneShot = state
      if (definition.hideOnComplete) {
        terminal = true
        queued = null
        driver.setVisible(false)
      }

      completedOptions?.onComplete?.()
      if (destroyed || terminal || currentState !== null) return

      const pending = queued
      queued = null
      if (pending) {
        start(pending.state, pending.options, true)
      } else if (state !== fallbackState) {
        start(fallbackState, undefined, true)
      }
    })

    return 'started'
  }

  const play = (state: State, options?: ActorPlayOptions): ActorPlayResult => {
    if (destroyed) return 'destroyed'
    const definition = definitions[state]

    if (terminal) return 'terminal'

    if (state === currentState) {
      // Requesting the fallback after a completed one-shot is the explicit
      // state transition that arms that one-shot for its next real event.
      if (completedOneShot !== null && state !== completedOneShot) {
        completedOneShot = null
      }
      return 'already-current'
    }
    if (state === completedOneShot) return 'latched'
    if (completedOneShot !== null) completedOneShot = null

    if (currentDefinition?.lockUntilComplete) {
      if (currentDefinition.hideOnComplete) return 'terminal'
      if (definition.priority <= currentDefinition.priority) {
        if (currentDefinition.hideOnComplete) return 'blocked'
        if (!queued || definition.priority >= definitions[queued.state].priority) {
          queued = {state, ...(options ? {options} : {})}
          return 'queued'
        }
        return 'blocked'
      }
      cancelCurrentPlayback()
    }

    return start(state, options)
  }

  return {
    play,
    current: () => currentState,
    isLocked: () => Boolean(currentDefinition?.lockUntilComplete),
    pause() {
      if (!destroyed) driver.pause()
    },
    resume() {
      if (!destroyed) driver.resume()
    },
    reset(state = fallbackState) {
      if (destroyed) return
      terminal = false
      queued = null
      completedOneShot = null
      currentOptions = undefined
      driver.setVisible(true)
      start(state, undefined)
    },
    destroy() {
      if (destroyed) return
      destroyed = true
      terminal = true
      queued = null
      currentState = null
      currentDefinition = null
      currentOptions = undefined
      cancelCurrentPlayback()
      driver.stop()
    },
  }
}

export function queueActorAtlases(scene: Phaser.Scene): string[] {
  const queued: string[] = []

  Object.values(ACTOR_ATLAS).forEach((atlas) => {
    if (scene.textures.exists(atlas.key)) return
    scene.load.spritesheet(atlas.key, atlas.path, {
      frameWidth: atlas.frameWidth,
      frameHeight: atlas.frameHeight,
    })
    queued.push(atlas.key)
  })

  return queued
}

export type ActorAnimationRegistration = Readonly<{
  registered: readonly string[]
  skippedMissingTexture: readonly string[]
}>

export function registerActorAnimations(scene: Phaser.Scene): ActorAnimationRegistration {
  const registered: string[] = []
  const skippedMissingTexture: string[] = []

  ACTOR_ANIMATIONS.forEach((definition) => {
    if (scene.anims.exists(definition.key)) return
    if (!scene.textures.exists(definition.textureKey)) {
      skippedMissingTexture.push(definition.key)
      return
    }

    const timing = definition.durationMs
      ? {duration: definition.durationMs}
      : {frameRate: definition.frameRate}
    scene.anims.create({
      key: definition.key,
      frames: scene.anims.generateFrameNumbers(definition.textureKey, {
        frames: [...definition.frames],
      }),
      repeat: definition.repeat,
      ...timing,
    })
    registered.push(definition.key)
  })

  return {registered, skippedMissingTexture}
}

function getPlaybackDurationMs(definition: ActorAnimationDefinition): number {
  return (
    definition.durationMs ?? Math.max(1, definition.frames.length) * (1_000 / definition.frameRate)
  )
}

function createPhaserAnimationDriver(
  scene: Phaser.Scene,
  sprite: Phaser.Physics.Arcade.Sprite,
): ActorAnimationDriver {
  let cancelActive: (() => void) | null = null
  const getAnimationState = () =>
    (
      sprite as unknown as {
        anims?: Phaser.Animations.AnimationState | null
      }
    ).anims ?? null
  const isSpriteAlive = () => Boolean(sprite.active && sprite.scene)

  return {
    play(definition, onComplete) {
      cancelActive?.()
      let settled = false
      let timer: Phaser.Time.TimerEvent | null = null
      const eventName = `animationcomplete-${definition.key}`
      const animationState = getAnimationState()
      const canAnimate =
        isSpriteAlive() &&
        animationState !== null &&
        scene.textures.exists(definition.textureKey) &&
        scene.anims.exists(definition.key)

      const cancel = () => {
        if (settled) return
        settled = true
        sprite.off(eventName, finish)
        timer?.remove(false)
        timer = null
        if (cancelActive === cancel) cancelActive = null
      }
      const finish = () => {
        if (settled) return
        cancel()
        onComplete()
      }

      cancelActive = cancel
      if (isSpriteAlive()) sprite.setVisible(true)
      if (canAnimate) {
        if (sprite.texture.key !== definition.textureKey) {
          sprite.setTexture(definition.textureKey, definition.frames[0])
        }
        if (definition.lockUntilComplete) sprite.once(eventName, finish)
        animationState.play(definition.key, true)
      }

      if (definition.lockUntilComplete) {
        const duration = getPlaybackDurationMs(definition)
        timer = scene.time.delayedCall(
          canAnimate ? duration + Math.max(50, 1_000 / definition.frameRate) : duration,
          finish,
        )
      }

      return cancel
    },
    setVisible(visible) {
      if (isSpriteAlive()) sprite.setVisible(visible)
    },
    pause() {
      getAnimationState()?.pause()
    },
    resume() {
      getAnimationState()?.resume()
    },
    stop() {
      cancelActive?.()
      cancelActive = null
      getAnimationState()?.stop()
    },
  }
}

function applyPivotAndDisplay(
  sprite: Phaser.Physics.Arcade.Sprite,
  visual: Readonly<{
    display: Readonly<{width: number; height: number}>
    pivot: Readonly<{x: number; y: number}>
  }>,
  scale = 1,
) {
  sprite
    .setDisplaySize(visual.display.width * scale, visual.display.height * scale)
    .setOrigin(visual.pivot.x / 64, visual.pivot.y / 64)
}

export function createPlayerVisualController(
  scene: Phaser.Scene,
  sprite: Phaser.Physics.Arcade.Sprite,
  scale = 1,
): ActorVisualController<PlayerVisualState> {
  applyPivotAndDisplay(sprite, PLAYER_VISUAL, scale)
  const controller = createActorVisualController({
    definitions: PLAYER_VISUAL.animations,
    fallbackState: 'idle',
    driver: createPhaserAnimationDriver(scene, sprite),
  })
  sprite.once('destroy', controller.destroy)
  controller.reset('idle')
  return controller
}

export interface EnemyVisualController {
  play(action: EnemyVisualAction, options?: ActorPlayOptions): ActorPlayResult
  current(): EnemyVisualState | null
  isLocked(): boolean
  pause(): void
  resume(): void
  reset(action?: EnemyVisualAction): void
  destroy(): void
}

export function createEnemyVisualController(
  scene: Phaser.Scene,
  sprite: Phaser.Physics.Arcade.Sprite,
  kind: EnemyVisualKind,
  scale = 1,
): EnemyVisualController {
  applyPivotAndDisplay(sprite, ENEMY_VISUAL, scale)
  const fallbackState = getEnemyVisualState(kind, 'idle')
  const controller = createActorVisualController({
    definitions: ENEMY_VISUAL.animations,
    fallbackState,
    driver: createPhaserAnimationDriver(scene, sprite),
  })
  sprite.once('destroy', controller.destroy)
  controller.reset(fallbackState)

  return {
    play(action, options) {
      return controller.play(getEnemyVisualState(kind, action), options)
    },
    current: controller.current,
    isLocked: controller.isLocked,
    pause: controller.pause,
    resume: controller.resume,
    reset(action = 'idle') {
      controller.reset(getEnemyVisualState(kind, action))
    },
    destroy: controller.destroy,
  }
}

export function createBossVisualController(
  scene: Phaser.Scene,
  sprite: Phaser.Physics.Arcade.Sprite,
  bossId: BossVisualId,
  scale = 1,
): ActorVisualController<BossVisualState> {
  applyPivotAndDisplay(sprite, BOSS_VISUAL, scale)
  const definitions = Object.fromEntries(
    (['idle', 'move', 'telegraph', 'attack', 'hit', 'defeat'] as const).map((state) => [
      state,
      getBossAnimation(bossId, state),
    ]),
  ) as Record<BossVisualState, ActorAnimationDefinition>
  const controller = createActorVisualController({
    definitions,
    fallbackState: 'idle',
    driver: createPhaserAnimationDriver(scene, sprite),
  })
  sprite.once('destroy', controller.destroy)
  controller.reset('idle')
  return controller
}
