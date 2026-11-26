// GPS: the way to a stop is along the story channel, a circle round the central island.
// Join the channel at the nearest point, follow it the short way round, and arrive at the jetty.
import { angleOf, CHANNEL_R, onCircle, TAU } from './layout'

export type P = [number, number]
export type Route = { points: P[]; length: number }

const STEP = (4 * Math.PI) / 180 // one point every 4 degrees along the channel

export function planRoute(x: number, z: number, tx: number, tz: number): Route | null {
  const from = angleOf(x, z)
  const to = angleOf(tx, tz)
  let delta = ((to - from) % TAU + TAU) % TAU
  if (delta > Math.PI) delta -= TAU // go the shorter way round
  const points: P[] = [[x, z]]
  const n = Math.max(1, Math.ceil(Math.abs(delta) / STEP))
  for (let i = 0; i <= n; i++) points.push(onCircle(from + (delta * i) / n, CHANNEL_R))
  points.push([tx, tz])
  let length = 0
  for (let i = 1; i < points.length; i++) length += Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1])
  return { points, length }
}

// Latest route, shared with the minimap and the GPS readout
export const currentRoute: { route: Route | null } = { route: null }
