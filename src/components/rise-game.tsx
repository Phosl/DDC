'use client'

import {useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore} from 'react'
import {useGSAP} from '@gsap/react'
import gsap from 'gsap'
import Link from 'next/link'

import type {AimVector, GameController, GameEvent, GamePhase, GameSnapshot} from '@/lib/rise-game'
import {GameAudioEngine} from '@/lib/game-audio'

import {AimJoystick} from './aim-joystick'
import {MoveJoystick} from './move-joystick'
import styles from './rise-game.module.css'
import {useGameFullscreen} from './use-game-fullscreen'
import {useGamepadControls} from './use-gamepad-controls'

gsap.registerPlugin(useGSAP)

declare global {
  interface Window {
    __CANTICA_ZERO_TEST__?: GameController
  }
}

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'

const CIRCLES: Record<string, {label: string; act: string}> = {
  IX: {label: 'IX · Giudecca', act: 'Il fondo che trattiene'},
  VIII: {label: 'VIII · Malebolge', act: 'Il fondo che trattiene'},
  VII: {label: 'VII · Flegetonte', act: 'Il fondo che trattiene'},
  VI: {label: 'VI · Dite', act: 'La città che pesa'},
  V: {label: 'V · Stige', act: 'La città che pesa'},
  IV: {label: 'IV · Avari e prodighi', act: 'La città che pesa'},
  III: {label: 'III · Golosi', act: 'L’aria che chiama'},
  II: {label: 'II · Lussuriosi', act: 'L’aria che chiama'},
  I: {label: 'I · Limbo / Stelle', act: 'L’aria che chiama'},
}

type InputLane = 'left' | 'right' | 'jump' | 'fire' | 'fly-up' | 'fly-down'
type AimInputSource = 'mouse:aim' | 'touch:aim' | 'gamepad:aim'
type AimInputState = Readonly<{
  aim: AimVector | null
  fireHeld: boolean
}>
type RuntimeState = 'loading' | 'ready' | 'error'
type Feedback = {id: number; label: string; tone: 'cyan' | 'magenta' | 'acid'}
type LeaderboardEntry = Readonly<{
  id: string
  nickname: string
  elapsedMs: number
  assist: boolean
  createdAt: number
}>

const LEADERBOARD_STORAGE_KEY = 'cantica-zero:leaderboard:v1'
const NICKNAME_STORAGE_KEY = 'cantica-zero:nickname'
const FALLBACK_NICKNAME = 'Giocatore'
const MAX_LEADERBOARD_ENTRIES = 12

function subscribeToReducedMotion(onChange: () => void) {
  if (typeof window === 'undefined') return () => undefined
  const query = window.matchMedia(REDUCED_MOTION_QUERY)
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}

function getReducedMotionSnapshot() {
  return typeof window !== 'undefined' ? window.matchMedia(REDUCED_MOTION_QUERY).matches : false
}

function normalizeNickname(value: string) {
  const trimmed = value.trim()
  return trimmed.length ? trimmed.slice(0, 20) : FALLBACK_NICKNAME
}

function sanitizeAndSortLeaderboard(entries: ReadonlyArray<LeaderboardEntry>) {
  const safe = [...entries]
  safe.sort((a, b) => {
    if (a.elapsedMs === b.elapsedMs) return a.createdAt - b.createdAt
    return a.elapsedMs - b.elapsedMs
  })
  return safe
}

function readLeaderboard(): ReadonlyArray<LeaderboardEntry> {
  if (typeof window === 'undefined') return []
  try {
    const value = window.localStorage.getItem(LEADERBOARD_STORAGE_KEY)
    if (!value) return []
    const parsed = JSON.parse(value)
    if (!Array.isArray(parsed)) return []
    const validEntries = parsed
      .filter((entry): entry is LeaderboardEntry => {
        return (
          entry &&
          typeof entry === 'object' &&
          typeof entry.id === 'string' &&
          typeof entry.nickname === 'string' &&
          Number.isFinite(entry.elapsedMs) &&
          Number.isFinite(entry.createdAt) &&
          typeof entry.assist === 'boolean'
        )
      })
      .map((entry) => ({
        id: entry.id,
        nickname: normalizeNickname(entry.nickname),
        elapsedMs: Math.max(1, Math.round(entry.elapsedMs)),
        assist: entry.assist,
        createdAt: Math.max(0, Math.round(entry.createdAt)),
      }))
    return sanitizeAndSortLeaderboard(validEntries).slice(0, MAX_LEADERBOARD_ENTRIES)
  } catch {
    return []
  }
}

function writeNickname(value: string) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(NICKNAME_STORAGE_KEY, value)
  } catch {
    // Best-effort storage.
  }
}

function readNickname() {
  if (typeof window === 'undefined') return FALLBACK_NICKNAME
  try {
    const value = window.localStorage.getItem(NICKNAME_STORAGE_KEY)
    return normalizeNickname(value ?? '')
  } catch {
    return FALLBACK_NICKNAME
  }
}

function writeLeaderboard(entries: ReadonlyArray<LeaderboardEntry>) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(LEADERBOARD_STORAGE_KEY, JSON.stringify(sanitizeAndSortLeaderboard(entries)))
  } catch {
    // Best-effort storage.
  }
}

function useReducedMotion() {
  return useSyncExternalStore(subscribeToReducedMotion, getReducedMotionSnapshot, () => false)
}

