import type Phaser from 'phaser'

import {
  CANTICA_VFX_ATLAS,
  type CanticaVfxSystem,
} from './vfx-system'

type PhaserNamespace = typeof Phaser

export const GOD_MODE_PALETTE = {
  ink: 0x080808,
  paper: 0xf4f0e8,
  magenta: 0xff2a78,
  cyan: 0x27e0d1,
  acid: 0xd7ff46,
} as const

const GOD_TRANSFORMATION_MS = 520

export type GodModeVisualFrame = Readonly<{
  entrance: number
  echoOffset: number
  echoScale: number
  echoAlpha: number
  overlayAlpha: number
  auraScale: number
  auraAlpha: number
  crownScale: number
  crownAlpha: number
  screenAlpha: number
  rotation: number
  noiseX: number
  noiseY: number
  scanlineY: number
}>

export function resolveGodModeVisualFrame(
  timeMs: number,
  activatedAtMs: number,
  reducedMotion: boolean,
): GodModeVisualFrame {
  const time = Number.isFinite(timeMs) ? Math.max(0, timeMs) : 0
  const activatedAt = Number.isFinite(activatedAtMs) ? Math.max(0, activatedAtMs) : time
  const age = Math.max(0, time - activatedAt)
  const entrance = reducedMotion ? 0 : Math.max(0, 1 - age / GOD_TRANSFORMATION_MS)
  const wave = reducedMotion ? 0 : Math.sin(time / 170)
  const waveAlt = reducedMotion ? 0 : Math.cos(time / 240)

  return {
    entrance,
    echoOffset: 1.6 + Math.abs(wave) * 1.35 + entrance * 5.2,
    echoScale: 1.045 + Math.abs(waveAlt) * 0.025 + entrance * 0.12,
    echoAlpha: 0.2 + Math.abs(wave) * 0.1 + entrance * 0.14,
    overlayAlpha: 0.17 + Math.abs(waveAlt) * 0.07 + entrance * 0.18,
    auraScale: 1.06 + Math.abs(wave) * 0.08 + entrance * 0.28,
    auraAlpha: 0.5 + Math.abs(waveAlt) * 0.18,
    crownScale: 0.34 + Math.abs(wave) * 0.05 + entrance * 0.15,
    crownAlpha: 0.72 + Math.abs(waveAlt) * 0.18,
    screenAlpha: 0.045 + Math.abs(wave) * 0.025 + entrance * 0.035,
    rotation: reducedMotion ? 0 : time / 820,
    noiseX: reducedMotion ? 0 : Math.floor(time / 2),
    noiseY: reducedMotion ? 0 : Math.floor(time / 4),
    scanlineY: reducedMotion ? 0 : Math.floor(time / 8),
  }
}

export interface GodModeVisualController {
  setActive(active: boolean, timeMs: number): void
  update(timeMs: number): void
  resize(width: number, height: number): void
  destroy(): void
}

type CreateGodModeVisualControllerOptions = Readonly<{
  scene: Phaser.Scene
  runtime: PhaserNamespace
  player: Phaser.Physics.Arcade.Sprite
  vfx: CanticaVfxSystem | null
  viewportWidth: number
  viewportHeight: number
  getReducedMotion: () => boolean
}>

