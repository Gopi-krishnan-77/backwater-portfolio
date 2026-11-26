import { create } from 'zustand'
import { zones } from './content'
import { setSoundOn } from './audio'

type Input = { forward: boolean; back: boolean; left: boolean; right: boolean; brake: boolean }

export const PAINTS = [
  { name: 'Teak', color: '#7a4a2a' },
  { name: 'Kerala green', color: '#1f7a4a' },
  { name: 'Sunset orange', color: '#e8622a' },
  { name: 'Cream', color: '#efe6d2' },
  { name: 'Indigo', color: '#2a3a6e' },
]

type State = {
  input: Input
  setInput: (patch: Partial<Input>) => void
  started: boolean // past the title card
  start: () => void
  activeZone: string | null
  setActiveZone: (id: string | null) => void
  visited: string[]
  arrival: { id: string; at: number } | null // first visit to a stop, for the chapter title card
  target: string | null // where the GPS is routing to
  setTarget: (id: string | null) => void
  paint: string
  setPaint: (color: string) => void
  ready: boolean // the 3D scene (and its physics engine) has loaded
  setReady: () => void
  readMode: boolean
  setReadMode: (v: boolean) => void
  resetTick: number
  reset: () => void
  autopilot: boolean // the boat sails itself to the GPS destination
  setAutopilot: (on: boolean) => void
  dockUntil: number // after autopilot arrives, brake to a stop until this time (ms)
  finale: boolean // the closing aerial shot and card, after every stop
  night: boolean // dusk has fallen (it stays once the finale has played)
  finaleSeen: boolean
  setFinale: (on: boolean) => void
  sound: boolean
  setSound: (on: boolean) => void
}

export const NO_INPUT: Input = { forward: false, back: false, left: false, right: false, brake: false }

// The story continues in order: the next unvisited stop after this one, wrapping round to any skipped earlier
export function nextInStory(fromId: string | null, visited: string[]) {
  const i = fromId ? zones.findIndex((z) => z.id === fromId) : -1
  const ordered = [...zones.slice(i + 1), ...zones.slice(0, i + 1)]
  return ordered.find((z) => !visited.includes(z.id))?.id ?? null
}

export const useGame = create<State>((set) => ({
  input: NO_INPUT,
  // Touching any control takes the helm back from the autopilot
  setInput: (patch) =>
    set((s) => {
      const any = Object.values(patch).some(Boolean)
      // Steering also closes the finale card: you just keep sailing, in the dusk
      return { input: { ...s.input, ...patch }, autopilot: any ? false : s.autopilot, finale: any ? false : s.finale }
    }),
  started: false,
  start: () => set((s) => (s.started ? {} : { started: true, target: nextInStory(null, s.visited) })),
  activeZone: null,
  setActiveZone: (id) =>
    set((s) => {
      // Sailing away from the last stop you hadn't seen ends the story: dusk and the finale
      if (!id) {
        const done = s.activeZone && !s.finaleSeen && zones.every((z) => s.visited.includes(z.id))
        return done ? { activeZone: null, finale: true, night: true, finaleSeen: true, autopilot: false } : { activeZone: null }
      }
      const first = !s.visited.includes(id)
      const visited = first ? [...s.visited, id] : s.visited
      // Arriving at the GPS destination moves it on to the next chapter
      const arrived = s.target === id
      const target = arrived || s.target === null ? nextInStory(id, visited) : s.target
      // The autopilot stops at its destination and brakes to a halt so you can read
      const docking = arrived && s.autopilot
      return {
        activeZone: id, visited, target,
        arrival: first ? { id, at: Date.now() } : s.arrival,
        autopilot: docking ? false : s.autopilot,
        dockUntil: docking ? performance.now() + 1800 : s.dockUntil,
      }
    }),
  visited: [],
  arrival: null,
  target: null, // set when the drive starts
  setTarget: (id) => set({ target: id }),
  paint: PAINTS[0].color,
  setPaint: (paint) => set({ paint }),
  ready: false,
  setReady: () => set({ ready: true }),
  readMode: false,
  // Key releases are ignored while reading, so drop any held keys on the way in
  setReadMode: (v) => set({ readMode: v, input: NO_INPUT }),
  resetTick: 0,
  reset: () => set((s) => ({ resetTick: s.resetTick + 1, autopilot: false })),
  autopilot: false,
  setAutopilot: (on) => set((s) => ({ autopilot: on && !!s.target, input: NO_INPUT })),
  dockUntil: 0,
  finale: false,
  night: false,
  finaleSeen: false,
  setFinale: (on) => set(on ? { finale: true, night: true, finaleSeen: true, autopilot: false, input: NO_INPUT } : { finale: false }),
  sound: false,
  setSound: (sound) => {
    setSoundOn(sound) // must run inside the click or key press, or the browser keeps it muted
    set({ sound })
  },
}))
