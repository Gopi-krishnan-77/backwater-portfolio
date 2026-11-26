import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  DoubleSide, SphereGeometry, ExtrudeGeometry, Group, MeshStandardMaterial, Path, PlaneGeometry, Shape,
} from 'three'
import { zones } from '../content'
import { ZoneBuilding } from './ZoneBuilding'
import { Nature } from './Nature'
import { grassTexture, netTexture, sandTexture, seeded } from './textures'
import { ISLAND_TOP, ISLANDS, LIFE, SHORE_BEVEL, SHORE_OUTLINE, TAU, islandBevel, islandSeed, wobble } from './layout'
import { Water } from './Water'
import { Birds } from './Birds'

// ---------- Islands: a wobbly outline extruded into a grassy top with a sloping sandy beach ----------

function islandGeometry(r: number, seed: number) {
  const s = new Shape()
  const R = wobble(r, seed)
  const N = Math.max(28, Math.round(r * 2.4))
  for (let i = 0; i <= N; i++) {
    const a = (i / N) * TAU
    const [x, y] = [Math.cos(a) * R(a), Math.sin(a) * R(a)]
    if (i === 0) s.moveTo(x, y)
    else s.lineTo(x, y)
  }
  const g = new ExtrudeGeometry(s, { depth: 0.4, bevelEnabled: true, bevelThickness: 0.6, bevelSize: islandBevel(r), bevelSegments: 4, curveSegments: 4 })
  g.rotateX(-Math.PI / 2)
  return g
}

// The land all round the lagoon: a big square with a wobbly round hole
function shoreGeometry() {
  const s = new Shape()
  const H = 700
  s.moveTo(-H, -H)
  s.lineTo(H, -H)
  s.lineTo(H, H)
  s.lineTo(-H, H)
  s.closePath()
  const hole = new Path()
  const R = wobble(SHORE_OUTLINE, 7)
  const N = 160
  for (let i = 0; i <= N; i++) {
    const a = -(i / N) * TAU
    const [x, y] = [Math.cos(a) * R(a), Math.sin(a) * R(a)]
    if (i === 0) hole.moveTo(x, y)
    else hole.lineTo(x, y)
  }
  s.holes.push(hole)
  const g = new ExtrudeGeometry(s, { depth: 0.4, bevelEnabled: true, bevelThickness: 0.6, bevelSize: SHORE_BEVEL, bevelSegments: 4, curveSegments: 4 })
  g.rotateX(-Math.PI / 2)
  return g
}

function Land() {
  const mats = useMemo(
    () => [
      new MeshStandardMaterial({ map: grassTexture([1 / 7, 1 / 7]), color: '#c4dca0', roughness: 0.95 }),
      new MeshStandardMaterial({ map: sandTexture([1 / 9, 1 / 9]), color: '#e7cfa3', roughness: 1 }),
    ],
    [],
  )
  const islands = useMemo(() => ISLANDS.map((i, k) => ({ ...i, geo: islandGeometry(i.r, islandSeed(k)) })), [])
  const shore = useMemo(shoreGeometry, [])
  const y = ISLAND_TOP - 1.0 // geometry spans -0.6..1.0 before this offset
  return (
    <>
      {islands.map((i, k) => (
        <mesh key={k} geometry={i.geo} material={mats} position={[i.x, y, i.z]} receiveShadow castShadow />
      ))}
      <mesh geometry={shore} material={mats} position={[0, y, 0]} receiveShadow />
    </>
  )
}

// Western Ghats: misty hills to the east, away from the sunset
function Hills() {
  const hills = useMemo(() => {
    const r = seeded(99)
    return Array.from({ length: 14 }, () => {
      const a = Math.PI * 0.15 + r() * Math.PI * 0.75
      const d = 280 + r() * 160
      return { x: Math.sin(a) * d, z: Math.cos(a) * d * 1.2 - 40, h: 40 + r() * 55, w: 70 + r() * 60, rot: r() * 3 }
    })
  }, [])
  // Soft domes rather than cones: from this far away, through the haze, they read as rolling hills
  const geo = useMemo(() => new SphereGeometry(1, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2), [])
  return (
    <>
      {hills.map((h, i) => (
        <mesh key={i} geometry={geo} position={[h.x, -2, h.z]} scale={[h.w, h.h * 0.8, h.w * 0.8]} rotation={[0, h.rot, 0]}>
          <meshStandardMaterial color="#4a6e58" roughness={1} />
        </mesh>
      ))}
    </>
  )
}

