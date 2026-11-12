/** Authored 2D motion, inspired by rotoscoping; no live-action footage is used. */
export const PLAYER_MOTION = {
  key: 'cantica-player-motion',
  sourceKey: 'davide-motion-source',
  sourcePath: '/game/v2/sprites/davide-atlas-v2.png',
  size: 64,
  columns: 12,
  clips: {
    idle: {start: 0, count: 24, fps: 12},
    run: {start: 24, count: 24, fps: 90},
    'jump-start': {start: 48, count: 6, fps: 60},
    jump: {start: 54, count: 8, fps: 24},
    fall: {start: 62, count: 8, fps: 24},
    land: {start: 70, count: 8, fps: 60},
    brake: {start: 78, count: 6, fps: 60},
  },
} as const

export type MotionState = keyof typeof PLAYER_MOTION.clips
export type Point = Readonly<{x: number; y: number}>
export type MotionPose = Readonly<{
  hip: Point
  neck: Point
  frontFoot: Point
  backFoot: Point
  frontElbow: Point
  frontHand: Point
  backElbow: Point
  backHand: Point
}>

const point = (x: number, y: number): Point => ({x, y})
const mix = (a: number, b: number, t: number) => a + (b - a) * t
const ease = (t: number) => t * t * (3 - 2 * t)
const STRIDE_REACH = 16
const STANCE_FRACTION = 0.55

export function getRunPlaybackScale(velocityX: number, displayWidth: number): number {
  if (!Number.isFinite(velocityX) || !Number.isFinite(displayWidth) || displayWidth <= 0) return 1
  const clip = PLAYER_MOTION.clips.run
  const stanceSpeed = STRIDE_REACH * 2 * displayWidth / 64 * clip.fps / clip.count / STANCE_FRACTION
  return Math.max(0.01, Math.abs(velocityX) / stanceSpeed)
}

/** Stance travels backwards at constant speed; the recovery foot clears the ground. */
export function strideFoot(phase: number): Point {
  const p = ((phase % 1) + 1) % 1
  if (p < STANCE_FRACTION) return point(mix(STRIDE_REACH, -STRIDE_REACH, p / STANCE_FRACTION), 56.5)
  const swing = (p - STANCE_FRACTION) / (1 - STANCE_FRACTION)
  return point(mix(-STRIDE_REACH, STRIDE_REACH, ease(swing)), 56.5 - Math.sin(swing * Math.PI) * 13)
}

/** Solve the knee without changing either the pelvis or the planted foot. */
export function bendJoint(a: Point, b: Point, length = 12, bend = 1): Point {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const distance = Math.max(0.001, Math.hypot(dx, dy))
  const offset = Math.sqrt(Math.max(0, length * length - distance * distance / 4))
  return point((a.x + b.x) / 2 + dy / distance * offset * bend,
    (a.y + b.y) / 2 - dx / distance * offset * bend)
}

