import type Phaser from 'phaser'

import {
  GAME_HEIGHT,
  GAME_WIDTH,
  PLAYER,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  resolveRuntimeViewportSize,
} from './config'
import {createAscentScene} from './ascent-scene'
import type {RuntimeBridge} from './internal'
import {mergeGameInput} from './rules'
import {
  INITIAL_GAME_INPUT,
  type AimVector,
  type CreateRiseGameOptions,
  type GameController,
  type GameViewportMode,
} from './types'

type PhaserNamespace = typeof Phaser

type PointerViewportPointOptions = Readonly<{
  clientX: number
  clientY: number
  canvasLeft: number
  canvasTop: number
  canvasWidth: number
  canvasHeight: number
  viewportWidth: number
  viewportHeight: number
}>

/** Maps a CSS-pixel pointer to the logical Phaser viewport without stretching aim. */
export function resolvePointerViewportPoint({
  clientX,
  clientY,
  canvasLeft,
  canvasTop,
  canvasWidth,
  canvasHeight,
  viewportWidth,
  viewportHeight,
}: PointerViewportPointOptions): Readonly<{x: number; y: number}> | null {
  const values = [
    clientX,
    clientY,
    canvasLeft,
    canvasTop,
    canvasWidth,
    canvasHeight,
    viewportWidth,
    viewportHeight,
  ]
  if (values.some((value) => !Number.isFinite(value))) return null
  if (canvasWidth <= 0 || canvasHeight <= 0 || viewportWidth <= 0 || viewportHeight <= 0) {
    return null
  }

  const relativeX = clientX - canvasLeft
  const relativeY = clientY - canvasTop
  if (relativeX < 0 || relativeX > canvasWidth || relativeY < 0 || relativeY > canvasHeight) {
    return null
  }

  return {
    x: (relativeX / canvasWidth) * viewportWidth,
    y: (relativeY / canvasHeight) * viewportHeight,
  }
}

