// The eight stops: a Kerala building on each island, a wooden jetty out to the channel,
// a painted signboard, and the glowing marker you steer into.
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  AdditiveBlending, BufferGeometry, CanvasTexture, Color, Float32BufferAttribute, PointsMaterial, DoubleSide, ExtrudeGeometry, MeshStandardMaterial, Object3D, Shape, SRGBColorSpace, TextureLoader,
  type Group, type InstancedMesh, type Mesh, type MeshBasicMaterial,
} from 'three'
import { chapterOf, type Zone } from '../content'
import { useGame } from '../store'
import { foamTexture, bandTexture, facadeTextures, pitchTexture, plankTexture, tileTexture } from './textures'
import { hipRoofGeometry } from './kerala'
import { dusk, windowGlow } from './Atmosphere'
import { ISLAND_TOP, jettySpan, POST_OFFSET, zoneLayout } from './layout'


const M = {
  lime: new MeshStandardMaterial({ color: '#f3ece0', roughness: 0.92 }), // whitewash
  laterite: new MeshStandardMaterial({ color: '#a5502c', roughness: 1 }),
  wood: new MeshStandardMaterial({ color: '#5a3a22', roughness: 0.85 }),
  darkWood: new MeshStandardMaterial({ color: '#3a2414', roughness: 0.85 }),
  white: new MeshStandardMaterial({ color: '#f7f4ee', roughness: 0.6 }),
  steel: new MeshStandardMaterial({ color: '#c9ccd1', metalness: 0.7, roughness: 0.35 }),
  red: new MeshStandardMaterial({ color: '#c8322a', roughness: 0.6 }),
  glass: windowGlow,
}
let tiles: MeshStandardMaterial | null = null
const tileMat = () => (tiles ??= new MeshStandardMaterial({ map: tileTexture([1, 1]), roughness: 0.85, side: DoubleSide }))

function Roof({ w, d, rise, y, overhang = 0.9 }: { w: number; d: number; rise: number; y: number; overhang?: number }) {
  const geo = useMemo(() => hipRoofGeometry(w, d, rise, overhang), [w, d, rise, overhang])
  return <mesh geometry={geo} material={tileMat()} position={[0, y, 0]} castShadow receiveShadow />
}

function Box({ size, position, material, cast = true }: { size: [number, number, number]; position: [number, number, number]; material: MeshStandardMaterial; cast?: boolean }) {
  return (
    <mesh position={position} material={material} castShadow={cast} receiveShadow>
      <boxGeometry args={size} />
    </mesh>
  )
}

// ---------- Buildings (local space: ground at y = 0, front faces +z toward the jetty) ----------

// Traditional house: laterite plinth, whitewashed walls, pillared verandah, tiled hip roof
function House({ w, h, d }: { w: number; h: number; d: number }) {
  const wallH = h * 0.5
  return (
    <>
      <Box size={[w + 2.4, 0.5, d + 2.6]} position={[0, 0.25, 0.3]} material={M.laterite} />
      <Box size={[w, wallH, d]} position={[0, 0.5 + wallH / 2, 0]} material={M.lime} />
      {/* Door and shuttered windows */}
      <Box size={[1.2, 2.1, 0.12]} position={[0, 1.55, d / 2 + 0.02]} material={M.darkWood} cast={false} />
      {[-1, 1].map((s) => (
        <Box key={s} size={[1.1, 1.1, 0.12]} position={[s * (w / 2 - 1.6), 2, d / 2 + 0.02]} material={M.wood} cast={false} />
      ))}
      {[-1, 1].map((s) => (
        <Box key={`side${s}`} size={[0.12, 1.1, 1.2]} position={[s * (w / 2 + 0.02), 2, 0]} material={M.wood} cast={false} />
      ))}
      {/* Verandah pillars carrying the deep eaves */}
      {[-1, -0.33, 0.33, 1].map((s) => (
        <mesh key={s} position={[s * (w / 2 + 0.6), 0.5 + wallH / 2, d / 2 + 1.2]} material={M.darkWood} castShadow>
          <cylinderGeometry args={[0.13, 0.15, wallH, 8]} />
        </mesh>
      ))}
      <Roof w={w + 1} d={d + 2.4} rise={h * 0.5} y={0.5 + wallH} overhang={1.1} />
    </>
  )
}