export function samplePlayerMotion(state: MotionState, progress: number): MotionPose {
  const p = Math.max(0, Math.min(1, progress))
  const cycle = p * Math.PI * 2
  let hip = point(32, 40.5)
  let lean = 0.6
  let frontFoot = point(37, 56.5)
  let backFoot = point(27, 56.5)
  let frontElbow = point(27, 36.5)
  let frontHand = point(28, 43)
  let backElbow = point(40, 34)
  let backHand = point(43, 37)

  if (state === 'idle') {
    hip = point(32 + Math.sin(cycle) * 0.25, 40.5 - (1 - Math.cos(cycle)) * 0.3)
    lean += Math.sin(cycle) * 0.25
    frontHand = point(28 + Math.sin(cycle) * 0.3, 43)
  } else if (state === 'run') {
    hip = point(31, 39.5 + Math.cos(cycle * 2) * 1.1)
    lean = 3.6
    const front = strideFoot(p)
    const back = strideFoot(p + 0.5)
    frontFoot = point(32 + front.x, front.y)
    backFoot = point(32 + back.x, back.y)
    const arm = (offset: number, shoulderX: number) => {
      const angle = Math.sin(cycle + offset) * 0.9 - 0.15
      const elbow = point(shoulderX + Math.sin(angle) * 8, hip.y - 11 + Math.cos(angle) * 8)
      return {elbow, hand: point(elbow.x + Math.cos(angle + 0.2) * 7,
        elbow.y - Math.sin(angle + 0.2) * 7 - 2)}
    }
    const frontArm = arm(Math.PI, hip.x + lean - 3)
    const backArm = arm(0, hip.x + lean + 2)
    frontElbow = frontArm.elbow
    frontHand = frontArm.hand
    backElbow = backArm.elbow
    backHand = backArm.hand
  } else if (state === 'jump-start') {
    const t = ease(p)
    hip = point(32, mix(44, 37, t))
    lean = mix(4, 2, t)
    frontFoot = point(mix(39, 35, t), 56.5)
    backFoot = point(mix(24, 25, t), mix(56.5, 53, t))
    frontElbow = point(28, mix(38, 28, t))
    frontHand = point(33, mix(35, 24, t))
    backElbow = point(42, mix(38, 27, t))
    backHand = point(45, mix(34, 20, t))
  } else if (state === 'jump') {
    const t = ease(p)
    hip = point(32, 38)
    lean = 2
    frontFoot = point(40, mix(53, 48, t))
    backFoot = point(25, mix(54, 47, t))
    frontElbow = point(28, 31)
    frontHand = point(33, 25)
    backElbow = point(41, 28)
    backHand = point(44, 22)
  } else if (state === 'fall') {
    const t = ease(p)
    hip = point(32, 39)
    lean = mix(2, 0, t)
    frontFoot = point(40, mix(48, 55, t))
    backFoot = point(26, mix(47, 53, t))
    frontElbow = point(24, 31)
    frontHand = point(26, mix(25, 33, t))
    backElbow = point(43, 30)
    backHand = point(47, mix(24, 31, t))
  } else if (state === 'land') {
    const compression = p < 0.25 ? ease(p / 0.25) : 1 - ease((p - 0.25) / 0.75)
    hip = point(32 - compression, 40.5 + compression * 5)
    lean = 0.6 + compression * 5
    frontFoot = point(39, 56.5)
    backFoot = point(25, 56.5)
    frontElbow = point(28, 36 + compression * 4)
    frontHand = point(34, 40 + compression * 3)
    backElbow = point(43, 34 + compression * 5)
    backHand = point(46, 35 + compression * 3)
  } else {
    const t = 1 - ease(p)
    hip = point(32 - t * 2, 40.5 + t)
    lean = 0.6 - t * 2.4
    frontFoot = point(37 + t * 6, 56.5)
    backFoot = point(27 - t * 3, 56.5)
    frontElbow = point(27 - t * 3, 36.5)
    frontHand = point(28 - t, 43 - t * 2)
  }
  return {hip, neck: point(hip.x + lean, hip.y - 14), frontFoot, backFoot,
    frontElbow, frontHand, backElbow, backHand}
}

type Polygon = readonly (readonly [number, number])[]

// These are pieces of Davide's existing artwork, in quarter-size source coordinates.
const ART = {
  head: [[27, 9], [40, 8], [44, 13], [44, 21], [40, 27], [35, 29], [30, 26], [27, 20]],
  torso: [[28, 26], [33, 28], [39, 27], [43, 29], [43, 40], [40, 43], [29, 42], [27, 35]],
  upperArm: [[24, 30], [28, 31], [30, 37], [27, 39], [24, 36]],
  forearm: [[24, 36], [28, 36], [29, 44], [26, 46], [24, 43]],
  thigh: [[35, 42], [43, 42], [44, 49], [40, 52], [35, 50]],
  shin: [[35, 49], [43, 49], [43, 55], [35, 56]],
  shoe: [[35, 55], [43, 55], [45, 57], [45, 59], [35, 59]],
} as const satisfies Record<string, Polygon>

