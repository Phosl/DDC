/** Authored 2D motion, inspired by rotoscoping; no live-action footage is used. */
export const PLAYER_MOTION = {
  key: 'cantica-player-motion',
  sourceKey: 'davide-motion-source',
  sourcePath: '/game/v4/actors/davide-source.png',
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
  headTilt: number
  frontFootTilt: number
  backFootTilt: number
  microphoneTilt: number
}>

const point = (x: number, y: number): Point => ({x, y})
const mix = (a: number, b: number, t: number) => a + (b - a) * t
const ease = (t: number) => t * t * (3 - 2 * t)
const STRIDE_REACH = 15
const STANCE_FRACTION = 10 / 24

// Contact, compression, push and flight, then the same beats on the other leg.
const RUN_KEYS = [
  {at: 0, hipY: 41, lean: 5.5, arm: -1.05, headTilt: -0.08},
  {at: 3 / 24, hipY: 43, lean: 6.8, arm: -0.5, headTilt: 0.09},
  {at: 8 / 24, hipY: 40, lean: 7.2, arm: 0.9, headTilt: -0.05},
  {at: 11 / 24, hipY: 38.5, lean: 5.8, arm: 1.1, headTilt: -0.14},
  {at: 12 / 24, hipY: 41, lean: 5.5, arm: 1.05, headTilt: -0.08},
  {at: 15 / 24, hipY: 43, lean: 6.8, arm: 0.5, headTilt: 0.09},
  {at: 20 / 24, hipY: 40, lean: 7.2, arm: -0.9, headTilt: -0.05},
  {at: 23 / 24, hipY: 38.5, lean: 5.8, arm: -1.1, headTilt: -0.14},
  {at: 1, hipY: 41, lean: 5.5, arm: -1.05, headTilt: -0.08},
] as const

function sampleRunKey(phase: number) {
  const p = ((phase % 1) + 1) % 1
  const next = RUN_KEYS.findIndex(key => key.at > p)
  const a = RUN_KEYS[next - 1], b = RUN_KEYS[next]
  const t = ease((p - a.at) / (b.at - a.at))
  return {hipY: mix(a.hipY, b.hipY, t), lean: mix(a.lean, b.lean, t),
    arm: mix(a.arm, b.arm, t), headTilt: mix(a.headTilt, b.headTilt, t)}
}

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
  // Match the contact's horizontal velocity at both ends of the recovery arc.
  const tangent = -2 * STRIDE_REACH / STANCE_FRACTION * (1 - STANCE_FRACTION)
  const x = mix(-STRIDE_REACH, STRIDE_REACH, ease(swing))
    + tangent * (2 * swing ** 3 - 3 * swing ** 2 + swing)
  return point(x, 56.5 - Math.sin(swing * Math.PI) * 18)
}

function strideFootTilt(phase: number): number {
  const p = ((phase % 1) + 1) % 1
  if (p < 0.08) return mix(-0.18, 0, ease(p / 0.08))
  if (p < 0.28) return 0
  if (p < STANCE_FRACTION) return 0.7 * ease((p - 0.28) / (STANCE_FRACTION - 0.28))
  const swing = (p - STANCE_FRACTION) / (1 - STANCE_FRACTION)
  return mix(0.7, -0.18, ease(swing)) + Math.sin(swing * Math.PI) * 0.6
}