// Two-storey office: plastered walls with window rows, tiled roof
function Office({ w, h, d }: { w: number; h: number; d: number }) {
  const tex = useMemo(() => facadeTextures(w, h - 1.5, 2.6, 3), [w, h])
  const wallH = h - 1.8
  return (
    <>
      <Box size={[w + 1.6, 0.5, d + 1.6]} position={[0, 0.25, 0]} material={M.laterite} />
      <mesh position={[0, 0.5 + wallH / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, wallH, d]} />
        <meshStandardMaterial color="#f6e9d2" map={tex.map} emissive="#ffffff" emissiveMap={tex.emissive} emissiveIntensity={1.1} roughness={0.85} />
      </mesh>
      <Box size={[w + 0.3, 0.18, d + 0.3]} position={[0, 0.5 + wallH / 2, 0]} material={M.white} />
      <Roof w={w} d={d} rise={2} y={0.5 + wallH} overhang={0.9} />
    </>
  )
}

// Cooee: a modern glass tower with an orange crown, the one contemporary building on the water
function Tower({ w, h, d, color }: { w: number; h: number; d: number; color: string }) {
  const tex = useMemo(() => facadeTextures(Math.max(w, d), h, 2.4, 3.2), [w, d, h])
  const accent = useMemo(() => new MeshStandardMaterial({ color: "#FF5C1A", roughness: 0.5 }), [])
  return (
    <>
      <Box size={[w + 3, 0.5, d + 3]} position={[0, 0.25, 0]} material={M.white} />
      <mesh position={[0, 0.5 + h / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color="#d8ece9" map={tex.map} emissive="#ffffff" emissiveMap={tex.emissive} emissiveIntensity={1.3} roughness={0.25} metalness={0.3} />
      </mesh>
      {[-1, 1].flatMap((sx) => [-1, 1].map((sz) => (
        <Box key={`${sx}${sz}`} size={[0.5, h + 0.4, 0.5]} position={[sx * w / 2, 0.5 + h / 2, sz * d / 2]} material={M.white} />
      )))}
      <Box size={[w + 0.6, 0.9, d + 0.6]} position={[0, 0.5 + h + 0.45, 0]} material={accent} />
      <Box size={[w * 0.55, 2.2, d * 0.55]} position={[0, 0.5 + h + 2, 0]} material={M.white} />
      <mesh position={[0, 0.5 + h + 5, 0]} material={M.steel}>
        <cylinderGeometry args={[0.05, 0.15, 4, 6]} />
      </mesh>
      {/* Entrance canopy */}
      <Box size={[4.5, 0.2, 2]} position={[0, 3.3, d / 2 + 1]} material={accent} />
    </>
  )
}

// Boatyard: an open tiled shed over a wooden hull half way through being built
function Boatyard({ w, h, d }: { w: number; h: number; d: number }) {
  const hull = useMemo(() => {
    const s = new Shape()
    s.moveTo(-3.2, 0.2)
    s.quadraticCurveTo(0, -0.5, 3.2, 0.2)
    s.quadraticCurveTo(3.7, 0.6, 3.9, 1.4)
    s.lineTo(-3.9, 1.4)
    s.quadraticCurveTo(-3.7, 0.6, -3.2, 0.2)
    const g = new ExtrudeGeometry(s, { depth: 1.6, bevelEnabled: false, curveSegments: 16 })
    g.translate(0, 0, -0.8)
    return g
  }, [])
  const postH = h - 1.4
  return (
    <>
      <Box size={[w + 1, 0.3, d + 1]} position={[0, 0.15, 0]} material={M.laterite} />
      {[-1, 0, 1].flatMap((sx) => [-1, 1].map((sz) => (
        <mesh key={`${sx}${sz}`} position={[sx * (w / 2 - 0.3), 0.3 + postH / 2, sz * (d / 2 - 0.3)]} material={M.darkWood} castShadow>
          <cylinderGeometry args={[0.15, 0.17, postH, 8]} />
        </mesh>
      )))}
      <Roof w={w} d={d} rise={2} y={0.3 + postH} overhang={0.8} />
      {/* The hull on its stands, ribs still showing at one end */}
      <group position={[0, 1.2, 0]} rotation={[0, 0, 0]}>
        <mesh geometry={hull} material={M.wood} castShadow />
        {[-2.6, -1.8, -1].map((x) => (
          <mesh key={x} position={[x, 1.45, 0]} rotation={[0, Math.PI / 2, 0]} material={M.darkWood}>
            <torusGeometry args={[0.85, 0.05, 6, 12, Math.PI]} />
          </mesh>
        ))}
      </group>
      {[-2.4, 2.4].map((x) => <Box key={x} size={[0.3, 0.9, 1.4]} position={[x, 0.75, 0]} material={M.darkWood} />)}
      {/* Timber stack and a workbench */}
      {[0, 1, 2].map((i) => <Box key={i} size={[3.4, 0.2, 0.3]} position={[0, 0.4 + i * 0.22, -d / 2 + 0.9 + (i % 2) * 0.1]} material={M.wood} />)}
      <Box size={[2, 0.9, 0.8]} position={[w / 2 - 1.6, 0.75, d / 2 - 1]} material={M.wood} />
    </>
  )
}

// Telecom mast: a red-and-white lattice tower with panel antennas and a blinking beacon
function Mast({ h, color }: { h: number; color: string }) {
  const beacon = useRef<MeshStandardMaterial>(null)
  useFrame(({ clock }) => {
    if (beacon.current) beacon.current.emissiveIntensity = Math.sin(clock.elapsedTime * 4) > 0.3 ? 10 : 0.5
  })
  const SEG = 8
  const base = 1.6
  const top = 0.5
  const halfAt = (y: number) => base + (top - base) * (y / h)
  return (
    <>
      <Box size={[4, 0.3, 4]} position={[0, 0.15, 0]} material={M.white} />
      {Array.from({ length: SEG }, (_, i) => {
        const y0 = (i / SEG) * h
        const y1 = ((i + 1) / SEG) * h
        const hw = (halfAt(y0) + halfAt(y1)) / 2
        const mat = i % 2 ? M.white : M.red
        return (
          <group key={i}>
            {[-1, 1].flatMap((sx) => [-1, 1].map((sz) => (
              <mesh key={`${sx}${sz}`} position={[sx * hw, (y0 + y1) / 2, sz * hw]} material={mat}>
                <boxGeometry args={[0.12, y1 - y0, 0.12]} />
              </mesh>
            )))}
            {[0, Math.PI / 2, Math.PI, -Math.PI / 2].map((a) => (
              <mesh key={a} position={[Math.sin(a) * hw, (y0 + y1) / 2, Math.cos(a) * hw]} rotation={[0, a, Math.atan2(hw * 2, y1 - y0)]} material={mat}>
                <boxGeometry args={[0.06, Math.hypot(hw * 2, y1 - y0), 0.06]} />
              </mesh>
            ))}
          </group>
        )
      })}
      {[0, 1, 2].map((k) => {
        const a = (k / 3) * Math.PI * 2
        return (
          <mesh key={k} position={[Math.sin(a) * 0.8, h - 1.5, Math.cos(a) * 0.8]} rotation={[0, a, 0]} material={M.white} castShadow>
            <boxGeometry args={[0.45, 1.8, 0.15]} />
          </mesh>
        )
      })}
      <mesh position={[0.9, h * 0.6, 0.4]} rotation={[0.2, 0.6, Math.PI / 2.2]} material={M.white}>
        <sphereGeometry args={[0.7, 16, 8, 0, Math.PI * 2, 0, Math.PI / 3]} />
      </mesh>
      <mesh position={[0, h + 0.3, 0]}>
        <sphereGeometry args={[0.22, 10, 8]} />
        <meshStandardMaterial ref={beacon} color="#ff2a2a" emissive="#ff2a2a" emissiveIntensity={8} />
      </mesh>
      {/* Equipment hut */}
      <group position={[3.2, 0, 1.5]}>
        <Box size={[2.6, 2.2, 2]} position={[0, 1.1, 0]} material={M.lime} />
        <Roof w={2.6} d={2} rise={1} y={2.2} overhang={0.4} />
        <Box size={[0.9, 0.1, 0.05]} position={[0, 1.6, 1.03]} material={new MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 2 })} cast={false} />
      </group>
    </>
  )
}