function drawPart(ctx: CanvasRenderingContext2D, source: CanvasImageSource,
  polygon: Polygon, fromA: Point, fromB: Point, toA: Point, toB: Point) {
  const sourceLength = Math.hypot(fromB.x - fromA.x, fromB.y - fromA.y)
  const scale = Math.hypot(toB.x - toA.x, toB.y - toA.y) / sourceLength
  ctx.save()
  ctx.translate(toA.x, toA.y)
  ctx.rotate(Math.atan2(toB.y - toA.y, toB.x - toA.x))
  // Keep the limbs' volume while their joints articulate.
  ctx.scale(scale, 1)
  ctx.rotate(-Math.atan2(fromB.y - fromA.y, fromB.x - fromA.x))
  ctx.translate(-fromA.x, -fromA.y)
  ctx.beginPath()
  polygon.forEach(([x, y], i) => i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y))
  ctx.closePath()
  ctx.clip()
  ctx.drawImage(source, 0, 0, 256, 256, 0, 0, 64, 64)
  ctx.restore()
}

/** Render only the visual; collision bounds and player position remain owned by Phaser. */
export function drawPlayerMotion(ctx: CanvasRenderingContext2D, source: CanvasImageSource,
  state: MotionState, progress: number) {
  const pose = samplePlayerMotion(state, progress)
  const {hip, neck} = pose
  ctx.imageSmoothingEnabled = true

  const limb = (a: Point, joint: Point, end: Point, leg: boolean) => {
    if (leg) {
      drawPart(ctx, source, ART.thigh, point(39, 43), point(39, 49.5), a, joint)
      drawPart(ctx, source, ART.shin, point(39, 49.5), point(39, 56), joint, end)
      drawPart(ctx, source, ART.shoe, point(39, 56.5), point(39, 58.5), end,
        point(end.x, end.y + 2))
    } else {
      drawPart(ctx, source, ART.upperArm, point(26, 31), point(26.5, 37), a, joint)
      drawPart(ctx, source, ART.forearm, point(26.5, 37), point(27, 43.5), joint, end)
    }
  }

  const backHip = point(hip.x - 2, hip.y)
  const frontHip = point(hip.x + 2, hip.y)
  ctx.globalAlpha = 0.83
  limb(point(neck.x + 3, neck.y + 3), pose.backElbow, pose.backHand, false)
  limb(backHip, bendJoint(backHip, pose.backFoot), pose.backFoot, true)
  ctx.globalAlpha = 1
  limb(frontHip, bendJoint(frontHip, pose.frontFoot), pose.frontFoot, true)
  drawPart(ctx, source, ART.torso, point(35, 42), point(35, 28), hip, neck)
  drawPart(ctx, source, ART.head, point(35, 27), point(35, 13), neck,
    point(neck.x + (neck.x - hip.x) * 0.1, neck.y - 14))
  limb(point(neck.x - 4, neck.y + 3), pose.frontElbow, pose.frontHand, false)

  // Davide's cyan microphone follows the far hand instead of sliding across the body.
  ctx.save()
  ctx.translate(pose.backHand.x, pose.backHand.y)
  ctx.rotate(-0.2)
  ctx.fillStyle = '#171a24'
  ctx.fillRect(-1, -6, 2, 7)
  ctx.fillStyle = '#49e9ee'
  ctx.fillRect(-1.8, -6.5, 3.6, 2)
  ctx.fillStyle = '#9f668e'
  ctx.fillRect(-1.3, -4.5, 2.6, 1)
  ctx.restore()
}

export function createMotionAtlas(source: CanvasImageSource): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = PLAYER_MOTION.columns * PLAYER_MOTION.size
  canvas.height = 7 * PLAYER_MOTION.size
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D is unavailable for player motion')
  for (const [state, clip] of Object.entries(PLAYER_MOTION.clips)) {
    for (let index = 0; index < clip.count; index++) {
      const frame = clip.start + index
      ctx.save()
      ctx.translate(frame % PLAYER_MOTION.columns * 64, Math.floor(frame / PLAYER_MOTION.columns) * 64)
      const looping = state === 'idle' || state === 'run'
      drawPlayerMotion(ctx, source, state as MotionState, index / (looping ? clip.count : clip.count - 1))
      ctx.restore()
    }
  }
  return canvas
}
