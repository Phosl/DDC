'use client'

import {useEffect, useRef} from 'react'

type MoveJoystickProps = Readonly<{
  className?: string
  disabled: boolean
  onMoveChange: (moveX: -1 | 0 | 1) => void
}>

const ENGAGE_THRESHOLD = 0.18
const RELEASE_THRESHOLD = 0.1

export function MoveJoystick({className, disabled, onMoveChange}: MoveJoystickProps) {
  const buttonRef = useRef<HTMLButtonElement>(null)
  const pointerIdRef = useRef<number | null>(null)
  const engagedRef = useRef(false)
  const keyboardDirectionsRef = useRef(new Set<-1 | 1>())

  const resetVisual = () => {
    const button = buttonRef.current
    if (!button) return
    button.style.setProperty('--move-x', '0')
    button.style.setProperty('--move-y', '0')
    button.dataset.active = 'false'
  }

  const releaseMove = () => {
    engagedRef.current = false
    resetVisual()
    onMoveChange(0)
  }

  const updateKeyboardMove = () => {
    const directions = keyboardDirectionsRef.current
    const moveX = directions.has(-1) === directions.has(1) ? 0 : directions.has(-1) ? -1 : 1
    const button = buttonRef.current
    if (button) {
      button.style.setProperty('--move-x', String(moveX))
      button.style.setProperty('--move-y', '0')
      button.dataset.active = String(moveX !== 0)
    }
    engagedRef.current = moveX !== 0
    onMoveChange(moveX)
  }

  const updatePointerMove = (button: HTMLButtonElement, clientX: number, clientY: number) => {
    const bounds = button.getBoundingClientRect()
    const radius = Math.max(1, Math.min(bounds.width, bounds.height) / 2)
    const rawX = (clientX - (bounds.left + bounds.width / 2)) / radius
    const rawY = (clientY - (bounds.top + bounds.height / 2)) / radius
    const magnitude = Math.hypot(rawX, rawY)
    const nextEngaged = engagedRef.current
      ? magnitude >= RELEASE_THRESHOLD
      : magnitude >= ENGAGE_THRESHOLD
    const scale = magnitude > 1 ? 1 / magnitude : 1
    const x = rawX * scale
    const y = rawY * scale
    const moveX = nextEngaged ? (rawX < -0.2 ? -1 : rawX > 0.2 ? 1 : 0) : 0

    button.style.setProperty('--move-x', String(nextEngaged ? x : 0))
    button.style.setProperty('--move-y', String(nextEngaged ? y : 0))
    button.dataset.active = String(nextEngaged)
    engagedRef.current = nextEngaged
    onMoveChange(moveX)
  }

  useEffect(() => {
    if (disabled) {
      pointerIdRef.current = null
      keyboardDirectionsRef.current.clear()
      releaseMove()
    }
    // The callback is deliberately excluded: disabling is the state transition
    // that must cancel an in-flight gesture.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disabled])

  return (
    <button
      ref={buttonRef}
      className={className}
      type="button"
      aria-label="Muovi a sinistra e destra con le frecce"
      aria-keyshortcuts="ArrowLeft ArrowRight A D"
      data-testid="move-joystick"
      data-active="false"
      disabled={disabled}
      onContextMenu={(event) => event.preventDefault()}
      onPointerDown={(event) => {
        event.preventDefault()
        if (pointerIdRef.current !== null) return
        keyboardDirectionsRef.current.clear()
        engagedRef.current = false
        pointerIdRef.current = event.pointerId
        try {
          event.currentTarget.setPointerCapture(event.pointerId)
        } catch {
          // Synthetic pointers may not support capture; release handlers remain safe.
        }
        updatePointerMove(event.currentTarget, event.clientX, event.clientY)
      }}
      onPointerMove={(event) => {
        if (pointerIdRef.current !== event.pointerId) return
        event.preventDefault()
        updatePointerMove(event.currentTarget, event.clientX, event.clientY)
      }}
      onPointerUp={(event) => {
        if (pointerIdRef.current !== event.pointerId) return
        event.preventDefault()
        pointerIdRef.current = null
        releaseMove()
      }}
      onPointerCancel={(event) => {
        if (pointerIdRef.current !== event.pointerId) return
        pointerIdRef.current = null
        releaseMove()
      }}
      onLostPointerCapture={(event) => {
        if (pointerIdRef.current !== event.pointerId) return
        pointerIdRef.current = null
        releaseMove()
      }}
      onKeyDown={(event) => {
        const direction =
          event.code === 'ArrowLeft' || event.code === 'KeyA'
            ? -1
            : event.code === 'ArrowRight' || event.code === 'KeyD'
              ? 1
              : null
        if (direction === null) return
        event.preventDefault()
        if (pointerIdRef.current !== null) return
        keyboardDirectionsRef.current.add(direction)
        updateKeyboardMove()
      }}
      onKeyUp={(event) => {
        const direction =
          event.code === 'ArrowLeft' || event.code === 'KeyA'
            ? -1
            : event.code === 'ArrowRight' || event.code === 'KeyD'
              ? 1
              : null
        if (direction === null) return
        event.preventDefault()
        keyboardDirectionsRef.current.delete(direction)
        if (pointerIdRef.current === null) updateKeyboardMove()
      }}
      onBlur={() => {
        keyboardDirectionsRef.current.clear()
        if (pointerIdRef.current === null) releaseMove()
      }}>
      <span aria-hidden="true">MOVE</span>
      <i aria-hidden="true" />
    </button>
  )
}