export async function createRiseGame(options: CreateRiseGameOptions): Promise<GameController> {
  if (typeof window === 'undefined') {
    throw new Error('Cantica Zero può essere avviato soltanto nel browser.')
  }

  const imported = await import('phaser')
  const PhaserRuntime = ('default' in imported
    ? imported.default
    : imported) as unknown as PhaserNamespace

  const bridge: RuntimeBridge = {
    input: {...INITIAL_GAME_INPUT},
    assist: options.assist ?? false,
    reducedMotion: options.reducedMotion ?? false,
    actorScale: Math.max(1, options.actorScale ?? 1),
    viewportWidth: GAME_WIDTH,
    viewportHeight: GAME_HEIGHT,
    desiredRunning: false,
    pendingRestart: null,
    destroyed: false,
    scene: null,
    onSnapshot: options.onSnapshot,
    onEvent: options.onEvent ?? (() => undefined),
  }

  const scene = createAscentScene(PhaserRuntime, bridge)
  let destroyed = false
  let viewportMode: GameViewportMode = options.viewportMode ?? 'portrait'
  const game = new PhaserRuntime.Game({
    type: PhaserRuntime.AUTO,
    parent: options.parent,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    title: 'Cantica Zero',
    version: '2.0.0',
    backgroundColor: '#08131c',
    banner: false,
    input: false,
    autoFocus: false,
    scene,
    fps: {
      target: 60,
      panicMax: 6,
      smoothStep: true,
    },
    render: {
      pixelArt: true,
      antialias: false,
      roundPixels: true,
      powerPreference: 'high-performance',
    },
    scale: {
      mode: PhaserRuntime.Scale.FIT,
      autoCenter: PhaserRuntime.Scale.CENTER_BOTH,
      width: GAME_WIDTH,
      height: GAME_HEIGHT,
    },
    physics: {
      default: 'arcade',
      arcade: {
        gravity: {x: 0, y: PLAYER.gravity},
        x: 0,
        y: 0,
        width: WORLD_WIDTH,
        height: WORLD_HEIGHT,
        fps: 60,
        fixedStep: true,
        maxEntries: 24,
      },
    },
    callbacks: {
      postBoot(bootedGame) {
        const canvas = bootedGame.canvas
        canvas.dataset.testid = 'rise-game-canvas'
        canvas.dataset.viewportMode = viewportMode
        canvas.setAttribute('aria-label', 'Cantica Zero — area di gioco')
        canvas.setAttribute('role', 'img')
      },
    },
  })

  const applyViewportSize = () => {
    if (destroyed) return
    const bounds = options.parent.getBoundingClientRect()
    const viewport = resolveRuntimeViewportSize({
      mode: viewportMode,
      parentWidth: bounds.width,
      parentHeight: bounds.height,
    })
    game.canvas.dataset.viewportMode = viewportMode
    if (bridge.viewportWidth === viewport.width && bridge.viewportHeight === viewport.height) {
      bridge.scene?.setViewportSize(viewport.width, viewport.height)
      return
    }
    bridge.viewportWidth = viewport.width
    bridge.viewportHeight = viewport.height
    game.scale.setGameSize(viewport.width, viewport.height)
    bridge.scene?.setViewportSize(viewport.width, viewport.height)
  }

  const parentResizeObserver =
    typeof ResizeObserver === 'function' ? new ResizeObserver(() => applyViewportSize()) : null
  parentResizeObserver?.observe(options.parent)
  if (!parentResizeObserver) window.addEventListener('resize', applyViewportSize)
  applyViewportSize()

  const resetTransientInput = () => ({
    ...INITIAL_GAME_INPUT,
    devFly: bridge.input.devFly,
  })

  return {
    setInput(input) {
      if (destroyed) return
      bridge.input = mergeGameInput(bridge.input, input)
    },
    resolvePointerAim(clientX, clientY): AimVector | null {
      if (destroyed || !bridge.scene) return null
      const bounds = game.canvas.getBoundingClientRect()
      const point = resolvePointerViewportPoint({
        clientX,
        clientY,
        canvasLeft: bounds.left,
        canvasTop: bounds.top,
        canvasWidth: bounds.width,
        canvasHeight: bounds.height,
        viewportWidth: bridge.viewportWidth,
        viewportHeight: bridge.viewportHeight,
      })
      return point ? bridge.scene.resolvePointerAim(point.x, point.y) : null
    },
    clearInput() {
      if (destroyed) return
      bridge.input = resetTransientInput()
    },
    pause(reason) {
      if (destroyed) return
      bridge.input = resetTransientInput()
      bridge.desiredRunning = false
      bridge.scene?.pauseGame(reason)
    },
    resume() {
      if (destroyed) return
      bridge.desiredRunning = true
      bridge.scene?.resumeGame()
    },
    restart(mode) {
      if (destroyed) return
      bridge.pendingRestart = bridge.scene ? null : mode
      bridge.scene?.restartGame(mode)
    },
    setAssist(enabled) {
      if (destroyed) return
      bridge.assist = enabled
      bridge.scene?.setAssist(enabled)
    },
    setDebugFly(enabled) {
      if (destroyed || process.env.NODE_ENV === 'production') return
      bridge.input = mergeGameInput(bridge.input, {devFly: enabled, devFlyY: 0})
      bridge.scene?.setDebugFly(enabled)
    },
    setReducedMotion(enabled) {
      if (destroyed) return
      bridge.reducedMotion = enabled
      bridge.scene?.setReducedMotion(enabled)
    },
    setViewportMode(mode) {
      if (destroyed) return
      viewportMode = mode
      applyViewportSize()
    },
    verifyCampaign:
      process.env.NODE_ENV === 'production'
        ? undefined
        : () => {
            if (destroyed || !bridge.scene) {
              throw new Error('Cantica Zero is not ready for verification.')
            }
            return bridge.scene.verifyCampaign()
          },
    verifyDamageRespawn:
      process.env.NODE_ENV === 'production'
        ? undefined
        : async () => {
            if (destroyed || !bridge.scene) {
              throw new Error('Cantica Zero is not ready for verification.')
            }
            return bridge.scene.verifyDamageRespawn()
          },
    readTelemetry:
      process.env.NODE_ENV === 'production'
        ? undefined
        : () => {
            if (destroyed || !bridge.scene) {
              throw new Error('Cantica Zero is not ready for telemetry.')
            }
            return bridge.scene.readTelemetry()
          },
    destroy() {
      if (destroyed) return
      destroyed = true
      parentResizeObserver?.disconnect()
      if (!parentResizeObserver) window.removeEventListener('resize', applyViewportSize)
      bridge.destroyed = true
      bridge.desiredRunning = false
      bridge.scene = null
      const ownedCanvas = game.canvas
      game.destroy(true)
      ownedCanvas?.remove()
    },
  }
}