export function createGodModeVisualController({
  scene,
  runtime,
  player,
  vfx,
  viewportWidth,
  viewportHeight,
  getReducedMotion,
}: CreateGodModeVisualControllerOptions): GodModeVisualController {
  const cyanEcho = scene.add
    .sprite(player.x, player.y, player.texture.key, player.frame.name)
    .setOrigin(player.originX, player.originY)
    .setDepth(player.depth - 1)
    .setTint(GOD_MODE_PALETTE.cyan)
    .setTintMode(runtime.TintModes.FILL)
    .setBlendMode(runtime.BlendModes.ADD)
    .setVisible(false)
  const magentaEcho = scene.add
    .sprite(player.x, player.y, player.texture.key, player.frame.name)
    .setOrigin(player.originX, player.originY)
    .setDepth(player.depth - 0.5)
    .setTint(GOD_MODE_PALETTE.magenta)
    .setTintMode(runtime.TintModes.FILL)
    .setBlendMode(runtime.BlendModes.ADD)
    .setVisible(false)
  const divineOverlay = scene.add
    .sprite(player.x, player.y, player.texture.key, player.frame.name)
    .setOrigin(player.originX, player.originY)
    .setDepth(player.depth + 0.5)
    .setTint(
      GOD_MODE_PALETTE.paper,
      GOD_MODE_PALETTE.acid,
      GOD_MODE_PALETTE.cyan,
      GOD_MODE_PALETTE.magenta,
    )
    .setBlendMode(runtime.BlendModes.SCREEN)
    .setVisible(false)

  const hasVfxAtlas = scene.textures.exists(CANTICA_VFX_ATLAS.key)
  const auraGlyph = hasVfxAtlas
    ? scene.add
        .sprite(player.x, player.y, CANTICA_VFX_ATLAS.key, 17)
        .setDepth(player.depth - 2)
        .setBlendMode(runtime.BlendModes.ADD)
        .setVisible(false)
    : null
  const crownGlyph = hasVfxAtlas
    ? scene.add
        .sprite(player.x, player.y, CANTICA_VFX_ATLAS.key, 23)
        .setDepth(player.depth + 1)
        .setTint(GOD_MODE_PALETTE.acid)
        .setBlendMode(runtime.BlendModes.ADD)
        .setVisible(false)
    : null
  const halo = scene.add
    .ellipse(player.x, player.y, 34, 10, GOD_MODE_PALETTE.ink, 0)
    .setStrokeStyle(2, GOD_MODE_PALETTE.acid, 0.95)
    .setDepth(player.depth + 1)
    .setBlendMode(runtime.BlendModes.ADD)
    .setVisible(false)

  const canCreateScreenLayers =
    scene.textures.exists('god-mode-noise') && scene.textures.exists('god-mode-scanline')
  const noiseLayer = canCreateScreenLayers
    ? scene.add
        .tileSprite(0, 0, viewportWidth, viewportHeight, 'god-mode-noise')
        .setOrigin(0, 0)
        .setScrollFactor(0)
        .setDepth(9995)
        .setTint(
          GOD_MODE_PALETTE.cyan,
          GOD_MODE_PALETTE.magenta,
          GOD_MODE_PALETTE.acid,
          GOD_MODE_PALETTE.cyan,
        )
        .setBlendMode(runtime.BlendModes.ADD)
        .setVisible(false)
    : null
  const scanlineLayer = canCreateScreenLayers
    ? scene.add
        .tileSprite(0, 0, viewportWidth, viewportHeight, 'god-mode-scanline')
        .setOrigin(0, 0)
        .setScrollFactor(0)
        .setDepth(9996)
        .setTileScale(1, 2)
        .setTint(GOD_MODE_PALETTE.acid)
        .setBlendMode(runtime.BlendModes.OVERLAY)
        .setVisible(false)
    : null
  const glowLayer = scene.add
    .rectangle(0, 0, viewportWidth, viewportHeight, GOD_MODE_PALETTE.cyan, 0)
    .setOrigin(0, 0)
    .setScrollFactor(0)
    .setDepth(9994)
    .setBlendMode(runtime.BlendModes.SCREEN)
    .setVisible(false)

  let active = false
  let activatedAtMs = 0
  let destroyed = false
  let displacementFilter: Phaser.Filters.Displacement | null = null
  let glowFilter: Phaser.Filters.Glow | null = null
  let colorMatrixFilter: Phaser.Filters.ColorMatrix | null = null

  const spriteLayers = [cyanEcho, magentaEcho, divineOverlay]
  const worldFx = [auraGlyph, crownGlyph, halo]
  const screenFx = [noiseLayer, scanlineLayer, glowLayer]

  const setWorldFxVisible = (visible: boolean) => {
    spriteLayers.forEach((object) => object.setVisible(visible))
    worldFx.forEach((object) => object?.setVisible(visible))
  }

  const setScreenFxVisible = (visible: boolean) => {
    screenFx.forEach((object) => object?.setVisible(visible))
  }

  const enablePostFx = () => {
    if (displacementFilter || scene.game.renderer.type !== runtime.WEBGL) return
    if (!scene.textures.exists('god-mode-noise')) return

    const filters = scene.cameras.main.filters.external
    displacementFilter = filters.addDisplacement('god-mode-noise', 0.0045, 0.004)
    glowFilter = filters.addGlow(GOD_MODE_PALETTE.cyan, 1.35, 0, 1.05, false, 2, 14)
    colorMatrixFilter = filters.addColorMatrix()
    colorMatrixFilter.colorMatrix.reset()
  }

  const disablePostFx = () => {
    if (!displacementFilter && !glowFilter && !colorMatrixFilter) return

    const filters = scene.cameras.main.filters.external
    if (displacementFilter) filters.remove(displacementFilter, true)
    if (glowFilter) filters.remove(glowFilter, true)
    if (colorMatrixFilter) filters.remove(colorMatrixFilter, true)
    displacementFilter = null
    glowFilter = null
    colorMatrixFilter = null
  }

  const syncSprite = (sprite: Phaser.GameObjects.Sprite) => {
    const frame = player.frame.name
    if (sprite.texture.key !== player.texture.key) sprite.setTexture(player.texture.key, frame)
    else if (sprite.frame.name !== frame) sprite.setFrame(frame)
    sprite
      .setOrigin(player.originX, player.originY)
      .setFlipX(player.flipX)
      .setFlipY(player.flipY)
  }

  const hide = () => {
    setWorldFxVisible(false)
    setScreenFxVisible(false)
    spriteLayers.forEach((object) => object.setAlpha(0))
    worldFx.forEach((object) => object?.setAlpha(0))
    screenFx.forEach((object) => object?.setAlpha(0))
    disablePostFx()
  }

  const updatePostFx = (timeMs: number) => {
    if (!displacementFilter || !glowFilter || !colorMatrixFilter) return
    const wave = Math.sin(timeMs / 160)
    const waveAlt = Math.cos(timeMs / 260)

    displacementFilter.x = 0.004 + wave * 0.0015
    displacementFilter.y = 0.0034 + waveAlt * 0.0011
    glowFilter.outerStrength = 1.25 + wave * 0.35
    glowFilter.innerStrength = 0.06 + Math.abs(Math.sin(timeMs / 180)) * 0.05
    glowFilter.scale = 1.02 + Math.abs(wave) * 0.12
    colorMatrixFilter.colorMatrix
      .reset()
      .hue(wave * 12)
      .saturate(0.24, true)
      .brightness(1.03 + Math.abs(wave) * 0.04, true)
      .contrast(0.08, true)
  }

  const update = (timeMs: number) => {
    if (!active || destroyed) return

    const reducedMotion = getReducedMotion()
    const frame = resolveGodModeVisualFrame(timeMs, activatedAtMs, reducedMotion)
    const playerVisible = player.active && player.visible
    const playerAlpha = playerVisible ? player.alpha : 0
    const echoScaleX = Math.abs(player.scaleX) * frame.echoScale
    const echoScaleY = Math.abs(player.scaleY) * frame.echoScale
    const centerY = player.y + player.displayHeight * (0.5 - player.originY)
    const headY = player.y - player.displayHeight * player.originY + 3
    const visualScale = Math.max(0.75, player.displayHeight / 64)

    spriteLayers.forEach(syncSprite)
    cyanEcho
      .setPosition(player.x - frame.echoOffset, player.y)
      .setScale(echoScaleX, echoScaleY)
      .setAlpha(frame.echoAlpha * playerAlpha)
      .setVisible(playerVisible)
    magentaEcho
      .setPosition(player.x + frame.echoOffset, player.y)
      .setScale(echoScaleX, echoScaleY)
      .setAlpha(frame.echoAlpha * playerAlpha)
      .setVisible(playerVisible)
    divineOverlay
      .setPosition(player.x, player.y)
      .setScale(Math.abs(player.scaleX) * 1.015, Math.abs(player.scaleY) * 1.015)
      .setAlpha(frame.overlayAlpha * playerAlpha)
      .setVisible(playerVisible)

    auraGlyph
      ?.setPosition(player.x, centerY)
      .setScale(visualScale * frame.auraScale)
      .setRotation(frame.rotation)
      .setAlpha(frame.auraAlpha * playerAlpha)
      .setVisible(playerVisible)
    crownGlyph
      ?.setPosition(player.x, headY - 6 * visualScale)
      .setScale(visualScale * frame.crownScale)
      .setRotation(-frame.rotation * 1.6)
      .setAlpha(frame.crownAlpha * playerAlpha)
      .setVisible(playerVisible)
    halo
      .setPosition(player.x, headY)
      .setScale(visualScale * (1 + frame.entrance * 0.35))
      .setAlpha(frame.crownAlpha * playerAlpha)
      .setVisible(playerVisible)

    noiseLayer
      ?.setTilePosition(frame.noiseX, frame.noiseY)
      .setAlpha(0.18 + frame.screenAlpha)
      .setVisible(true)
    scanlineLayer
      ?.setTilePosition(0, frame.scanlineY)
      .setAlpha(0.08 + frame.screenAlpha * 0.5)
      .setVisible(true)
    glowLayer
      .setFillStyle(
        Math.sin(timeMs / 240) >= 0 ? GOD_MODE_PALETTE.cyan : GOD_MODE_PALETTE.magenta,
        1,
      )
      .setAlpha(frame.screenAlpha)
      .setVisible(true)
    updatePostFx(timeMs)
  }

  const setActive = (nextActive: boolean, timeMs: number) => {
    if (destroyed || active === nextActive) return
    active = nextActive
    if (!active) {
      hide()
      return
    }

    activatedAtMs = Number.isFinite(timeMs) ? Math.max(0, timeMs) : 0
    setWorldFxVisible(true)
    setScreenFxVisible(true)
    enablePostFx()
    vfx?.playAttached('player-respawn', player, {
      scale: 1.42,
      tint: GOD_MODE_PALETTE.acid,
      depth: player.depth + 2,
    })
    vfx?.playAttached('boss-burst', player, {
      scale: 0.82,
      tint: GOD_MODE_PALETTE.magenta,
      depth: player.depth + 1,
    })
    if (!getReducedMotion()) {
      scene.cameras.main.flash(150, 39, 224, 209, false)
    }
    update(timeMs)
  }

  const resize = (width: number, height: number) => {
    noiseLayer?.setPosition(0, 0).setSize(width, height).setTilePosition(0, 0)
    scanlineLayer?.setPosition(0, 0).setSize(width, height).setTilePosition(0, 0)
    glowLayer.setPosition(0, 0).setSize(width, height)
  }

  return {
    setActive,
    update,
    resize,
    destroy() {
      if (destroyed) return
      active = false
      hide()
      destroyed = true
      spriteLayers.forEach((object) => object.destroy())
      worldFx.forEach((object) => object?.destroy())
      screenFx.forEach((object) => object?.destroy())
    },
  }
}
