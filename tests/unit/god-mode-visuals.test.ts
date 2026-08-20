import {describe, expect, it} from 'vitest'

import {
  GOD_MODE_PALETTE,
  resolveGodModeVisualFrame,
} from '../../src/lib/rise-game/visuals/god-mode-visuals'

describe('God mode visuals', () => {
  it('uses the same cyan, magenta and acid palette as the DDC site', () => {
    expect(GOD_MODE_PALETTE).toMatchObject({
      ink: 0x080808,
      paper: 0xf4f0e8,
      magenta: 0xff2a78,
      cyan: 0x27e0d1,
      acid: 0xd7ff46,
    })
  })

  it('starts with a visible transformation burst and settles into a steady aura', () => {
    const entering = resolveGodModeVisualFrame(1_000, 1_000, false)
    const settled = resolveGodModeVisualFrame(1_600, 1_000, false)

    expect(entering.entrance).toBe(1)
    expect(settled.entrance).toBe(0)
    expect(entering.echoOffset).toBeGreaterThan(settled.echoOffset)
    expect(entering.echoScale).toBeGreaterThan(settled.echoScale)
    expect(entering.overlayAlpha).toBeGreaterThan(settled.overlayAlpha)
  })

  it('keeps a static, legible God silhouette when reduced motion is requested', () => {
    const first = resolveGodModeVisualFrame(0, 0, true)
    const later = resolveGodModeVisualFrame(4_000, 0, true)

    expect(later).toEqual(first)
    expect(first.entrance).toBe(0)
    expect(first.rotation).toBe(0)
    expect(first.echoAlpha).toBeGreaterThan(0)
    expect(first.crownAlpha).toBeGreaterThan(0)
  })
})