// Football ground: a marked pitch, goals, a small stand and floodlights
function Ground({ w, d }: { w: number; d: number }) {
  const pitch = useMemo(pitchTexture, [])
  const flood = useMemo(() => new MeshStandardMaterial({ color: '#fffbe8', emissive: '#fffbe8', emissiveIntensity: 7 }), [])
  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]} receiveShadow>
        <planeGeometry args={[w, d]} />
        <meshStandardMaterial map={pitch} roughness={0.9} />
      </mesh>
      {[-1, 1].map((s) => (
        <group key={s} position={[s * (w / 2 - 0.4), 0, 0]}>
          {[-1.6, 1.6].map((z) => (
            <mesh key={z} position={[0, 1, z]} material={M.white}>
              <cylinderGeometry args={[0.07, 0.07, 2, 6]} />
            </mesh>
          ))}
          <mesh position={[0, 2, 0]} rotation={[Math.PI / 2, 0, 0]} material={M.white}>
            <cylinderGeometry args={[0.07, 0.07, 3.3, 6]} />
          </mesh>
          <mesh position={[s * 0.6, 1, 0]}>
            <boxGeometry args={[1.2, 2, 3.2]} />
            <meshStandardMaterial color="#ffffff" transparent opacity={0.18} />
          </mesh>
        </group>
      ))}
      {/* Concrete steps along the far side */}
      {[0, 1, 2].map((i) => (
        <Box key={i} size={[w * 0.6, 0.45, 0.8]} position={[0, 0.22 + i * 0.45, -d / 2 - 0.6 - i * 0.8]} material={M.white} />
      ))}
      {[-1, 1].map((s) => (
        <group key={s} position={[s * (w / 2 + 0.8), 0, -d / 2 - 0.5]}>
          <mesh position={[0, 5, 0]} material={M.steel} castShadow>
            <cylinderGeometry args={[0.12, 0.2, 10, 8]} />
          </mesh>
          <mesh position={[0, 10.2, 0.2]} rotation={[0.5, 0, 0]} material={flood}>
            <boxGeometry args={[1.8, 0.9, 0.2]} />
          </mesh>
        </group>
      ))}
    </>
  )
}

