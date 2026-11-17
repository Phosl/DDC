import path from 'node:path'
import sharp from 'sharp'
import { describe, expect, it } from 'vitest'

import { GAME_WIDTH, LEVEL_HEIGHT, MAX_GAME_WIDTH } from '../../src/lib/rise-game/config'
import {
  BACKGROUND_OVERSCAN,
  INFERNO_BACKGROUNDS,
  resolveInfernoBackgroundTransform,
} from '../../src/lib/rise-game/visuals/background-manifest'

describe('infernal background framing', () => {
  it.each([GAME_WIDTH, 1076, MAX_GAME_WIDTH])(
    'covers a %i-unit viewport without repeating the plate or stretching it',
    (viewportWidth) => {
      const textureWidth = 768
      const textureHeight = 2048
      const frame = resolveInfernoBackgroundTransform({
        viewportWidth,
        textureWidth,
        textureHeight,
      })
      const visibleWidth = frame.width / frame.scale
      const visibleHeight = LEVEL_HEIGHT / frame.scale

      expect(frame.width).toBe(viewportWidth + BACKGROUND_OVERSCAN * 2)
      expect(visibleWidth).toBeLessThanOrEqual(textureWidth)
      expect(visibleHeight).toBeLessThanOrEqual(textureHeight)
      expect(frame.positionX + visibleWidth / 2).toBeCloseTo(textureWidth / 2)
      expect(frame.positionY + visibleHeight / 2).toBeCloseTo(textureHeight / 2)
      expect(BACKGROUND_OVERSCAN).toBeGreaterThan((16 + 5) * 0.18)
    },
  )

  it.each(Object.entries(INFERNO_BACKGROUNDS))(
    'ships a decodable, opaque portrait plate for %s',
    async (_theme, background) => {
      const plate = sharp(path.join(process.cwd(), 'public', background.src))
      const metadata = await plate.metadata()
      expect(metadata.format).toBe('webp')
      expect(metadata.width).toBeGreaterThanOrEqual(GAME_WIDTH)
      expect(metadata.height).toBeGreaterThanOrEqual(LEVEL_HEIGHT)
      expect(metadata.height).toBeGreaterThan(metadata.width ?? 0)
      const stats = await plate.stats()
      expect(stats.isOpaque).toBe(true)
    },
  )
})