function formatTime(milliseconds: number | null | undefined) {
  if (milliseconds === null || milliseconds === undefined) return '—:——.—'
  const safeMilliseconds = Math.max(0, milliseconds)
  const minutes = Math.floor(safeMilliseconds / 60_000)
  const seconds = Math.floor((safeMilliseconds % 60_000) / 1_000)
  const tenths = Math.floor((safeMilliseconds % 1_000) / 100)
  return `${minutes}:${String(seconds).padStart(2, '0')}.${tenths}`
}

function formatQuota(quota: number | undefined) {
  const value = Math.round(quota ?? -900)
  return value >= 0 ? `+${value}` : `${value}`
}

function getEventFeedback(event: GameEvent): Omit<Feedback, 'id'> | null {
  if (event.type === 'announcement') {
    return {label: event.message, tone: 'cyan'}
  }

  if (event.type === 'record') {
    return {label: `NUOVO RECORD · ${formatTime(event.elapsedMs)}`, tone: 'acid'}
  }

  const feedbackByCue: Partial<
    Record<Extract<GameEvent, {type: 'audio'}>['cue'], Omit<Feedback, 'id'>>
  > = {
    hit: {label: 'VITA SPEZZATA', tone: 'magenta'},
    pickup: {label: 'VOCE RACCOLTA', tone: 'cyan'},
    checkpoint: {label: 'ATTO SALVATO', tone: 'acid'},
    'boss-enter': {label: 'IL CUSTODE BLOCCA LA VIA', tone: 'magenta'},
    'boss-hit': {label: 'SIGILLO SPEZZATO', tone: 'cyan'},
    complete: {label: 'QUOTA ZERO', tone: 'acid'},
    'game-over': {label: 'LA VIA SI CHIUDE', tone: 'magenta'},
  }

  return feedbackByCue[event.cue] ?? null
}

function isEditableTarget(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable ||
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.tagName === 'SELECT' ||
      target.tagName === 'BUTTON' ||
      target.tagName === 'A')
  )
}

