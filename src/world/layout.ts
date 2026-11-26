// Backwater layout shared by the water, islands, buildings, GPS and minimap.
// A round lagoon ringed by coconut-lined shore. The story route is a clear channel that circles
// a large central island; each stop is a jetty on that channel, with its island on one side.
import { zones, type Zone } from '../content'

export const TAU = Math.PI * 2
export const CHANNEL_R = 85 // radius of the story channel (the GPS route follows it)
export const CHANNEL_HALF = 9 // kept clear of islands either side of the channel
export const SHORE_R = 128 // inner edge of the surrounding land
export const CENTRAL_R = 40 // the big island in the middle
export const WATER_Y = 0

// Angle around the lagoon centre, from +z (south) toward +x (east)
export const angleOf = (x: number, z: number) => Math.atan2(x, z)
export const onCircle = (a: number, r: number): [number, number] => [Math.sin(a) * r, Math.cos(a) * r]

// Start just south of centre on the channel, pointing west into the sunset (toward chapter 1)
export const START: [number, number, number] = [0, 0, CHANNEL_R]
export const START_HEADING = -Math.PI / 2

export function zoneLayout(zone: Zone) {
  const [x, z] = zone.position
  const [w, h, d] = zone.size
  const [padX, padZ] = zone.pad
  const dist = Math.hypot(padX - x, padZ - z)
  return {
    id: zone.id,
    x, z, w, h, d, padX, padZ, dist,
    island: zone.island,
    yaw: Math.atan2(padX - x, padZ - z), // turns the building's front (+z) toward its jetty
  }
}
export const layouts = zones.map(zoneLayout)

// Small decorative islets off the channel, each with a palm or two
export type Islet = { x: number; z: number; r: number; seed: number }
function makeIslets(): Islet[] {
  let s = 4242
  const rand = () => ((s = (s * 16807) % 2147483647) / 2147483647)
  const out: Islet[] = []
  for (let tries = 0; out.length < 16 && tries < 2000; tries++) {
    const a = rand() * TAU
    const rr = CENTRAL_R + 6 + rand() * (SHORE_R - CENTRAL_R - 14)
    const r = 2.5 + rand() * 4.5
    const [x, z] = onCircle(a, rr)
    if (Math.abs(rr - CHANNEL_R) < CHANNEL_HALF + r + 2) continue
    if (layouts.some((l) => Math.hypot(x - l.x, z - l.z) < l.island + r + 5)) continue
    if (out.some((o) => Math.hypot(x - o.x, z - o.z) < o.r + r + 6)) continue
    out.push({ x, z, r, seed: Math.floor(rand() * 1e6) })
  }
  return out
}
export const ISLETS = makeIslets()

// Every island as a circle, for collisions, scenery placement and the minimap
export const ISLANDS: { x: number; z: number; r: number }[] = [
  { x: 0, z: 0, r: CENTRAL_R },
  ...layouts.map((l) => ({ x: l.x, z: l.z, r: l.island })),
  ...ISLETS,
]

// Island outlines wobble around their radius; shared by the island meshes and the water's shoreline
export function wobble(r: number, seed: number) {
  return (a: number) => r * (1 + 0.07 * Math.sin(3 * a + seed) + 0.045 * Math.sin(7 * a + seed * 2.3) + 0.025 * Math.sin(13 * a + seed))
}
export const islandSeed = (k: number) => k * 1.7 + 0.3
export const islandBevel = (r: number) => Math.min(2.4, r * 0.35) // the beach slopes this far out past the outline
export const SHORE_OUTLINE = SHORE_R + 1.5
export const SHORE_BEVEL = 3

// Where the land actually meets the water (the outline plus its sloping beach), as a distance from
// the centre in a given direction. Everything that touches the shoreline uses these: collisions,
// the water's foam and shallows, scenery along the banks and the minimap.
// (The land meshes are extruded from shapes whose y axis becomes world -z, hence atan2(-dz, dx).)
const islandOutlines = ISLANDS.map((i, k) => ({ R: wobble(i.r, islandSeed(k)), bevel: islandBevel(i.r) }))
export const islandEdge = (k: number, dx: number, dz: number) => islandOutlines[k].R(Math.atan2(-dz, dx)) + islandOutlines[k].bevel
const shoreOutline = wobble(SHORE_OUTLINE, 7)
export const shoreEdge = (x: number, z: number) => shoreOutline(Math.atan2(-z, x)) - SHORE_BEVEL
export const shoreAt = (a: number) => shoreEdge(Math.sin(a), Math.cos(a)) // by angle, as in onCircle

export const onLand = (x: number, z: number, margin = 0) =>
  Math.hypot(x, z) > shoreEdge(x, z) - margin ||
  ISLANDS.some((i, k) => Math.hypot(x - i.x, z - i.z) < islandEdge(k, x - i.x, z - i.z) + margin)

export const ISLAND_TOP = 0.7 // height of island ground above the water

// Backwater life on the water: shared by the scene (what you see) and collisions (what you bump into)
export type Placed = { x: number; z: number; yaw: number; phase: number }
function makeLife() {
  let s = 321
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647)
  // Fishing nets lean out from the central island and the shore, away from the channel
  const nets: Placed[] = [
    { a: 3.6, base: CENTRAL_R - 0.5, out: 1 },
    { a: 5.8, base: CENTRAL_R - 0.5, out: 1 },
    { a: 2.05, base: SHORE_R + 0.5, out: -1 },
  ].map(({ a, base, out }, i) => {
    const [x, z] = onCircle(a, base)
    return { x, z, yaw: out > 0 ? a : a + Math.PI, phase: i * 2.1 }
  })
  // Houseboats moored along the central island, hulls lying along the shore
  const houseboats: Placed[] = [0.9, 2.6, 4.4].map((a, i) => {
    const [x, z] = onCircle(a, CENTRAL_R + 6)
    return { x, z, yaw: a, phase: i * 1.3 }
  })
  const canoes: Placed[] = []
  for (let tries = 0; canoes.length < 6 && tries < 500; tries++) {
    const a = r() * TAU
    const rr = r() < 0.5 ? CENTRAL_R + 12 + r() * 18 : CHANNEL_R + CHANNEL_HALF + 6 + r() * 22
    const [x, z] = onCircle(a, rr)
    if (onLand(x, z, 4) || Math.abs(rr - CHANNEL_R) < CHANNEL_HALF + 3) continue
    canoes.push({ x, z, yaw: r() * TAU, phase: r() * 10 })
  }
  return { nets, houseboats, canoes }
}
export const LIFE = makeLife()
export const NET_REACH = 10.5 // how far a fishing net's dipping end sits out over the water

// Each stop's jetty runs from the island edge toward its marker (distances from the building centre)
export const jettySpan = (l: ReturnType<typeof zoneLayout>) => ({ from: l.island - 2, to: l.dist - 3.3 })
export const POST_OFFSET = 3.4 // mooring post, from the marker centre toward the island