// ---------- Backwater life ----------

// Chinese fishing net: a cantilevered boom that dips a square net into the water and lifts it out
function FishingNet({ x, z, yaw, phase }: { x: number; z: number; yaw: number; phase: number }) {
  const boom = useRef<Group>(null)
  const net = useMemo(() => {
    const g = new PlaneGeometry(6, 6, 8, 8)
    const p = g.attributes.position
    for (let i = 0; i < p.count; i++) {
      const dx = p.getX(i) / 3
      const dy = p.getY(i) / 3
      p.setZ(i, -(1 - dx * dx) * (1 - dy * dy) * 1.4) // sags in the middle
    }
    g.computeVertexNormals()
    return g
  }, [])
  const tex = useMemo(netTexture, [])
  useFrame(({ clock }) => {
    // Swings between dipped (net under water) and raised high
    if (boom.current) boom.current.rotation.x = 0.06 - (Math.sin(clock.elapsedTime * 0.35 + phase) * 0.5 + 0.5) * 0.5
  })
  const wood = '#5a3a22'
  return (
    <group position={[x, ISLAND_TOP, z]} rotation={[0, yaw, 0]}>
      {/* Platform on stilts at the water's edge */}
      {[-1, 1].map((sx) => (
        <mesh key={sx} position={[sx * 1.2, 0.6, 0.5]}>
          <cylinderGeometry args={[0.12, 0.14, 2.4, 6]} />
          <meshStandardMaterial color={wood} roughness={0.9} />
        </mesh>
      ))}
      <mesh position={[0, 1.3, 0.5]}>
        <boxGeometry args={[3, 0.12, 2]} />
        <meshStandardMaterial color="#7a5432" roughness={0.9} />
      </mesh>
      {/* Boom pivots at the platform: net end out over the water (+z), counterweights behind */}
      <group ref={boom} position={[0, 2.2, 0.5]}>
        <mesh position={[0, 0, 4]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.1, 0.14, 13, 6]} />
          <meshStandardMaterial color={wood} roughness={0.9} />
        </mesh>
        <group position={[0, -0.2, 10]}>
          {[1, -1].map((s) => (
            <mesh key={s} rotation={[0, s * Math.PI / 4, Math.PI / 2]}>
              <cylinderGeometry args={[0.05, 0.05, 8.5, 5]} />
              <meshStandardMaterial color={wood} roughness={0.9} />
            </mesh>
          ))}
          <mesh geometry={net} rotation={[Math.PI / 2, 0, 0]} position={[0, -0.6, 0]}>
            <meshStandardMaterial map={tex} alphaTest={0.4} side={DoubleSide} color="#f2e8d0" roughness={1} />
          </mesh>
        </group>
        {[-0.5, 0, 0.5].map((dx, i) => (
          <mesh key={i} position={[dx, -1.2 - i * 0.2, -2.2]}>
            <dodecahedronGeometry args={[0.35, 0]} />
            <meshStandardMaterial color="#8a8279" roughness={1} flatShading />
          </mesh>
        ))}
      </group>
    </group>
  )
}

// Kettuvallam: a moored houseboat with a woven roof
function houseboatHull() {
  const s = new Shape()
  s.moveTo(-5, -0.4)
  s.quadraticCurveTo(0, -0.75, 5, -0.4)
  s.quadraticCurveTo(6.2, -0.1, 6.6, 0.95)
  s.lineTo(6.25, 0.95)
  s.quadraticCurveTo(5.6, 0.35, 4.5, 0.35)
  s.lineTo(-4.5, 0.35)
  s.quadraticCurveTo(-5.6, 0.35, -6.25, 0.95)
  s.lineTo(-6.6, 0.95)
  s.quadraticCurveTo(-6.2, -0.1, -5, -0.4)
  const g = new ExtrudeGeometry(s, { depth: 2.4, bevelEnabled: true, bevelThickness: 0.12, bevelSize: 0.1, bevelSegments: 3, curveSegments: 16 })
  g.translate(0, 0, -1.2)
  return g
}

