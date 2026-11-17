import { GAME_WIDTH } from '../config'
import { LEVEL_HEIGHT, type LevelTheme } from '../level-data'

export const INFERNO_BACKGROUNDS = {
  giudecca: { key: 'background-v4-giudecca', src: '/game/v4/backgrounds/giudecca.webp' },
  dite: { key: 'background-v4-dite', src: '/game/v4/backgrounds/dite.webp' },
  stelle: { key: 'background-v4-stelle', src: '/game/v4/backgrounds/stelle.webp' },
} as const satisfies Record<LevelTheme, { key: string; src: string }>

export const BACKGROUND_OVERSCAN = 24
export const BACKGROUND_ALPHA = 0.82

export function resolveInfernoBackgroundTransform({
  viewportWidth,
  textureWidth,
  textureHeight,
}: Readonly<{
  viewportWidth: number
  textureWidth: number
  textureHeight: number
}>) {
  const width = Math.max(GAME_WIDTH, viewportWidth) + BACKGROUND_OVERSCAN * 2
  const scale = Math.max(width / textureWidth, LEVEL_HEIGHT / textureHeight)

  return {
    width,
    scale,
    positionX: Math.max(0, (textureWidth - width / scale) / 2),
    positionY: Math.max(0, (textureHeight - LEVEL_HEIGHT / scale) / 2),
  }
}
