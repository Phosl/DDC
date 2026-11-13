import {describe, expect, it} from 'vitest'
import {bendJoint, footAnkle, getRunPlaybackScale, PLAYER_MOTION, samplePlayerMotion, strideFoot, type MotionState} from '../../src/lib/rise-game/visuals/player-motion'
import {PLAYER_MOTION_ANIMATIONS, type PlayerVisualState} from '../../src/lib/rise-game/visuals/visual-manifest'
import {createActorVisualController, type ActorAnimationDriver} from '../../src/lib/rise-game/visuals/actor-visuals'

describe('articulated Davide motion', () => {
  it('keeps the ground contact fixed vertically and sweeps it at constant speed', () => {
    const contacts = [0, 0.1, 0.2, 0.3, 0.4].map(strideFoot)
    expect(new Set(contacts.map(p => p.y)).size).toBe(1)
    for (let i = 2; i < contacts.length; i++) {
      expect(contacts[i].x - contacts[i - 1].x).toBeCloseTo(contacts[1].x - contacts[0].x)
    }
    expect(strideFoot(0.77).y).toBeLessThan(contacts[0].y - 10)
    expect(strideFoot(1)).toEqual(strideFoot(0))
  })

  it('closes both repeating cycles without a pose discontinuity', () => {
    for (const state of ['idle', 'run'] as const) {
      const first = samplePlayerMotion(state, 0)
      const last = samplePlayerMotion(state, 1)
      for (const key of Object.keys(first) as Array<keyof typeof first>) {
        const a = first[key], b = last[key]
        if (typeof a === 'number' && typeof b === 'number') expect(b).toBeCloseTo(a)
        else if (typeof a !== 'number' && typeof b !== 'number') {
          expect(b.x).toBeCloseTo(a.x)
          expect(b.y).toBeCloseTo(a.y)
        }
      }
    }
  })

  it('includes a clear flight frame on both strides without moving planted contacts', () => {
    const poses = Array.from({length: 24}, (_, i) => samplePlayerMotion('run', i / 24))
    const flying = poses.map((pose, i) => pose.frontFoot.y < 54 && pose.backFoot.y < 54 ? i : -1).filter(i => i >= 0)
    expect(flying).toEqual([11, 23])
    for (const phase of [0, 0.1, 0.2, 0.3, 0.4]) {
      const pose = samplePlayerMotion('run', phase)
      const ankle = footAnkle(pose.frontFoot, pose.frontFootTilt)
      const pivotX = pose.frontFootTilt < 0 ? -4 : 6
      const toeOrHeel = {
        x: ankle.x + Math.cos(pose.frontFootTilt) * pivotX - Math.sin(pose.frontFootTilt) * 2.5,
        y: ankle.y + Math.sin(pose.frontFootTilt) * pivotX + Math.cos(pose.frontFootTilt) * 2.5,
      }
      expect(toeOrHeel.x).toBeCloseTo(pose.frontFoot.x + pivotX)
      expect(toeOrHeel.y).toBeCloseTo(59)
    }
  })

  it('keeps idle and brake feet planted and joins the authored airborne poses', () => {
    for (const state of ['idle', 'brake'] as const) {
      const start = samplePlayerMotion(state, 0)
      for (const phase of [0.25, 0.5, 0.75, 1]) {
        const pose = samplePlayerMotion(state, phase)
        expect(pose.frontFoot).toEqual(start.frontFoot)
        expect(pose.backFoot).toEqual(start.backFoot)
      }
    }
    for (const [from, to] of [['jump-start', 'jump'], ['jump', 'fall'], ['fall', 'land']] as const) {
      const numbers = (state: MotionState, progress: number) => Object.values(samplePlayerMotion(state, progress))
        .flatMap(value => typeof value === 'number' ? [value] : [value.x, value.y])
      const target = numbers(to, 0)
      numbers(from, 1).forEach((value, i) => expect(value).toBeCloseTo(target[i]))
    }
  })

  it('matches the planted foot to world speed at desktop and mobile scales', () => {
    for (const width of [48, 72, 96]) for (const speed of [30, 170, 180, -170]) {
      const clip = PLAYER_MOTION.clips.run
      const cycleSeconds = clip.count / clip.fps / getRunPlaybackScale(speed, width)
      const footDelta = (strideFoot(0.2).x - strideFoot(0.1).x) * width / 64
      const bodyDelta = Math.abs(speed) * cycleSeconds * 0.1
      expect(footDelta + bodyDelta).toBeCloseTo(0)
    }
  })

  it('absorbs a landing through the body without sinking the feet through the floor', () => {
    const poses = [0, 0.25, 0.5, 0.75, 1].map(t => samplePlayerMotion('land', t))
    for (const pose of poses) {
      expect(pose.frontFoot).toEqual(poses[0].frontFoot)
      expect(pose.backFoot).toEqual(poses[0].backFoot)
    }
    expect(poses[1].hip.y).toBeGreaterThan(poses[0].hip.y + 4)
    expect(poses.at(-1)!.hip.y).toEqual(poses[0].hip.y)
  })

  it('keeps every generated joint finite and inside its sprite cell', () => {
    for (const state of Object.keys(PLAYER_MOTION.clips) as MotionState[]) {
      for (let i = 0; i <= 100; i++) {
        for (const p of Object.values(samplePlayerMotion(state, i / 100))) {
          if (typeof p === 'number') {expect(Number.isFinite(p)).toBe(true); continue}
          expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true)
          expect(p.x).toBeGreaterThan(4)
          expect(p.x).toBeLessThan(60)
          expect(p.y).toBeGreaterThan(4)
          expect(p.y).toBeLessThan(60)
        }
        const pose = samplePlayerMotion(state, i / 100)
        for (const side of ['front', 'back'] as const) {
          const hip = {x: pose.hip.x + (side === 'front' ? 2 : -2), y: pose.hip.y}
          const ankle = footAnkle(pose[`${side}Foot`], pose[`${side}FootTilt`])
          const knee = bendJoint(hip, ankle)
          expect(Math.hypot(knee.x - hip.x, knee.y - hip.y)).toBeCloseTo(12)
          expect(Math.hypot(knee.x - ankle.x, knee.y - ankle.y)).toBeCloseTo(12)
        }
      }
    }
    const a = {x: 32, y: 40}, b = {x: 37, y: 56}
    const knee = bendJoint(a, b)
    expect(Math.hypot(knee.x - a.x, knee.y - a.y)).toBeCloseTo(12)
    expect(Math.hypot(knee.x - b.x, knee.y - b.y)).toBeCloseTo(12)
  })

  it('lets run and jump interrupt the landing and braking poses immediately', () => {
    const played: string[] = []
    const driver: ActorAnimationDriver = {
      play: definition => {played.push(definition.key); return () => {}},
      setVisible() {}, pause() {}, resume() {}, stop() {},
    }
    const controller = createActorVisualController<PlayerVisualState>({definitions: PLAYER_MOTION_ANIMATIONS, fallbackState: 'idle', driver})
    expect(controller.play('land')).toBe('started')
    expect(controller.play('run')).toBe('started')
    expect(controller.play('brake')).toBe('started')
    expect(controller.play('jump-start')).toBe('started')
    expect(played.at(-1)).toBe('davide-motion-jump-start')
  })
})
