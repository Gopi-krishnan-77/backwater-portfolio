import { useEffect } from 'react'
import { NO_INPUT, useGame } from './store'

const map: Record<string, 'forward' | 'back' | 'left' | 'right' | 'brake'> = {
  KeyW: 'forward', ArrowUp: 'forward',
  KeyS: 'back', ArrowDown: 'back',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
  Space: 'brake',
}

export function useKeyboard() {
  useEffect(() => {
    const handle = (down: boolean) => (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (target.closest?.('input, textarea, [contenteditable]')) return
      // Space and Enter press a focused button or link instead of braking
      if ((e.code === 'Space' || e.code === 'Enter') && target.closest?.('button, a')) return
      const { readMode, setInput, reset, started, ready, start } = useGame.getState()
      if (readMode) return
      // On the title card, the usual "go" keys start the drive; nothing else drives yet
      if (!started) {
        if (down && ready && ['Enter', 'Space', 'KeyW', 'ArrowUp'].includes(e.code)) {
          e.preventDefault()
          start()
        }
        return
      }
      if (down && e.code === 'KeyR') return reset()
      if (down && e.code === 'KeyM' && !e.repeat) {
        const { sound, setSound } = useGame.getState()
        return setSound(!sound)
      }
      if (down && e.code === 'KeyT' && !e.repeat) {
        const { autopilot, setAutopilot } = useGame.getState()
        return setAutopilot(!autopilot)
      }
      const key = map[e.code]
      if (!key) return
      e.preventDefault()
      setInput({ [key]: down })
    }
    const onDown = handle(true)
    const onUp = handle(false)
    const onBlur = () => useGame.getState().setInput(NO_INPUT)
    window.addEventListener('keydown', onDown)
    window.addEventListener('keyup', onUp)
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('keydown', onDown)
      window.removeEventListener('keyup', onUp)
      window.removeEventListener('blur', onBlur)
    }
  }, [])
}
