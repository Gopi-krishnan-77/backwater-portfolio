// Lightweight 2D collision for the boat, in place of a physics engine (which was ~770 KB to download).
// The world is flat water, so everything solid is a circle or a rotated box on the x/z plane,
// plus the islands and the shore, which follow the same wobbly outlines the land is drawn from.
// The boat is three overlapping circles along its hull.
import { ISLANDS, islandEdge, layouts, LIFE, NET_REACH, jettySpan, POST_OFFSET, shoreEdge } from './layout'

type Circle = { kind: 'circle'; x: number; z: number; r: number }
type Box = { kind: 'box'; x: number; z: number; hx: number; hz: number; yaw: number; reach: number }
type Shape = Circle | Box

const circle = (x: number, z: number, r: number): Circle => ({ kind: 'circle', x, z, r })
// A box's local x axis is (cos yaw, -sin yaw) and z axis (sin yaw, cos yaw), matching three.js rotation.y
const box = (x: number, z: number, hx: number, hz: number, yaw: number): Box => ({ kind: 'box', x, z, hx, hz, yaw, reach: Math.hypot(hx, hz) })

const SHAPES: Shape[] = [
  ...layouts.flatMap((l) => {
    const { from, to } = jettySpan(l)
    const mid = (from + to) / 2
    const ux = (l.x - l.padX) / l.dist
    const uz = (l.z - l.padZ) / l.dist
    return [
      box(l.x + Math.sin(l.yaw) * mid, l.z + Math.cos(l.yaw) * mid, 1.2, (to - from) / 2, l.yaw),
      circle(l.padX + ux * POST_OFFSET, l.padZ + uz * POST_OFFSET, 0.3),
    ]
  }),
  ...LIFE.houseboats.map((h) => box(h.x, h.z, 6.6, 1.4, h.yaw)),
  ...LIFE.canoes.map((c) => circle(c.x, c.z, 2.4)),
  ...LIFE.nets.map((n) => circle(n.x + Math.sin(n.yaw) * NET_REACH, n.z + Math.cos(n.yaw) * NET_REACH, 3.6)),
]
// The hull may just touch the foam at the water's edge, never ride up the beach
const BEACH_GIVE = 0.3
const ISLAND_REACH = ISLANDS.map((i) => i.r * 1.15 + 2.4) // no outline reaches further than this

const HULL = [-1.75, 0, 1.75] // probe circles along the hull, from stern to bow
const HULL_R = 0.95

// Push the boat out of anything it overlaps and cancel the part of its velocity heading into it,
// so it slides along jetties and banks instead of sticking. Mutates pos and vel.
export function collide(pos: { x: number; z: number }, vel: { x: number; z: number }, heading: number) {
  const fx = Math.sin(heading)
  const fz = Math.cos(heading)
  for (let pass = 0; pass < 2; pass++) {
    for (const o of HULL) {
      const cx = pos.x + fx * o
      const cz = pos.z + fz * o
      const push = (nx: number, nz: number, depth: number) => {
        pos.x += nx * depth
        pos.z += nz * depth
        const into = vel.x * nx + vel.z * nz
        if (into < 0) {
          vel.x -= nx * into
          vel.z -= nz * into
        }
      }
      // The shore all round, and every island: pushed straight out from the centre, which is
      // close enough to the outline's normal for these gentle wobbles
      const d0 = Math.hypot(cx, cz)
      const limit = shoreEdge(cx, cz) + BEACH_GIVE - HULL_R
      if (d0 > limit) push(-cx / d0, -cz / d0, d0 - limit)
      ISLANDS.forEach((i, k) => {
        const dx = cx - i.x
        const dz = cz - i.z
        const d = Math.hypot(dx, dz)
        if (d > ISLAND_REACH[k] + HULL_R || d < 1e-6) return
        const depth = islandEdge(k, dx, dz) - BEACH_GIVE + HULL_R - d
        if (depth > 0) push(dx / d, dz / d, depth)
      })

      for (const s of SHAPES) {
        const dx = cx - s.x
        const dz = cz - s.z
        if (s.kind === 'circle') {
          const d = Math.hypot(dx, dz)
          const depth = s.r + HULL_R - d
          if (depth > 0 && d > 1e-6) push(dx / d, dz / d, depth)
          continue
        }
        if (Math.abs(dx) > s.reach + HULL_R || Math.abs(dz) > s.reach + HULL_R) continue
        const c = Math.cos(s.yaw)
        const sn = Math.sin(s.yaw)
        const lx = dx * c - dz * sn // into the box's frame
        const lz = dx * sn + dz * c
        const qx = Math.max(-s.hx, Math.min(s.hx, lx))
        const qz = Math.max(-s.hz, Math.min(s.hz, lz))
        let nlx = lx - qx
        let nlz = lz - qz
        let d = Math.hypot(nlx, nlz)
        let depth = HULL_R - d
        if (d < 1e-6) {
          // Centre inside the box: leave by the nearest face
          const ex = s.hx - Math.abs(lx)
          const ez = s.hz - Math.abs(lz)
          if (ex < ez) { nlx = Math.sign(lx) || 1; nlz = 0; depth = ex + HULL_R }
          else { nlx = 0; nlz = Math.sign(lz) || 1; depth = ez + HULL_R }
          d = 1
        }
        if (depth <= 0) continue
        nlx /= d
        nlz /= d
        push(nlx * c + nlz * sn, -nlx * sn + nlz * c, depth) // back to world space
      }
    }
  }
}

// Which stop's marker the boat is on. Enter within 4 m of the centre, leave beyond 4.8 m,
// so sitting right on the edge doesn't flicker the panel open and shut.
export function markerAt(x: number, z: number, current: string | null) {
  if (current) {
    const l = layouts.find((k) => k.id === current)
    if (l && Math.hypot(x - l.padX, z - l.padZ) < 4.8) return current
  }
  const hit = layouts.find((l) => Math.hypot(x - l.padX, z - l.padZ) < 4)
  return hit ? hit.id : null
}