export function RiseGame() {
  const reducedMotion = useReducedMotion()
  const isDevelopment = process.env.NODE_ENV !== 'production'
  const rootRef = useRef<HTMLElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const canvasHostRef = useRef<HTMLDivElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const feedbackRef = useRef<HTMLDivElement>(null)
  const controllerRef = useRef<GameController | null>(null)
  const snapshotRef = useRef<GameSnapshot | null>(null)
  const audioRef = useRef<GameAudioEngine | null>(null)
  const audioEnabledRef = useRef(true)
  const viewportModeRef = useRef<'portrait' | 'adaptive-wide'>('portrait')
  const activeInputsRef = useRef<Record<InputLane, Set<string>>>({
    left: new Set(),
    right: new Set(),
    jump: new Set(),
    fire: new Set(),
    'fly-up': new Set(),
    'fly-down': new Set(),
  })
  const activeAimInputsRef = useRef<Map<string, AimInputState>>(new Map())
  const feedbackIdRef = useRef(0)
  const nicknameRef = useRef(FALLBACK_NICKNAME)

  const [runtimeState, setRuntimeState] = useState<RuntimeState>('loading')
  const [runtimeError, setRuntimeError] = useState('')
  const [snapshot, setSnapshot] = useState<GameSnapshot | null>(null)
  const [assist, setAssist] = useState(false)
  const [debugFly, setDebugFlyState] = useState(false)
  const [audioEnabled, setAudioEnabled] = useState(true)
  const [audioAvailable, setAudioAvailable] = useState(true)
  const [announcement, setAnnouncement] = useState(
    'Cantica Zero pronta. Su desktop mira col mouse e tieni premuto il click; su touch usa i due stick dedicati.',
  )
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [nickname, setNickname] = useState(FALLBACK_NICKNAME)
  const [leaderboard, setLeaderboard] = useState<ReadonlyArray<LeaderboardEntry>>([])
  const lastSnapshotPhaseRef = useRef<GamePhase | null>(null)

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const storedNickname = readNickname()
      nicknameRef.current = storedNickname
      setNickname(storedNickname)
      setLeaderboard(readLeaderboard())
    })
    return () => window.cancelAnimationFrame(frame)
  }, [])

  useEffect(() => {
    nicknameRef.current = normalizeNickname(nickname)
  }, [nickname])

  const phase = snapshot?.phase ?? 'ready'
  const circle = CIRCLES[snapshot?.circleId ?? 'IX'] ?? CIRCLES.IX
  const isPlaying = phase === 'playing' || phase === 'dying'
  const canChangeMode = phase === 'ready' || phase === 'game-over' || phase === 'complete'

  const releaseAllInputs = useCallback(() => {
    for (const lane of Object.values(activeInputsRef.current)) lane.clear()
    activeAimInputsRef.current.clear()
    controllerRef.current?.clearInput()
  }, [])

  const updateHeldInput = useCallback(
    (nextDebugFly = debugFly) => {
      const active = activeInputsRef.current
      const left = active.left.size > 0
      const right = active.right.size > 0
      const touchAim = activeAimInputsRef.current.get('touch:aim')?.aim ?? null
      const gamepadAim = activeAimInputsRef.current.get('gamepad:aim')?.aim ?? null
      const mouseAim = activeAimInputsRef.current.get('mouse:aim')?.aim ?? null
      const fireHeld =
        active.fire.size > 0 ||
        Array.from(activeAimInputsRef.current.values()).some((input) => input.fireHeld)
      const debugFlyY = active['fly-up'].size > 0 ? -1 : active['fly-down'].size > 0 ? 1 : 0
      controllerRef.current?.setInput({
        moveX: left === right ? 0 : left ? -1 : 1,
        aim: touchAim ?? gamepadAim ?? mouseAim,
        jumpHeld: active.jump.size > 0,
        fireHeld,
        devFly: isDevelopment && nextDebugFly,
        devFlyY: isDevelopment && nextDebugFly ? debugFlyY : 0,
      })
    },
    [debugFly, isDevelopment],
  )

  const setDebugFly = useCallback(
    (enabled: boolean) => {
      if (!isDevelopment) return
      setDebugFlyState(enabled)
      if (!enabled) {
        const active = activeInputsRef.current
        active['fly-up'].clear()
        active['fly-down'].clear()
      }
      controllerRef.current?.setDebugFly?.(enabled)
      updateHeldInput(enabled)
      setAnnouncement(enabled ? 'Modalità Volare attiva per debug.' : 'Modalità Volare disattivata.')
    },
    [isDevelopment, updateHeldInput],
  )

  const toggleDebugFly = useCallback(() => {
    setDebugFly(!debugFly)
  }, [debugFly, setDebugFly])

  const setNicknameState = useCallback((value: string) => {
    setNickname(value.slice(0, 20))
  }, [])

  const commitNickname = useCallback((value: string) => {
    const clean = normalizeNickname(value)
    setNickname(clean)
    nicknameRef.current = clean
    writeNickname(clean)
  }, [])

  const addLeaderboardEntry = useCallback((elapsedMs: number, runAssist: boolean) => {
    const nextEntry = {
      id: `${Date.now()}-${Math.floor(Math.random() * 10_000)}`,
      nickname: nicknameRef.current,
      elapsedMs: Math.max(1, Math.round(elapsedMs)),
      assist: runAssist,
      createdAt: Date.now(),
    }

    setLeaderboard((current) => {
      const next = sanitizeAndSortLeaderboard([...current, nextEntry]).slice(0, MAX_LEADERBOARD_ENTRIES)
      writeLeaderboard(next)
      return next
    })
  }, [])

  const modeLeaderboard = useMemo(() => {
    const isAssistMode = snapshot?.assist ?? assist
    return leaderboard.filter((entry) => entry.assist === isAssistMode).slice(0, 6)
  }, [assist, snapshot?.assist, leaderboard])

  const setTouchMove = useCallback(
    (moveX: -1 | 0 | 1) => {
      const active = activeInputsRef.current
      active.left.delete('touch:move:left')
      active.right.delete('touch:move:right')
      if (moveX < 0) active.left.add('touch:move:left')
      if (moveX > 0) active.right.add('touch:move:right')
      updateHeldInput()
    },
    [updateHeldInput],
  )

  const isFireHeld = useCallback(
    () =>
      activeInputsRef.current.fire.size > 0 ||
      Array.from(activeAimInputsRef.current.values()).some((input) => input.fireHeld),
    [],
  )

  const pressInput = useCallback(
    (lane: InputLane, source: string) => {
      const sources = activeInputsRef.current[lane]
      const wasReleased = lane === 'fire' ? !isFireHeld() : sources.size === 0
      sources.add(source)
      updateHeldInput()
      if (wasReleased && lane === 'jump') {
        controllerRef.current?.setInput({jumpPressed: true, jumpHeld: true})
      } else if (wasReleased && lane === 'fire') {
        controllerRef.current?.setInput({firePressed: true, fireHeld: true})
      }
    },
    [isFireHeld, updateHeldInput],
  )

  const releaseInput = useCallback(
    (lane: InputLane, source: string) => {
      activeInputsRef.current[lane].delete(source)
      updateHeldInput()
    },
    [updateHeldInput],
  )

  const setAimInput = useCallback(
    (source: AimInputSource, aim: AimVector | null, fireHeld: boolean) => {
      const wasFireHeld = isFireHeld()
      if (aim === null && !fireHeld) {
        activeAimInputsRef.current.delete(source)
      } else {
        activeAimInputsRef.current.set(source, {aim, fireHeld})
      }
      updateHeldInput()
      if (!wasFireHeld && isFireHeld()) {
        controllerRef.current?.setInput({firePressed: true, fireHeld: true})
      }
    },
    [isFireHeld, updateHeldInput],
  )

  const pauseGame = useCallback(
    (reason = 'manuale') => {
      if (snapshotRef.current?.phase !== 'playing' && snapshotRef.current?.phase !== 'dying') return
      releaseAllInputs()
      controllerRef.current?.pause(reason)
      audioRef.current?.pause()
      setAnnouncement('Partita in pausa. Premi Riprendi quando sei pronto.')
    },
    [releaseAllInputs],
  )

  const {displayMode, isDesktopFullscreenEligible, enterDesktopFullscreen, exitDesktopFullscreen} =
    useGameFullscreen({
      shellRef: rootRef,
      onFullscreenExit: () => {
        pauseGame('uscita dallo schermo intero')
        setAnnouncement('Schermo intero chiuso. La partita resta in pausa.')
      },
    })

  const isFullscreen = displayMode !== 'inline'

  useEffect(() => {
    const viewportMode = isFullscreen ? 'adaptive-wide' : 'portrait'
    viewportModeRef.current = viewportMode
    controllerRef.current?.setViewportMode(viewportMode)
  }, [isFullscreen])

  const resumeGame = useCallback(() => {
    controllerRef.current?.resume()
    if (audioEnabledRef.current) {
      const available = audioRef.current?.resume() ?? false
      setAudioAvailable(available)
    }
    setAnnouncement('La risalita continua.')
    window.requestAnimationFrame(() => stageRef.current?.focus({preventScroll: true}))
  }, [])

  const setGamepadMove = useCallback(
    (moveX: -1 | 0 | 1) => {
      const active = activeInputsRef.current
      active.left.delete('gamepad:move:left')
      active.right.delete('gamepad:move:right')
      if (moveX < 0) active.left.add('gamepad:move:left')
      if (moveX > 0) active.right.add('gamepad:move:right')
      updateHeldInput()
    },
    [updateHeldInput],
  )

  const setGamepadJump = useCallback(
    (held: boolean) => {
      if (held) pressInput('jump', 'gamepad:jump')
      else releaseInput('jump', 'gamepad:jump')
    },
    [pressInput, releaseInput],
  )

  const setGamepadAim = useCallback(
    (aim: AimVector | null, fireHeld: boolean) => {
      setAimInput('gamepad:aim', aim, fireHeld)
    },
    [setAimInput],
  )

  const toggleGamepadPause = useCallback(() => {
    if (snapshotRef.current?.phase === 'paused') resumeGame()
    else pauseGame('joypad')
  }, [pauseGame, resumeGame])

  const handleGamepadConnection = useCallback((connected: boolean) => {
    setAnnouncement(
      connected
        ? 'Joypad connesso. Stick sinistro per muoverti, A per saltare, stick destro e R2 o RB per i Versi.'
        : 'Joypad disconnesso. Tastiera e controlli touch restano attivi.',
    )
  }, [])

  useGamepadControls({
    enabled: phase === 'playing',
    onMoveChange: setGamepadMove,
    onJumpChange: setGamepadJump,
    onAimChange: setGamepadAim,
    onPauseToggle: toggleGamepadPause,
    onConnectionChange: handleGamepadConnection,
  })

  const handleGameEvent = useCallback((event: GameEvent) => {
    if (event.type === 'audio') {
      if (event.cue === 'complete') {
        audioRef.current?.finish(true)
      } else if (event.cue === 'game-over') {
        audioRef.current?.finish(false)
      } else {
        audioRef.current?.playCue(event.cue)
      }
    }

    const nextFeedback = getEventFeedback(event)
    if (nextFeedback) {
      feedbackIdRef.current += 1
      setFeedback({...nextFeedback, id: feedbackIdRef.current})
      setAnnouncement(nextFeedback.label)
    }
  }, [])

  useEffect(() => {
    const audio = new GameAudioEngine()
    audioRef.current = audio
    return () => {
      audio.dispose()
      audioRef.current = null
    }
  }, [])

  useEffect(() => {
    controllerRef.current?.setReducedMotion(reducedMotion)
  }, [reducedMotion])

  useEffect(() => {
    const parent = canvasHostRef.current
    if (!parent) return

    let cancelled = false
    let createdController: GameController | null = null
    setRuntimeState('loading')

    void import('@/lib/rise-game')
      .then(({createRiseGame}) =>
        createRiseGame({
          parent,
          assist,
          reducedMotion,
          actorScale: window.matchMedia('(hover: none), (pointer: coarse)').matches ? 2 : 1,
          onSnapshot(nextSnapshot) {
            if (cancelled) return
            if (
              nextSnapshot.phase === 'complete' &&
              nextSnapshot.recordEligible &&
              lastSnapshotPhaseRef.current !== 'complete'
            ) {
              addLeaderboardEntry(nextSnapshot.elapsedMs, nextSnapshot.assist)
            }
            lastSnapshotPhaseRef.current = nextSnapshot.phase
            snapshotRef.current = nextSnapshot
            setSnapshot(nextSnapshot)
            setRuntimeState('ready')
          },
          onEvent(event) {
            if (!cancelled) handleGameEvent(event)
          },
        }),
      )
      .then((controller) => {
        createdController = controller
        if (cancelled) {
          controller.destroy()
          return
        }
        controller.setViewportMode(viewportModeRef.current)
        controllerRef.current = controller
        if (process.env.NODE_ENV !== 'production') {
          window.__CANTICA_ZERO_TEST__ = controller
        }
      })
      .catch(() => {
        if (cancelled) return
        setRuntimeError('Il motore non è partito. Ricarica la pagina e riprova.')
        setRuntimeState('error')
      })

    return () => {
      cancelled = true
      releaseAllInputs()
      if (controllerRef.current === createdController) controllerRef.current = null
      if (
        process.env.NODE_ENV !== 'production' &&
        window.__CANTICA_ZERO_TEST__ === createdController
      ) {
        delete window.__CANTICA_ZERO_TEST__
      }
      createdController?.destroy()
    }
    // Assist and reduced motion are updated through the controller after creation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addLeaderboardEntry, handleGameEvent, releaseAllInputs])

  useEffect(() => {
    const keyLane: Record<string, InputLane | undefined> = {
      ArrowLeft: 'left',
      KeyA: 'left',
      ArrowRight: 'right',
      KeyD: 'right',
      ArrowUp: 'jump',
      KeyW: 'jump',
      Space: 'jump',
      KeyJ: 'fire',
    }
    const debugFlyKeyLane: Record<string, InputLane | undefined> = {
      ArrowUp: 'fly-up',
      KeyW: 'fly-up',
      ArrowDown: 'fly-down',
      KeyS: 'fly-down',
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) return

      if (isDevelopment && event.code === 'KeyX' && !event.repeat) {
        event.preventDefault()
        toggleDebugFly()
        return
      }

      if (event.code === 'Escape' && !event.repeat) {
        event.preventDefault()
        if (displayMode !== 'inline') {
          exitDesktopFullscreen()
          pauseGame('uscita dallo schermo intero')
          setAnnouncement('Schermo intero chiuso. La partita resta in pausa.')
        } else {
          pauseGame('tastiera')
        }
        return
      }

      if (event.code === 'KeyP' && !event.repeat) {
        event.preventDefault()
        if (snapshotRef.current?.phase === 'paused') resumeGame()
        else pauseGame('tastiera')
        return
      }
      const lane = debugFly
        ? debugFlyKeyLane[event.code] ?? keyLane[event.code]
        : keyLane[event.code]
      if (lane) {
        event.preventDefault()
        if (!event.repeat) pressInput(lane, `key:${event.code}`)
        return
      }
    }

    const onKeyUp = (event: KeyboardEvent) => {
      const lane = debugFly
        ? debugFlyKeyLane[event.code] ?? keyLane[event.code]
        : keyLane[event.code]
      if (!lane) return
      event.preventDefault()
      releaseInput(lane, `key:${event.code}`)
    }

    const onBlur = () => pauseGame('finestra non attiva')
    const onVisibilityChange = () => {
      if (document.hidden) pauseGame('scheda non visibile')
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onBlur)
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [
    debugFly,
    displayMode,
    exitDesktopFullscreen,
    isDevelopment,
    pauseGame,
    pressInput,
    releaseInput,
    resumeGame,
    toggleDebugFly,
  ])

  useGSAP(
    () => {
      if (!overlayRef.current) return
      gsap.fromTo(
        overlayRef.current,
        {autoAlpha: 0, y: reducedMotion ? 0 : 18},
        {
          autoAlpha: 1,
          y: 0,
          duration: reducedMotion ? 0.01 : 0.42,
          ease: 'power3.out',
          clearProps: 'transform',
        },
      )
    },
    {scope: rootRef, dependencies: [phase, runtimeState, reducedMotion], revertOnUpdate: true},
  )

  useGSAP(
    () => {
      if (!feedback || !feedbackRef.current) return
      gsap
        .timeline()
        .fromTo(
          feedbackRef.current,
          {autoAlpha: 0, scale: reducedMotion ? 1 : 0.92, y: reducedMotion ? 0 : 12},
          {autoAlpha: 1, scale: 1, y: 0, duration: reducedMotion ? 0.01 : 0.16},
        )
        .to(feedbackRef.current, {
          autoAlpha: 0,
          duration: reducedMotion ? 0.1 : 0.28,
          delay: 0.7,
        })
    },
    {scope: rootRef, dependencies: [feedback?.id, reducedMotion], revertOnUpdate: true},
  )

  useEffect(() => {
    if (phase === 'paused' || phase === 'game-over' || phase === 'complete') {
      window.requestAnimationFrame(() => {
        overlayRef.current
          ?.querySelector<HTMLElement>("button, a, [tabindex='-1']")
          ?.focus({preventScroll: true})
      })
    }
  }, [phase])

  const startGame = () => {
    if (!controllerRef.current) return
    const available = audioEnabledRef.current ? (audioRef.current?.begin() ?? false) : true
    const enteredFullscreen = enterDesktopFullscreen()
    setAudioAvailable(available)
    controllerRef.current.resume()
    setAnnouncement(
      enteredFullscreen
        ? 'Schermo intero attivo. Canto IX, Giudecca. Premi Escape per uscire e mettere in pausa.'
        : 'Canto IX. Giudecca. La risalita comincia.',
    )
    window.requestAnimationFrame(() => stageRef.current?.focus({preventScroll: true}))
  }

  const restartGame = (mode: 'full-run' | 'continue-act') => {
    releaseAllInputs()
    lastSnapshotPhaseRef.current = null
    controllerRef.current?.restart(mode)
    if (audioEnabledRef.current) {
      const available = audioRef.current?.begin() ?? false
      setAudioAvailable(available)
    }
    setAnnouncement(
      mode === 'continue-act'
        ? 'Tre vite ripristinate. Questa run non vale per il record.'
        : 'Nuova Cantica. Il cronometro riparte dal fondo.',
    )
    window.requestAnimationFrame(() => stageRef.current?.focus({preventScroll: true}))
  }

  const toggleAssist = () => {
    if (!canChangeMode) return
    const nextAssist = !assist
    setAssist(nextAssist)
    controllerRef.current?.setAssist(nextAssist)
    setAnnouncement(
      nextAssist
        ? 'Modalità Assistita attiva: appigli più generosi e Rumore più lento.'
        : 'Modalità Standard attiva.',
    )
  }

  const toggleAudio = () => {
    const enabled = !audioEnabled
    setAudioEnabled(enabled)
    audioEnabledRef.current = enabled
    const available = audioRef.current?.setEnabled(enabled) ?? false
    setAudioAvailable(available)
    if (enabled && isPlaying) audioRef.current?.resume()
  }

  const toggleFullscreen = () => {
    if (isFullscreen) {
      exitDesktopFullscreen()
      return
    }

    if (enterDesktopFullscreen()) {
      setAnnouncement('Schermo intero attivo. Premi Escape per uscire e mettere in pausa.')
    }
    if (snapshotRef.current?.phase === 'playing') {
      window.requestAnimationFrame(() => stageRef.current?.focus({preventScroll: true}))
    }
  }

  const setTouchAim = useCallback(
    (aim: AimVector | null, fireHeld: boolean) => {
      setAimInput('touch:aim', aim, fireHeld)
    },
    [setAimInput],
  )

  const resolveMouseAim = useCallback((clientX: number, clientY: number) => {
    return controllerRef.current?.resolvePointerAim(clientX, clientY) ?? null
  }, [])

  const releaseMouseFire = useCallback(() => {
    const aim = activeAimInputsRef.current.get('mouse:aim')?.aim ?? null
    setAimInput('mouse:aim', aim, false)
  }, [setAimInput])

  const bindMouseAim = {
    onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
      if (event.pointerType !== 'mouse') return
      const aim = resolveMouseAim(event.clientX, event.clientY)
      if (!aim) return
      const wasFiring = activeAimInputsRef.current.get('mouse:aim')?.fireHeld ?? false
      setAimInput('mouse:aim', aim, wasFiring && (event.buttons & 1) === 1)
    },
    onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
      if (
        event.pointerType !== 'mouse' ||
        event.button !== 0 ||
        snapshotRef.current?.phase !== 'playing'
      ) {
        return
      }
      const aim = resolveMouseAim(event.clientX, event.clientY)
      if (!aim) return
      event.preventDefault()
      setAimInput('mouse:aim', aim, true)
      stageRef.current?.focus({preventScroll: true})
    },
    onPointerLeave(event: React.PointerEvent<HTMLDivElement>) {
      if (event.pointerType === 'mouse') releaseMouseFire()
    },
    onPointerCancel(event: React.PointerEvent<HTMLDivElement>) {
      if (event.pointerType === 'mouse') releaseMouseFire()
    },
  }

  useEffect(() => {
    const onPointerUp = (event: PointerEvent) => {
      if (event.pointerType === 'mouse' && event.button === 0) releaseMouseFire()
    }
    const onPointerCancel = (event: PointerEvent) => {
      if (event.pointerType === 'mouse') releaseMouseFire()
    }

    window.addEventListener('pointerup', onPointerUp, true)
    window.addEventListener('pointercancel', onPointerCancel, true)
    return () => {
      window.removeEventListener('pointerup', onPointerUp, true)
      window.removeEventListener('pointercancel', onPointerCancel, true)
    }
  }, [releaseMouseFire])

  const bindPointer = (lane: InputLane) => ({
    onPointerDown(event: React.PointerEvent<HTMLButtonElement>) {
      event.preventDefault()
      try {
        event.currentTarget.setPointerCapture(event.pointerId)
      } catch {
        // Some synthetic or already-cancelled pointers cannot be captured.
        // The input token still guarantees a matching release path.
      }
      pressInput(lane, `pointer:${event.pointerId}:${lane}`)
    },
    onPointerUp(event: React.PointerEvent<HTMLButtonElement>) {
      releaseInput(lane, `pointer:${event.pointerId}:${lane}`)
    },
    onPointerCancel(event: React.PointerEvent<HTMLButtonElement>) {
      releaseInput(lane, `pointer:${event.pointerId}:${lane}`)
    },
    onLostPointerCapture(event: React.PointerEvent<HTMLButtonElement>) {
      releaseInput(lane, `pointer:${event.pointerId}:${lane}`)
    },
    onKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
      if ((event.code !== 'Space' && event.code !== 'Enter') || event.repeat) return
      event.preventDefault()
      pressInput(lane, `button:${event.code}:${lane}`)
    },
    onKeyUp(event: React.KeyboardEvent<HTMLButtonElement>) {
      if (event.code !== 'Space' && event.code !== 'Enter') return
      event.preventDefault()
      releaseInput(lane, `button:${event.code}:${lane}`)
    },
    disabled: phase !== 'playing',
  })

  const bossPercent = snapshot?.boss
    ? Math.max(0, Math.min(100, (snapshot.boss.health / snapshot.boss.maxHealth) * 100))
    : 0

  return (
    <section
      className={styles.game}
      ref={rootRef}
      id="cantica-game-shell"
      data-testid="rise-game-shell"
      data-display-mode={displayMode}
      aria-label="Cantica Zero">
      <p className={styles.srOnly} aria-live="polite" aria-atomic="true">
        {announcement}
      </p>

      <div className={styles.toolbar} data-testid="rise-game-toolbar">
        <label className={styles.nicknameControl} htmlFor="cantica-nickname">
          <span>Nome</span>
          <input
            id="cantica-nickname"
            className={styles.nicknameInput}
            maxLength={20}
            value={nickname}
            onChange={(event) => setNicknameState(event.currentTarget.value)}
            onBlur={(event) => commitNickname(event.currentTarget.value)}
          />
        </label>
        <button
          type="button"
          className={styles.toolButton}
          aria-pressed={assist}
          disabled={!canChangeMode || runtimeState !== 'ready'}
          onClick={toggleAssist}>
          Assistita {assist ? 'on' : 'off'}
        </button>
        <button
          type="button"
          className={styles.toolButton}
          aria-pressed={audioEnabled}
          onClick={toggleAudio}>
          Audio {audioEnabled ? 'on' : 'off'}
        </button>
        {isDevelopment ? (
          <button
            type="button"
            className={styles.toolButton}
            aria-pressed={debugFly}
            disabled={runtimeState !== 'ready'}
            onClick={toggleDebugFly}>
            Volare DEV {debugFly ? 'on' : 'off'}
          </button>
        ) : null}
        {isDesktopFullscreenEligible ? (
          <button
            type="button"
            className={`${styles.toolButton} ${styles.fullscreenButton}`}
            data-testid="rise-game-fullscreen-toggle"
            aria-label={isFullscreen ? 'Esci dallo schermo intero' : 'Attiva schermo intero'}
            aria-pressed={isFullscreen}
            onClick={toggleFullscreen}>
            {isFullscreen ? 'Esci fullscreen' : 'Schermo intero'}
          </button>
        ) : null}
        <button
          type="button"
          className={styles.toolButton}
          disabled={phase !== 'playing' && phase !== 'dying'}
          aria-label="Metti in pausa"
          onClick={() => pauseGame()}>
          Pausa
        </button>
      </div>

      <div className={styles.hud} aria-label="Stato della partita">
        <div className={styles.hudMetric}>
          <span>Tempo</span>
          <strong>{formatTime(snapshot?.elapsedMs ?? 0)}</strong>
        </div>
        <div className={styles.hudMetric}>
          <span>Quota</span>
          <strong>{formatQuota(snapshot?.quota)}</strong>
        </div>
        <div className={styles.hudMetric}>
          <span>Vite</span>
          <strong aria-label={`${snapshot?.lives ?? 3} vite`}>
            {'◆'.repeat(snapshot?.lives ?? 3)}
            <i>{'◇'.repeat(3 - (snapshot?.lives ?? 3))}</i>
          </strong>
        </div>
        <div className={styles.hudMetric}>
          <span>Voce</span>
          <strong>{String(snapshot?.voices ?? 0).padStart(2, '0')}</strong>
        </div>
      </div>

      <div
        ref={stageRef}
        className={styles.stage}
        data-testid="rise-game-stage"
        data-act={snapshot?.actIndex ?? 0}
        tabIndex={-1}
        role="application"
        aria-roledescription="platform-shooter verticale"
        aria-label="Cantica Zero. Sali dal nono al primo cerchio."
        aria-describedby="cantica-controls">
        <div
          ref={canvasHostRef}
          className={styles.canvasHost}
          data-testid="rise-game-pointer-surface"
          aria-hidden={runtimeState === 'error'}
          {...bindMouseAim}
        />

        <header className={styles.chapter} aria-hidden="true">
          <span>
            ATTO {(snapshot?.actIndex ?? 0) + 1} · {circle.act}
          </span>
          <strong>{circle.label}</strong>
        </header>

        <div
          className={styles.breath}
          aria-label={`Fiato ${Math.round(snapshot?.breath ?? 100)} percento`}>
          <span>FIATO</span>
          <b>
            <i style={{width: `${Math.round(snapshot?.breath ?? 100)}%`}} />
          </b>
        </div>

        {snapshot?.boss ? (
          <div
            className={styles.bossBar}
            aria-label={`${snapshot.boss.name}, energia ${Math.round(bossPercent)} percento`}>
            <span>{snapshot.boss.name}</span>
            <b>
              <i style={{width: `${bossPercent}%`}} />
            </b>
          </div>
        ) : null}

        <div
          className={styles.feedback}
          data-tone={feedback?.tone ?? 'cyan'}
          ref={feedbackRef}
          aria-hidden="true">
          {feedback?.label}
        </div>

        <p className={styles.rotateNote}>Ruota il telefono per giocare meglio in verticale.</p>

      {runtimeState === 'loading' ? (
        <div className={`${styles.overlay} ${styles.introOverlay}`} ref={overlayRef}>
          <div className={styles.overlayContent}>
            <p className={styles.kicker}>CARICAMENTO / IX CERCHIO</p>
            <h3>Il fondo si apre.</h3>
            <p className={styles.overlayCopy}>Prepariamo pedane, Rumore e Versi.</p>
          </div>
        </div>
      ) : null}

      {runtimeState === 'error' ? (
        <div className={`${styles.overlay} ${styles.resultOverlay}`} ref={overlayRef}>
          <div className={styles.overlayContent} role="alert" tabIndex={-1}>
            <p className={styles.kicker}>ERRORE DI RISALITA</p>
            <h3>La selva non risponde.</h3>
            <p className={styles.overlayCopy}>{runtimeError}</p>
            <button
              className={styles.primaryButton}
              type="button"
              onClick={() => window.location.reload()}>
              Ricarica
            </button>
          </div>
        </div>
      ) : null}

      {runtimeState === 'ready' && phase === 'ready' ? (
        <div className={`${styles.overlay} ${styles.introOverlay}`} ref={overlayRef}>
          <div className={styles.overlayContent} tabIndex={-1}>
            <p className={styles.kicker}>CANTICA ZERO / IX → I</p>
            <h3>Dal fondo alle stelle.</h3>
            <p className={styles.overlayCopy}>
              Corri, salta e mira a 360°: mouse e click su desktop, due stick dedicati su touch. Tre
              vite, tre Atti, nove cerchi.
            </p>
            <button className={styles.primaryButton} type="button" onClick={startGame}>
              Inizia la Cantica
            </button>
            <p className={styles.modeNote}>
              {assist ? 'Assistita · record separato' : 'Standard · record completo'}
            </p>
          </div>
        </div>
      ) : null}

      {phase === 'paused' ? (
        <div className={`${styles.overlay} ${styles.pauseOverlay}`} ref={overlayRef}>
          <div
            className={styles.overlayContent}
            role="dialog"
            aria-modal="true"
            aria-label="Partita in pausa"
            tabIndex={-1}>
            <p className={styles.kicker}>PAUSA / {circle.label}</p>
            <h3>Riprendi fiato.</h3>
            <p className={styles.overlayCopy}>
              Il cronometro è fermo. La via resta dove l’hai lasciata.
            </p>
            <button className={styles.primaryButton} type="button" onClick={resumeGame}>
              Riprendi
            </button>
            <button
              className={styles.secondaryButton}
              type="button"
              onClick={() => restartGame('full-run')}>
              Ricomincia la Cantica
            </button>
          </div>
        </div>
      ) : null}

      {phase === 'game-over' ? (
        <div className={`${styles.overlay} ${styles.resultOverlay}`} ref={overlayRef}>
          <div
            className={styles.overlayContent}
            role="dialog"
            aria-modal="true"
            aria-label="Partita terminata"
            tabIndex={-1}>
            <p className={styles.kicker}>
              VITE ESAURITE / ATTO {(snapshot?.checkpointActIndex ?? 0) + 1}
            </p>
            <h3>La via si chiude.</h3>
            <p className={styles.resultStat}>
              {formatTime(snapshot?.elapsedMs)} · {snapshot?.voices ?? 0} VOCI
            </p>
            <p className={styles.overlayCopy}>
              Continua dall’Atto senza record, oppure riparti da Giudecca con una run pulita.
            </p>
            <button
              className={styles.primaryButton}
              type="button"
              onClick={() => restartGame('continue-act')}>
              Continua dall’Atto
            </button>
            <button
              className={styles.secondaryButton}
              type="button"
              onClick={() => restartGame('full-run')}>
              Ricomincia la Cantica
            </button>
          </div>
        </div>
      ) : null}

      {phase === 'complete' ? (
        <div className={`${styles.overlay} ${styles.completeOverlay}`} ref={overlayRef}>
          <div
            className={styles.overlayContent}
            role="dialog"
            aria-modal="true"
            aria-label="Cantica completa"
            tabIndex={-1}>
            <p className={styles.kicker}>
              {snapshot?.recordEligible ? 'CANTICA COMPLETA' : 'RISALITA COMPLETA · FUORI RECORD'}
            </p>
            <h3>Rivedi le stelle.</h3>
            <p className={styles.resultStat}>
              {formatTime(snapshot?.elapsedMs)} · {snapshot?.strofe ?? 0} STROFE
            </p>
            {modeLeaderboard.length > 0 ? (
              <section className={styles.leaderboard}>
                <p className={styles.leaderboardTitle}>
                  Classifica {snapshot?.assist ? 'assistita' : 'standard'}
                </p>
                <ol className={styles.leaderboardList}>
                  {modeLeaderboard.map((entry, index) => (
                    <li key={entry.id}>
                      <span>{index + 1}.</span>
                      <span>{entry.nickname}</span>
                      <span>{formatTime(entry.elapsedMs)}</span>
                    </li>
                  ))}
                </ol>
              </section>
            ) : null}
            <p className={styles.overlayCopy}>
              Miglior tempo {assist ? 'Assistita' : 'Standard'}: {formatTime(snapshot?.bestMs)}.
            </p>
            <button
              className={styles.primaryButton}
              type="button"
              onClick={() => restartGame('full-run')}>
              Nuova Cantica
            </button>
            <Link className={styles.secondaryButton} href="/#progetto">
              Torna al viaggio
            </Link>
          </div>
        </div>
      ) : null}
      </div>

      <div className={styles.touchControls} role="group" aria-label="Comandi touch">
        <div className={styles.movePad}>
          <MoveJoystick
            className={styles.moveJoystick}
            disabled={phase !== 'playing'}
            onMoveChange={setTouchMove}
          />
          <button
            className={styles.jumpButton}
            type="button"
            aria-label="Salta"
            {...bindPointer('jump')}>
            SALTA
          </button>
        </div>
        <div className={styles.actionPad}>
          <AimJoystick
            className={styles.aimJoystick}
            disabled={phase !== 'playing'}
            onAimChange={setTouchAim}
          />
        </div>
      </div>

      <div className={styles.statusLine} data-testid="rise-game-status" aria-hidden="true">
        <span>{snapshot?.statusText ?? 'La Cantica attende.'}</span>
        <span>
          {snapshot?.recordEligible === false
            ? 'FUORI RECORD'
            : `BEST ${formatTime(snapshot?.bestMs)}`}
        </span>
      </div>

      <dl
        className={styles.instructions}
        id="cantica-controls"
        data-testid="rise-game-instructions">
        <div>
          <dt>Muovi</dt>
          <dd>A/D · ← →</dd>
        </div>
        <div>
          <dt>Salta</dt>
          <dd>W · ↑ · Spazio</dd>
        </div>
        <div>
          <dt>Verso</dt>
          <dd>Mouse mira · click spara · J · Stick R + R2/RB</dd>
        </div>
        {isDevelopment ? (
          <div>
            <dt>DEBUG volo</dt>
            <dd>X per attivare · W/S o ↑/↓ per muoverti</dd>
          </div>
        ) : null}
        <div>
          <dt>Pausa</dt>
          <dd>{isFullscreen ? 'P pausa · Esc esce e mette in pausa' : 'P · Esc'}</dd>
        </div>
      </dl>

      {!audioAvailable && audioEnabled ? (
        <p className={styles.audioNotice} role="status">
          Audio non disponibile in questo browser.
        </p>
      ) : null}
    </section>
  )
}