// DeCarb: an eco hut with a solar array, ringed by mangroves
function Eco({ w, h, d }: { w: number; h: number; d: number }) {
  const mangroves = useMemo(
    () => Array.from({ length: 7 }, (_, i) => {
      const a = -Math.PI * 0.9 + (i / 6) * Math.PI * 1.8 + Math.PI
      return { x: Math.sin(a) * 8, z: Math.cos(a) * 8 - 1, s: 0.8 + ((i * 37) % 10) / 20 }
    }),
    [],
  )
  return (
    <>
      <Box size={[w + 1, 0.4, d + 1]} position={[0, 0.2, 0]} material={M.laterite} />
      <mesh position={[0, 0.4 + h / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color="#cfe8d4" roughness={0.9} />
      </mesh>
      <Box size={[1.1, 2, 0.1]} position={[0, 1.4, d / 2 + 0.02]} material={M.darkWood} cast={false} />
      <Roof w={w} d={d} rise={1.8} y={0.4 + h} overhang={0.8} />
      {[-1, 1].flatMap((row) => [-1, 0, 1].map((col) => (
        <group key={`${row}${col}`} position={[col * 2.3 + (w / 2 + 3), 1.1, row * 1.8 - 1]}>
          <mesh rotation={[-0.5, 0, 0]} castShadow>
            <boxGeometry args={[2.1, 0.08, 1.5]} />
            <meshStandardMaterial color="#1c3a7a" metalness={0.6} roughness={0.2} emissive="#3ddc97" emissiveIntensity={0.08} />
          </mesh>
          <mesh position={[0, -0.6, 0]} material={M.steel}>
            <cylinderGeometry args={[0.04, 0.04, 1.2, 5]} />
          </mesh>
        </group>
      )))}
      {mangroves.map((m, i) => (
        <group key={i} position={[m.x, 0, m.z]} scale={m.s}>
          {[0, 1, 2, 3].map((k) => (
            <mesh key={k} position={[Math.sin(k * 1.7) * 0.5, 0.5, Math.cos(k * 1.7) * 0.5]} rotation={[Math.cos(k * 1.7) * 0.5, 0, -Math.sin(k * 1.7) * 0.5]} material={M.darkWood}>
              <cylinderGeometry args={[0.04, 0.07, 1.3, 5]} />
            </mesh>
          ))}
          <mesh position={[0, 1.6, 0]} material={M.darkWood}>
            <cylinderGeometry args={[0.1, 0.16, 1.6, 6]} />
          </mesh>
          <mesh position={[0, 3, 0]} scale={[1.6, 1, 1.6]} castShadow>
            <dodecahedronGeometry args={[1.2, 1]} />
            <meshStandardMaterial color="#2f6b3a" roughness={0.9} flatShading />
          </mesh>
        </group>
      ))}
    </>
  )
}

// Lighthouse: red and white bands, a glowing lantern room and a slowly sweeping beam
function Lighthouse({ h }: { h: number }) {
  const beam = useRef<Group>(null)
  const bands = useMemo(bandTexture, [])
  useFrame((_, dt) => {
    if (beam.current) beam.current.rotation.y += dt * 0.6
  })
  return (
    <>
      <mesh position={[0, h / 2, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[1.25, 1.9, h, 24]} />
        <meshStandardMaterial map={bands} roughness={0.7} />
      </mesh>
      <mesh position={[0, h + 0.1, 0]} material={M.darkWood}>
        <cylinderGeometry args={[1.9, 1.9, 0.2, 24]} />
      </mesh>
      {Array.from({ length: 20 }, (_, i) => {
        const a = (i / 20) * Math.PI * 2
        return (
          <mesh key={i} position={[Math.sin(a) * 1.8, h + 0.6, Math.cos(a) * 1.8]} material={M.darkWood}>
            <cylinderGeometry args={[0.03, 0.03, 0.8, 4]} />
          </mesh>
        )
      })}
      <mesh position={[0, h + 1, 0]} rotation={[Math.PI / 2, 0, 0]} material={M.darkWood}>
        <torusGeometry args={[1.8, 0.04, 6, 32]} />
      </mesh>
      <mesh position={[0, h + 1.2, 0]}>
        <cylinderGeometry args={[0.95, 0.95, 1.8, 16]} />
        <meshStandardMaterial color="#fff3c4" emissive="#ffd27a" emissiveIntensity={5} transparent opacity={0.9} />
      </mesh>
      <mesh position={[0, h + 2.5, 0]} material={M.red}>
        <coneGeometry args={[1.2, 1.1, 16]} />
      </mesh>
      <group ref={beam} position={[0, h + 1.2, 0]}>
        <mesh position={[0, 0, 14]} rotation={[Math.PI / 2, 0, 0]}>
          <coneGeometry args={[3, 28, 20, 1, true]} />
          <meshBasicMaterial color="#ffe6a8" transparent opacity={0.12} blending={AdditiveBlending} depthWrite={false} side={DoubleSide} />
        </mesh>
      </group>
      {/* Keeper's house */}
      <group position={[3.4, 0, -1.5]}>
        <Box size={[3.4, 2.4, 2.8]} position={[0, 1.2, 0]} material={M.lime} />
        <Roof w={3.4} d={2.8} rise={1.3} y={2.4} overhang={0.5} />
      </group>
    </>
  )
}

// ---------- Jetty, signboard and marker ----------

function Jetty({ from, to }: { from: number; to: number }) {
  const len = to - from
  const tex = useMemo(() => plankTexture([1, len / 2]), [len])
  return (
    <group position={[0, 0, (from + to) / 2]}>
      <mesh position={[0, 0.55 - ISLAND_TOP, 0]} castShadow receiveShadow>
        <boxGeometry args={[2.2, 0.14, len]} />
        <meshStandardMaterial map={tex} roughness={0.85} />
      </mesh>
      {Array.from({ length: Math.max(2, Math.floor(len / 2.2) + 1) }, (_, i) => -len / 2 + (i * len) / Math.max(1, Math.floor(len / 2.2))).map((z) =>
        [-1.05, 1.05].map((x) => (
          <mesh key={`${x}${z}`} position={[x, 0.15 - ISLAND_TOP, z]} material={M.darkWood}>
            <cylinderGeometry args={[0.08, 0.08, 1.4, 6]} />
          </mesh>
        )),
      )}
    </group>
  )
}

// Festoon lights strung along the jetty on wooden poles. They stay dark until you've visited the stop,
// then switch on one after another from the island out to the water, so finished chapters glow behind you.
const BULB_OFF = new Color(0.16, 0.11, 0.07)
const BULB_ON = new Color(5.5, 3.2, 1.4) // bright enough to bloom and to show in the water's reflection
const bulbColor = new Color()
const lightDummy = new Object3D()

function JettyLights({ from, to, lit }: { from: number; to: number; lit: boolean }) {
  const DECK = 0.55 - ISLAND_TOP
  const POLE = 2
  const { poles, bulbs } = useMemo(() => {
    const spans = Math.max(1, Math.round((to - from) / 4))
    const poles: [number, number][] = []
    const bulbs: { x: number; y: number; z: number; order: number }[] = []
    for (const x of [-1.15, 1.15]) {
      for (let i = 0; i <= spans; i++) poles.push([x, from + ((to - from) * i) / spans])
      for (let i = 0; i < spans; i++) {
        const z0 = from + ((to - from) * i) / spans
        const z1 = from + ((to - from) * (i + 1)) / spans
        for (let k = 0; k < 5; k++) {
          const t = (k + 0.5) / 5
          bulbs.push({ x, y: DECK + POLE - 0.42 * 4 * t * (1 - t), z: z0 + (z1 - z0) * t, order: i + t })
        }
      }
    }
    return { poles, bulbs }
  }, [from, to, DECK])
  const ref = useRef<InstancedMesh>(null)
  const level = useRef(bulbs.map(() => 0))
  // A soft halo round each bulb: faint by day, and what you see from far off once dusk falls
  const glowGeo = useMemo(() => {
    const g = new BufferGeometry()
    g.setAttribute('position', new Float32BufferAttribute(bulbs.flatMap((b) => [b.x, b.y, b.z]), 3))
    return g
  }, [bulbs])
  const glowTex = useMemo(foamTexture, [])
  const glow = useRef<PointsMaterial>(null)
  const since = useRef(-1)
  useLayoutEffect(() => {
    const m = ref.current
    if (!m) return
    bulbs.forEach((b, i) => {
      lightDummy.position.set(b.x, b.y, b.z)
      lightDummy.updateMatrix()
      m.setMatrixAt(i, lightDummy.matrix)
      m.setColorAt(i, BULB_OFF)
    })
    m.instanceMatrix.needsUpdate = true
    if (m.instanceColor) m.instanceColor.needsUpdate = true
  }, [bulbs])
  useFrame(({ clock }, dt) => {
    const m = ref.current
    if (!m) return
    const t = clock.elapsedTime
    if (lit && since.current < 0) since.current = t
    if (!lit) since.current = -1
    let changed = false
    bulbs.forEach((b, i) => {
      // Each bulb waits its turn, then warms up over a fraction of a second
      const goal = lit && t - since.current > 0.25 + b.order * 0.22 ? 1 : 0
      const v = level.current[i]
      if (Math.abs(goal - v) < 0.002) return
      level.current[i] = v + (goal - v) * Math.min(1, dt * 6)
      bulbColor.copy(BULB_OFF).lerp(BULB_ON, level.current[i])
      m.setColorAt(i, bulbColor)
      changed = true
    })
    if (changed && m.instanceColor) m.instanceColor.needsUpdate = true
    if (glow.current) {
      const on = level.current.reduce((a, v) => a + v, 0) / Math.max(1, bulbs.length)
      glow.current.opacity = on * (0.18 + dusk.value * 0.82)
      glow.current.size = 1.1 + dusk.value * 2.8
    }
  })
  return (
    <>
      {poles.map(([x, z], i) => (
        <mesh key={i} position={[x, DECK + POLE / 2, z]} material={M.darkWood}>
          <cylinderGeometry args={[0.05, 0.06, POLE, 5]} />
        </mesh>
      ))}
      <instancedMesh ref={ref} args={[undefined, undefined, bulbs.length]} frustumCulled={false}>
        <sphereGeometry args={[0.085, 8, 6]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
      <points geometry={glowGeo} frustumCulled={false}>
        <pointsMaterial ref={glow} map={glowTex} color="#ffb060" size={1.1} transparent opacity={0} depthWrite={false} blending={AdditiveBlending} />
      </points>
    </>
  )
}

// Hand-painted board: chapter line over the stop's name, in the main site's fonts
function Signboard({ zone }: { zone: Zone }) {
  const texture = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = 1024
    c.height = 400
    const t = new CanvasTexture(c)
    t.colorSpace = SRGBColorSpace
    t.anisotropy = 8
    return t
  }, [])
  useEffect(() => {
    const draw = () => {
      const c = texture.image as HTMLCanvasElement
      const g = c.getContext('2d')!
      const ch = chapterOf(zone)
      g.fillStyle = '#0A2318'
      g.fillRect(0, 0, c.width, c.height)
      g.strokeStyle = '#e9dfc8'
      g.lineWidth = 10
      g.strokeRect(14, 14, c.width - 28, c.height - 28)
      g.fillStyle = zone.color
      g.fillRect(14, c.height - 52, c.width - 28, 38)
      g.textAlign = 'center'
      g.textBaseline = 'middle'
      g.fillStyle = zone.color
      g.font = '700 50px "JetBrains Mono", monospace'
      g.fillText(`CHAPTER ${ch.n} · ${ch.title.toUpperCase()}`, c.width / 2, 90)
      let size = 170
      g.font = `900 ${size}px "Nunito Sans", sans-serif`
      while (g.measureText(zone.sign).width > c.width - 90 && size > 60) {
        size -= 8
        g.font = `900 ${size}px "Nunito Sans", sans-serif`
      }
      g.fillStyle = '#FAFAF8'
      g.fillText(zone.sign, c.width / 2, 225)
      texture.needsUpdate = true
    }
    draw()
    Promise.all([document.fonts.load('900 100px "Nunito Sans"'), document.fonts.load('700 40px "JetBrains Mono"')]).then(draw).catch(() => {})
  }, [texture, zone])
  return (
    <group>
      {[-1.9, 1.9].map((x) => (
        <mesh key={x} position={[x, 1.6, 0]} material={M.darkWood} castShadow>
          <cylinderGeometry args={[0.1, 0.12, 3.2, 6]} />
        </mesh>
      ))}
      <mesh position={[0, 2.5, 0.06]}>
        <planeGeometry args={[4.4, 1.72]} />
        <meshStandardMaterial map={texture} roughness={0.8} emissive="#ffffff" emissiveMap={texture} emissiveIntensity={0.35} />
      </mesh>
      <mesh position={[0, 2.5, 0]} material={M.wood} castShadow>
        <boxGeometry args={[4.5, 1.82, 0.1]} />
      </mesh>
    </group>
  )
}

// A roadside hoarding showing the live product, lit like a screen, beside the jetty
function Billboard({ src }: { src: string }) {
  const texture = useMemo(() => {
    const t = new TextureLoader().load(src)
    t.colorSpace = SRGBColorSpace
    t.anisotropy = 8
    return t
  }, [src])
  useEffect(() => () => texture.dispose(), [texture])
  const W = 5.2
  const H = 3.25
  return (
    <group>
      {[-W / 2 + 0.4, W / 2 - 0.4].map((x) => (
        <mesh key={x} position={[x, 1.1, -0.08]} material={M.darkWood} castShadow>
          <cylinderGeometry args={[0.1, 0.12, 2.2, 6]} />
        </mesh>
      ))}
      <mesh position={[0, 1.55 + H / 2, -0.06]} material={M.darkWood} castShadow>
        <boxGeometry args={[W + 0.3, H + 0.3, 0.12]} />
      </mesh>
      <mesh position={[0, 1.55 + H / 2, 0.01]}>
        <planeGeometry args={[W, H]} />
        <meshStandardMaterial map={texture} emissive="#ffffff" emissiveMap={texture} emissiveIntensity={0.55} roughness={0.4} />
      </mesh>
    </group>
  )
}

// Where to stop: a mooring post with a flag at the jetty's end, and a ring on the water.
// The flag is orange for the stop you're heading to, green once you've been, cream otherwise.
// (Whether the boat is on the marker is worked out in collision.ts.)
function Pad({ x, z, toward, target, visited, active }: {
  x: number; z: number; toward: [number, number]; target: boolean; visited: boolean; active: boolean
}) {
  const flag = useRef<Mesh>(null)
  const ring = useRef<MeshBasicMaterial>(null)
  const color = target ? '#FF5C1A' : visited ? '#00E87A' : '#FAFAF8'
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    if (flag.current) flag.current.rotation.y = Math.sin(t * 2.2) * 0.3
    if (ring.current) ring.current.opacity = active ? 0.55 : target ? 0.3 + Math.sin(t * 2.5) * 0.12 : 0.14
  })
  return (
    <group position={[x, 0, z]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
        <ringGeometry args={[2.9, 3.15, 48]} />
        <meshBasicMaterial ref={ring} color={color} transparent depthWrite={false} />
      </mesh>
      <group position={[toward[0] * POST_OFFSET, 0, toward[1] * POST_OFFSET]}>
        <mesh position={[0, 1.3, 0]} material={M.darkWood} castShadow>
          <cylinderGeometry args={[0.12, 0.14, 3.6, 8]} />
        </mesh>
        <mesh ref={flag} position={[0, 2.75, 0]}>
          <planeGeometry args={[0.9, 0.55]} onUpdate={(g) => g.translate(0.45, 0, 0)} />
          <meshStandardMaterial color={color} side={DoubleSide} roughness={0.8} emissive={color} emissiveIntensity={target ? 0.35 : 0} />
        </mesh>
      </group>
    </group>
  )
}

export function ZoneBuilding({ zone }: { zone: Zone }) {
  const l = zoneLayout(zone)
  const active = useGame((s) => s.activeZone === zone.id)
  const target = useGame((s) => s.target === zone.id)
  const visited = useGame((s) => s.visited.includes(zone.id))

  let body: React.ReactNode
  switch (zone.kind) {
    case 'house': body = <House w={l.w} h={l.h} d={l.d} />; break
    case 'office': body = <Office w={l.w} h={l.h} d={l.d} />; break
    case 'tower': body = <Tower w={l.w} h={l.h} d={l.d} color={zone.color} />; break
    case 'boatyard': body = <Boatyard w={l.w} h={l.h} d={l.d} />; break
    case 'mast': body = <Mast h={l.h} color={zone.color} />; break
    case 'ground': body = <Ground w={l.w} d={l.d} />; break
    case 'eco': body = <Eco w={l.w} h={l.h} d={l.d} />; break
    case 'lighthouse': body = <Lighthouse h={l.h} />; break
  }
  const { from: jettyFrom, to: jettyTo } = jettySpan(l)

  return (
    <group>
      <group position={[l.x, ISLAND_TOP, l.z]} rotation={[0, l.yaw, 0]}>
        {body}
        <Jetty from={jettyFrom} to={jettyTo} />
        <JettyLights from={jettyFrom} to={jettyTo} lit={visited} />
        <group position={[3, 0, l.island - 2.5]}>
          <Signboard zone={zone} />
        </group>
        {zone.shot && (
          <group position={[-4.6, 0, l.island - 3.2]} rotation={[0, 0.3, 0]}>
            <Billboard src={zone.shot.src} />
          </group>
        )}
      </group>
      <Pad
        x={l.padX}
        z={l.padZ}
        toward={[(l.x - l.padX) / l.dist, (l.z - l.padZ) / l.dist]}
        target={target}
        visited={visited}
        active={active}
      />
    </group>
  )
}
