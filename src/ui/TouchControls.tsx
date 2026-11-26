import { useRef, useState } from 'react'
import { useGame } from '../store'

type Dir = { forward: boolean; back: boolean; left: boolean; right: boolean }
const NONE: Dir = { forward: false, back: false, left: false, right: false }
const DEAD = 0.28 // fraction of the radius before a direction engages
const KNOB_TRAVEL = 0.5 // how far the knob follows the thumb, as a fraction of the radius

// One circular pad for the right thumb: up/down/left/right around a ring.
// Touch or drag anywhere on it; diagonals work, so you can accelerate and steer together.
export function TouchControls() {
  const setInput = useGame((s) => s.setInput)
  const pad = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)
  const [dir, setDir] = useState<Dir>(NONE)
  const [knob, setKnob] = useState<[number, number]>([0, 0])

  const apply = (e: React.PointerEvent) => {
    const r = pad.current!.getBoundingClientRect()
    const radius = r.width / 2
    let dx = (e.clientX - (r.left + radius)) / radius
    let dy = (e.clientY - (r.top + radius)) / radius
    const len = Math.hypot(dx, dy)
    if (len > 1) {
      dx /= len
      dy /= len
    }
    const next = { forward: dy < -DEAD, back: dy > DEAD, left: dx < -DEAD, right: dx > DEAD }
    setInput(next)
    setDir(next)
    setKnob([dx * KNOB_TRAVEL * radius, dy * KNOB_TRAVEL * radius])
  }
  const release = () => {
    dragging.current = false
    setInput(NONE)
    setDir(NONE)
    setKnob([0, 0])
  }

  return (
    <div className="touch">
      <div
        ref={pad}
        className="dpad"
        role="group"
        aria-label="Steer: touch the top to go, bottom to slow and reverse, sides to turn"
        onPointerDown={(e) => {
          dragging.current = true
          // Capture keeps the drag alive when the thumb slides off the pad
          try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* not capturable; moves still work over the pad */ }
          apply(e)
        }}
        onPointerMove={(e) => { if (dragging.current) apply(e) }}
        onPointerUp={release}
        onPointerCancel={release}
        onContextMenu={(e) => e.preventDefault()}
      >
        <span className={`dpad-arrow dpad-up ${dir.forward ? 'on' : ''}`}>▲</span>
        <span className={`dpad-arrow dpad-down ${dir.back ? 'on' : ''}`}>▼</span>
        <span className={`dpad-arrow dpad-left ${dir.left ? 'on' : ''}`}>◀</span>
        <span className={`dpad-arrow dpad-right ${dir.right ? 'on' : ''}`}>▶</span>
        <span className="dpad-knob" style={{ transform: `translate(calc(-50% + ${knob[0]}px), calc(-50% + ${knob[1]}px))` }} />
      </div>
    </div>
  )
}