/** Roll around the heel or toe; the sole contact stays on the ground. */
export function footAnkle(contact: Point, tilt: number): Point {
  const pivotX = tilt < 0 ? -4 : 6
  return point(contact.x + pivotX - Math.cos(tilt) * pivotX + Math.sin(tilt) * 2.5,
    contact.y + 2.5 - Math.sin(tilt) * pivotX - Math.cos(tilt) * 2.5)
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
  let frontFoot = point(39, 56.5)
  let backFoot = point(25, 56.5)
  let frontElbow = point(27, 36.5)
  let frontHand = point(28, 43)
  let backElbow = point(40, 34)
  let backHand = point(43, 37)
  let headTilt = 0
  let frontFootTilt = 0
  let backFootTilt = 0
  let microphoneTilt = -0.2

  if (state === 'idle') {
    hip = point(32 + Math.sin(cycle) * 0.45, 40.5 - (1 - Math.cos(cycle)) * 0.45)
    lean += Math.sin(cycle) * 0.5
    frontElbow = point(27, 36.5 - Math.sin(cycle) * 0.45)
    frontHand = point(28 + Math.sin(cycle) * 0.5, 43)
    backElbow = point(40, 34 - Math.sin(cycle - 0.25) * 0.65)
    backHand = point(43 + Math.sin(cycle - 0.4) * 0.7, 37 - Math.sin(cycle - 0.4) * 0.8)
    headTilt = Math.sin(cycle - 0.3) * 0.035
    microphoneTilt += Math.sin(cycle - 0.6) * 0.12
  } else if (state === 'run') {
    const key = sampleRunKey(p)
    const follow = sampleRunKey(p - 1 / 24)
    hip = point(32, key.hipY)
    lean = key.lean
    headTilt = follow.headTilt
    const front = strideFoot(p)
    const back = strideFoot(p + 0.5)
    frontFoot = point(32 + front.x, front.y)
    backFoot = point(32 + back.x, back.y)
    frontFootTilt = strideFootTilt(p)
    backFootTilt = strideFootTilt(p + 0.5)
    const arm = (angle: number, shoulderX: number) => {
      const elbow = point(shoulderX + Math.sin(angle) * 8, hip.y - 11 + Math.cos(angle) * 8)
      const forearm = 2.3 + angle * 0.3
      return {elbow, hand: point(elbow.x + Math.sin(forearm) * 8, elbow.y + Math.cos(forearm) * 8)}
    }
    const frontArm = arm(key.arm, hip.x + lean - 4)
    const backArm = arm(-follow.arm, hip.x + lean + 3)
    frontElbow = frontArm.elbow
    frontHand = frontArm.hand
    backElbow = backArm.elbow
    backHand = backArm.hand
    microphoneTilt = -0.2 - sampleRunKey(p - 2 / 24).arm * 0.35
  } else if (state === 'jump-start') {
    const t = ease(p)
    hip = point(32, mix(46, 38, t))
    lean = mix(6, 3.5, t)
    frontFoot = point(mix(39, 40, t), mix(56.5, 53, t))
    backFoot = point(25, mix(56.5, 52, t))
    frontFootTilt = t * 0.55
    backFootTilt = t * 0.85
    frontElbow = point(27, mix(40, 29, t))
    frontHand = point(32, mix(37, 23, t))
    backElbow = point(43, mix(39, 26, t))
    backHand = point(46, mix(34, 19, t))
    headTilt = mix(0.16, -0.12, ease(Math.max(0, p - 0.12) / 0.88))
    microphoneTilt = mix(0.3, -0.5, ease(Math.max(0, p - 0.15) / 0.85))
  } else if (state === 'jump') {
    const t = ease(p)
    hip = point(32, 38)
    lean = mix(3.5, 4.5, t)
    frontFoot = point(mix(40, 44, t), mix(53, 45, t))
    backFoot = point(mix(25, 23, t), mix(52, 43, t))
    frontFootTilt = mix(0.55, -0.25, t)
    backFootTilt = mix(0.85, 1, t)
    frontElbow = point(27, mix(29, 31, t))
    frontHand = point(32, mix(23, 25, t))
    backElbow = point(mix(43, 45, t), mix(26, 29, t))
    backHand = point(mix(46, 49, t), mix(19, 23, t))
    headTilt = mix(-0.12, -0.04, t)
    microphoneTilt = mix(-0.5, -0.1, t)
  } else if (state === 'fall') {
    const t = ease(p)
    hip = point(32, mix(38, 40.5, t))
    lean = mix(4.5, 0.6, t)
    frontFoot = point(mix(44, 39, t), mix(45, 56.5, t))
    backFoot = point(mix(23, 25, t), mix(43, 56.5, t))
    frontFootTilt = mix(-0.25, 0, t)
    backFootTilt = mix(1, 0, t)
    frontElbow = point(mix(27, 28, t), mix(31, 36, t))
    frontHand = point(mix(32, 34, t), mix(25, 40, t))
    backElbow = point(mix(45, 43, t), mix(29, 34, t))
    backHand = point(mix(49, 46, t), mix(23, 35, t))
    headTilt = mix(-0.04, 0, t)
    microphoneTilt = mix(-0.1, -0.2, t)
  } else if (state === 'land') {
    const compression = p < 0.25 ? ease(p / 0.25) : 1 - ease((p - 0.25) / 0.75)
    const follow = Math.sin(Math.PI * Math.max(0, p - 0.1) / 0.9) ** 2
    hip = point(32 - compression * 1.5, 40.5 + compression * 7)
    lean = 0.6 + compression * 6.5
    frontFoot = point(39, 56.5)
    backFoot = point(25, 56.5)
    frontElbow = point(28 - compression, mix(36, 36.5, p) + compression * 5)
    frontHand = point(mix(34, 28, p), mix(40, 43, p) + compression * 4)
    backElbow = point(mix(43, 40, p), 34 + compression * 5)
    backHand = point(mix(46, 43, p), mix(35, 37, p) + compression * 4 + follow)
    headTilt = follow * 0.19
    microphoneTilt += follow * 0.45
  } else {
    const t = 1 - ease(p)
    const follow = Math.sin(Math.PI * p)
    hip = point(32 - t * 3, 40.5 + t * 3)
    lean = 0.6 - t * 4.8
    frontFoot = point(39, 56.5)
    backFoot = point(25, 56.5)
    frontElbow = point(27 - t * 5, 36.5 - t)
    frontHand = point(28 + t * 4, 43 - t * 4)
    backElbow = point(40 + t * 3, 34 - t)
    backHand = point(43 + t * 4, 37 - t * 3)
    headTilt = 0.12 * t - 0.16 * follow
    microphoneTilt += 0.5 * follow
  }
  return {hip, neck: point(hip.x + lean, hip.y - 14), frontFoot, backFoot,
    frontElbow, frontHand, backElbow, backHand, headTilt, frontFootTilt, backFootTilt, microphoneTilt}
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
  ctx.imageSmoothingEnabled = false

  const limb = (a: Point, joint: Point, end: Point, leg: boolean, footTilt = 0) => {
    if (leg) {
      drawPart(ctx, source, ART.thigh, point(39, 43), point(39, 49.5), a, joint)
      drawPart(ctx, source, ART.shin, point(39, 49.5), point(39, 56), joint, end)
      drawPart(ctx, source, ART.shoe, point(39, 56.5), point(39, 58.5), end,
        point(end.x - Math.sin(footTilt) * 2, end.y + Math.cos(footTilt) * 2))
    } else {
      drawPart(ctx, source, ART.upperArm, point(26, 31), point(26.5, 37), a, joint)
      drawPart(ctx, source, ART.forearm, point(26.5, 37), point(27, 43.5), joint, end)
    }
  }

  const backHip = point(hip.x - 2, hip.y)
  const frontHip = point(hip.x + 2, hip.y)
  const backAnkle = footAnkle(pose.backFoot, pose.backFootTilt)
  const frontAnkle = footAnkle(pose.frontFoot, pose.frontFootTilt)
  ctx.globalAlpha = 0.83
  limb(point(neck.x + 3, neck.y + 3), pose.backElbow, pose.backHand, false)
  limb(backHip, bendJoint(backHip, backAnkle), backAnkle, true, pose.backFootTilt)
  ctx.globalAlpha = 1
  limb(frontHip, bendJoint(frontHip, frontAnkle), frontAnkle, true, pose.frontFootTilt)
  drawPart(ctx, source, ART.torso, point(35, 42), point(35, 28), hip, neck)
  drawPart(ctx, source, ART.head, point(35, 27), point(35, 13), neck,
    point(neck.x + Math.sin(pose.headTilt) * 14, neck.y - Math.cos(pose.headTilt) * 14))
  limb(point(neck.x - 4, neck.y + 3), pose.frontElbow, pose.frontHand, false)

  // Davide's cyan microphone follows the far hand instead of sliding across the body.
  ctx.save()
  ctx.translate(pose.backHand.x, pose.backHand.y)
  ctx.rotate(pose.microphoneTilt)
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