function Houseboat({ x, z, yaw, phase }: { x: number; z: number; yaw: number; phase: number }) {
  const ref = useRef<Group>(null)
  const hull = useMemo(houseboatHull, [])
  useFrame(({ clock }) => {
    const g = ref.current
    if (!g) return
    const t = clock.elapsedTime + phase
    g.position.y = 0.15 + Math.sin(t * 1.2) * 0.05
    g.rotation.z = Math.sin(t * 0.9) * 0.012
  })
  return (
    <group position={[x, 0, z]} rotation={[0, yaw, 0]}>
      <group ref={ref}>
        <mesh geometry={hull} castShadow>
          <meshStandardMaterial color="#4a2c1a" roughness={0.7} />
        </mesh>
        <mesh position={[0, 0.4, 0]}>
          <boxGeometry args={[9.2, 0.08, 2.5]} />
          <meshStandardMaterial color="#7a5232" roughness={0.8} />
        </mesh>
        <mesh position={[-0.6, 0.6, 0]} rotation={[0, 0, Math.PI / 2]} scale={[1, 1, 1.05]} castShadow>
          <cylinderGeometry args={[1.35, 1.35, 7, 24, 1, true, 0, Math.PI]} />
          <meshStandardMaterial color="#b98d4f" roughness={1} side={DoubleSide} />
        </mesh>
        {[-4.1, 2.9].map((px) => (
          <mesh key={px} position={[px, 0.6, 0]} rotation={[0, Math.PI / 2, 0]}>
            <circleGeometry args={[1.3, 24, 0, Math.PI]} />
            <meshStandardMaterial color="#e6d3ad" roughness={1} side={DoubleSide} />
          </mesh>
        ))}
        <mesh position={[3.5, 1.1, 0]}>
          <sphereGeometry args={[0.1, 10, 8]} />
          <meshStandardMaterial color="#ffd28a" emissive="#ffb347" emissiveIntensity={6} />
        </mesh>
      </group>
    </group>
  )
}

// A fisherman in a small canoe, drifting on the spot
function Canoe({ x, z, yaw, phase }: { x: number; z: number; yaw: number; phase: number }) {
  const ref = useRef<Group>(null)
  const hull = useMemo(houseboatHull, [])
  useFrame(({ clock }) => {
    const g = ref.current
    if (!g) return
    const t = clock.elapsedTime + phase
    g.position.y = 0.05 + Math.sin(t * 1.6) * 0.04
    g.rotation.y = yaw + Math.sin(t * 0.2) * 0.15
  })
  return (
    <group ref={ref} position={[x, 0, z]}>
      <mesh geometry={hull} scale={[0.4, 0.42, 0.28]} castShadow>
        <meshStandardMaterial color="#3b2416" roughness={0.75} />
      </mesh>
      <mesh position={[0.3, 0.75, 0]}>
        <capsuleGeometry args={[0.18, 0.5, 4, 8]} />
        <meshStandardMaterial color="#f2ede2" roughness={0.9} />
      </mesh>
      <mesh position={[0.3, 1.25, 0]}>
        <sphereGeometry args={[0.15, 10, 8]} />
        <meshStandardMaterial color="#6b4630" roughness={0.8} />
      </mesh>
      <mesh position={[0.6, 0.7, 0.25]} rotation={[0.4, 0, 0.9]}>
        <cylinderGeometry args={[0.025, 0.025, 1.9, 5]} />
        <meshStandardMaterial color="#8a6a40" roughness={0.9} />
      </mesh>
    </group>
  )
}

// Placements live in layout.ts so collisions match what you see
function Life() {
  return (
    <>
      {LIFE.nets.map((n, i) => <FishingNet key={i} {...n} />)}
      {LIFE.houseboats.map((h, i) => <Houseboat key={i} {...h} />)}
      {LIFE.canoes.map((c, i) => <Canoe key={i} {...c} />)}
    </>
  )
}

export function World() {
  return (
    <>
      <Water />
      <Land />
      <Hills />
      <Nature />
      <Life />
      <Birds />
      {zones.map((z) => (
        <ZoneBuilding key={z.id} zone={z} />
      ))}
    </>
  )
}

