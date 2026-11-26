// Scenery that appears many times: coconut palms, bushes, grass, water hyacinth and shore houses.
// Each kind is a single instanced mesh (or a few), so hundreds of them cost a handful of draw calls.
import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  BoxGeometry, BufferGeometry, CircleGeometry, Color, CylinderGeometry, DodecahedronGeometry, DoubleSide,
  Float32BufferAttribute, InstancedMesh, Matrix4, MeshStandardMaterial, Object3D, Quaternion, SphereGeometry, Vector3,
} from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { LOW_END } from './Atmosphere'
import { DETAIL_LAYER } from './Water'
import { frondTexture, seeded, tileTexture } from './textures'
import { hipRoofGeometry } from './kerala'
import {
  CENTRAL_R, CHANNEL_HALF, CHANNEL_R, ISLAND_TOP, ISLETS, layouts, onCircle, onLand, shoreAt, TAU,
} from './layout'

type Placement = { x: number; z: number; y?: number; yaw: number; scale: number | [number, number, number]; color?: Color }

function paint(g: BufferGeometry, c: Color) {
  const n = g.attributes.position.count
  const arr = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) arr.set([c.r, c.g, c.b], i * 3)
  g.setAttribute('color', new Float32BufferAttribute(arr, 3))
  return g
}

// ---------- Coconut palms ----------

// One frond: a V-folded strip that arcs out and droops, UVs running along its length
function frondGeometry(length: number, width: number, lift: number, droop: number) {
  const N = 12
  const pos: number[] = []
  const uv: number[] = []
  const idx: number[] = []
  for (let i = 0; i <= N; i++) {
    const t = i / N
    const x = length * t
    const y = lift * x - droop * x * x
    const fold = width * 0.32
    pos.push(x, y - fold, -width, x, y, 0, x, y - fold, width)
    uv.push(t, 0, t, 0.5, t, 1)
  }
  for (let i = 0; i < N; i++) {
    const a = i * 3
    const b = a + 3
    idx.push(a, b, a + 1, b, b + 1, a + 1, a + 1, b + 1, a + 2, b + 1, b + 2, a + 2)
  }
  const g = new BufferGeometry()
  g.setAttribute('position', new Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}

function palmVariant(seed: number) {
  const r = seeded(seed)
  const H = 7 + r() * 2
  const bend = (r() - 0.3) * 2.4
  const point = (t: number) => new Vector3(bend * t * t, H * t, 0)
  const up = new Vector3(0, 1, 0)
  const trunkParts: BufferGeometry[] = []
  const SEG = 10
  for (let i = 0; i < SEG; i++) {
    const a = point(i / SEG)
    const b = point((i + 1) / SEG)
    const dir = b.clone().sub(a)
    const len = dir.length()
    dir.normalize()
    const rb = 0.3 - 0.13 * (i / SEG)
    const g = new CylinderGeometry(rb * 0.88, rb, len * 1.03, 9, 1, true)
    g.applyMatrix4(new Matrix4().compose(a.clone().add(b).multiplyScalar(0.5), new Quaternion().setFromUnitVectors(up, dir), new Vector3(1, 1, 1)))
    trunkParts.push(paint(g, new Color('#8b7a66').multiplyScalar(0.8 + r() * 0.3)))
  }
  const top = point(1)
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2 + r()
    const g = new SphereGeometry(0.2, 8, 6)
    g.translate(top.x + Math.cos(a) * 0.25, top.y - 0.3, top.z + Math.sin(a) * 0.25)
    trunkParts.push(paint(g, new Color('#6b6a2a')))
  }
  const fronds: BufferGeometry[] = []
  const n = 12
  for (let i = 0; i < n; i++) {
    const young = i >= 9
    const g = young
      ? frondGeometry(2.4 + r() * 0.5, 0.5, 1.5, 0.2)
      : frondGeometry(3.6 + r() * 0.9, 0.75, 0.45 + r() * 0.35, 0.16 + r() * 0.06)
    g.rotateY(((young ? i * 2.1 : i) / (young ? 3 : 9)) * Math.PI * 2 + r() * 0.3)
    g.translate(top.x, top.y, top.z)
    fronds.push(g)
  }
  return { trunk: mergeGeometries(trunkParts)!, fronds: mergeGeometries(fronds)! }
}

// Keep clear of each stop's building and the view from its jetty
function clearOfStops(x: number, z: number) {
  return layouts.every((l) => {
    if (Math.hypot(x - l.x, z - l.z) < Math.max(l.w, l.d) * 0.72 + 1.2) return false
    const toPad = Math.atan2(l.padX - l.x, l.padZ - l.z)
    const toPt = Math.atan2(x - l.x, z - l.z)
    const off = Math.abs(((toPt - toPad + Math.PI * 3) % TAU) - Math.PI)
    return Math.hypot(x - l.x, z - l.z) > l.island + 1 || off > 0.55
  })
}

// Inside an island's grassy top (not on the beach) and clear of buildings
const PADDY = { x0: -15, x1: 15, z0: -10, z1: 12 } // rice field in the middle of the central island
const inPaddy = (x: number, z: number, m = 0) => x > PADDY.x0 - m && x < PADDY.x1 + m && z > PADDY.z0 - m && z < PADDY.z1 + m

function usePalmSpots() {
  return useMemo(() => {
    const r = seeded(17)
    const spots: { x: number; z: number }[] = []
    // Coconut groves on the central island, round the rice field
    for (let i = 0; i < 400 && spots.length < 90; i++) {
      const [x, z] = onCircle(r() * TAU, Math.sqrt(r()) * (CENTRAL_R - 3))
      if (!inPaddy(x, z, 2)) spots.push({ x, z })
    }
    // A few on each stop's island
    for (const l of layouts) {
      for (let i = 0; i < 40; i++) {
        const [dx, dz] = onCircle(r() * TAU, Math.sqrt(r()) * (l.island - 2))
        if (clearOfStops(l.x + dx, l.z + dz)) spots.push({ x: l.x + dx, z: l.z + dz })
        if (i > 24) break
      }
    }
    for (const t of ISLETS) {
      for (let i = 0; i < 1 + Math.floor(t.r / 2.5); i++) {
        const [dx, dz] = onCircle(r() * TAU, r() * Math.max(0.5, t.r - 2))
        spots.push({ x: t.x + dx, z: t.z + dz })
      }
    }
    // The shore: a thick band of palms at the water's edge, thinning out behind
    const ring = (from: number, spread: number, n: number, power = 1) => {
      for (let i = 0; i < n; i++) {
        const a = r() * TAU
        const [x, z] = onCircle(a, shoreAt(a) + from + Math.pow(r(), power) * spread)
        spots.push({ x, z })
      }
    }
    ring(3, 16, 260, 1.5)
    ring(18, 140, 110)
    return spots.map((p) => ({ ...p, yaw: r() * TAU, scale: 0.8 + r() * 0.4, variant: Math.floor(r() * 3), tint: r() }))
  }, [])
}

// Wind: trunks lean and recover in slow gusts, fronds flutter. Done in the vertex shader, so a few hundred
// palms cost nothing extra on the CPU. Each palm gets its own phase from where it stands.
const wind = { value: 0 }
function swaying(material: MeshStandardMaterial, flutter: boolean) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uWind = wind
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uWind;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        float ph = instanceMatrix[3].x * 0.37 + instanceMatrix[3].z * 0.23;
        float gust = sin(uWind * 0.55 + ph * 0.3) * 0.5 + 0.5;
        float bend = pow(max(position.y, 0.0) / 8.0, 2.0) * (0.25 + gust * 0.55);
        transformed.x += (sin(uWind * 1.1 + ph) * 0.6 + sin(uWind * 2.3 + ph * 1.7) * 0.2) * bend;
        transformed.z += sin(uWind * 0.8 + ph * 1.3) * 0.45 * bend;
        ${flutter ? `float reach = length(position.xz);
        transformed.y += sin(uWind * 3.1 + ph + reach * 1.4) * 0.05 * reach * (0.5 + gust);` : ''}`,
      )
  }
  material.customProgramCacheKey = () => (flutter ? 'palm-frond' : 'palm-trunk')
  return material
}

function Palms() {
  const variants = useMemo(() => [3, 8, 21].map(palmVariant), [])
  const spots = usePalmSpots()
  const frondTex = useMemo(frondTexture, [])
  const mats = useMemo(
    () => ({
      trunk: swaying(new MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }), false),
      fronds: swaying(new MeshStandardMaterial({ map: frondTex, alphaTest: 0.45, side: DoubleSide, roughness: 0.75 }), true),
    }),
    [frondTex],
  )
  useFrame((_, dt) => {
    wind.value += Math.min(dt, 0.1)
  })
  return (
    <>
      {variants.map((v, vi) => {
        const items: Placement[] = spots
          .filter((s) => s.variant === vi)
          .map((s) => ({ ...s, color: new Color().setHSL(0.24 + s.tint * 0.06, 0.55, 0.62 + s.tint * 0.12) }))
        return (
          <group key={vi}>
            <InstancedPalmPart geometry={v.trunk} items={items} material={mats.trunk} />
            <InstancedPalmPart geometry={v.fronds} items={items} material={mats.fronds} colored />
          </group>
        )
      })}
    </>
  )
}

function InstancedPalmPart({ geometry, items, colored, material }: {
  geometry: BufferGeometry; items: Placement[]; colored?: boolean; material: MeshStandardMaterial
}) {
  const ref = useRef<InstancedMesh>(null)
  useLayoutEffect(() => {
    const m = ref.current
    if (!m) return
    const o = new Object3D()
    items.forEach((it, i) => {
      o.position.set(it.x, ISLAND_TOP - 0.05, it.z)
      o.rotation.set(0, it.yaw, 0)
      o.scale.setScalar(it.scale as number)
      o.updateMatrix()
      m.setMatrixAt(i, o.matrix)
      if (colored && it.color) m.setColorAt(i, it.color)
    })
    m.instanceMatrix.needsUpdate = true
    if (m.instanceColor) m.instanceColor.needsUpdate = true
    m.computeBoundingSphere()
  }, [items, colored])
  return (
    <instancedMesh ref={ref} args={[geometry, material, items.length]} castShadow receiveShadow />
  )
}

// ---------- Bushes, flowers and grass inside the blocks ----------

function useGroundCover() {
  return useMemo(() => {
    const r = seeded(29)
    const bushes: Placement[] = []
    const flowers: Placement[] = []
    const grass: Placement[] = []
    const flowerColors = ['#ff5c8a', '#ff5d3d', '#ffd23f', '#FF5C1A', '#ffffff'].map((c) => new Color(c))
    const bush = (x: number, z: number) => {
      const s = 0.6 + r() * 0.8
      bushes.push({ x, z, y: ISLAND_TOP + s * 0.3, yaw: r() * 6, scale: [s * (1 + r() * 0.5), s * 0.75, s], color: new Color().setHSL(0.28 + r() * 0.07, 0.5, 0.2 + r() * 0.1) })
      for (let f = 0; f < 3; f++) {
        const a = r() * TAU
        flowers.push({ x: x + Math.cos(a) * s * 0.8, z: z + Math.sin(a) * s * 0.8, y: ISLAND_TOP + s * 0.5 + r() * 0.2, yaw: 0, scale: 0.09 + r() * 0.05, color: flowerColors[Math.floor(r() * flowerColors.length)] })
      }
    }
    const tuft = (x: number, z: number) =>
      grass.push({ x, z, y: ISLAND_TOP, yaw: r() * 6, scale: 0.7 + r() * 0.8, color: new Color().setHSL(0.22 + r() * 0.08, 0.5, 0.3 + r() * 0.15) })
    const areas = [{ x: 0, z: 0, r: CENTRAL_R - 2, n: LOW_END ? 500 : 1300, b: 70 }, ...layouts.map((l) => ({ x: l.x, z: l.z, r: l.island - 1.5, n: LOW_END ? 50 : 140, b: 6 }))]
    for (const a of areas) {
      for (let i = 0; i < a.n + a.b; i++) {
        const [dx, dz] = onCircle(r() * TAU, Math.sqrt(r()) * a.r)
        const x = a.x + dx
        const z = a.z + dz
        if (!clearOfStops(x, z) || inPaddy(x, z, 0.5)) continue
        if (i < a.b) bush(x, z)
        else tuft(x, z)
      }
    }
    for (let i = 0; i < 160; i++) {
      const a = r() * TAU
      const [x, z] = onCircle(a, shoreAt(a) + 3 + r() * 30)
      bush(x, z)
    }
    return { bushes, flowers, grass }
  }, [])
}

// Water hyacinth floating near the banks: round leaves with the odd lilac flower
function Hyacinth() {
  const { leaves, blooms } = useMemo(() => {
    const r = seeded(51)
    const leaves: Placement[] = []
    const blooms: Placement[] = []
    const patch = (x: number, z: number) => {
      if (Math.abs(Math.hypot(x, z) - CHANNEL_R) < CHANNEL_HALF - 1) return
      if (onLand(x, z, 1.2)) return
      for (let k = 0; k < 6; k++) {
        const px = x + (r() - 0.5) * 3
        const pz = z + (r() - 0.5) * 3
        leaves.push({ x: px, z: pz, y: 0.03, yaw: r() * 6, scale: 0.35 + r() * 0.35, color: new Color().setHSL(0.27 + r() * 0.05, 0.55, 0.28 + r() * 0.1) })
        if (r() < 0.25) blooms.push({ x: px, z: pz, y: 0.18, yaw: 0, scale: 0.12, color: new Color('#b48ee8') })
      }
    }
    for (let i = 0; i < 70; i++) {
      const a = r() * TAU
      const [x, z] = onCircle(a, shoreAt(a) - 2 - r() * 4)
      patch(x, z)
    }
    for (let i = 0; i < 40; i++) {
      const [x, z] = onCircle(r() * TAU, CENTRAL_R + 2.5 + r() * 4)
      patch(x, z)
    }
    return { leaves, blooms }
  }, [])
  const geo = useMemo(() => {
    const leaf = new CircleGeometry(1, 10)
    leaf.rotateX(-Math.PI / 2)
    return { leaf, bloom: new SphereGeometry(1, 6, 4) }
  }, [])
  return (
    <>
      <InstancesWithMaterial geometry={geo.leaf} items={leaves} detail>
        <meshStandardMaterial roughness={0.6} side={DoubleSide} />
      </InstancesWithMaterial>
      <InstancesWithMaterial geometry={geo.bloom} items={blooms} detail>
        <meshStandardMaterial roughness={0.6} />
      </InstancesWithMaterial>
    </>
  )
}

// A tuft of five blades with normals pointing up, so it shades like the ground
function tuftGeometry() {
  const pos: number[] = []
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2
    const lean = 0.12
    const cx = Math.cos(a)
    const cz = Math.sin(a)
    const px = -cz * 0.04
    const pz = cx * 0.04
    pos.push(px, 0, pz, -px, 0, -pz, cx * lean, 0.35 + (i % 2) * 0.12, cz * lean)
  }
  const g = new BufferGeometry()
  g.setAttribute('position', new Float32BufferAttribute(pos, 3))
  g.setAttribute('normal', new Float32BufferAttribute(Array.from({ length: pos.length / 3 }, () => [0, 1, 0]).flat(), 3))
  return g
}

function GroundCover() {
  const { bushes, flowers, grass } = useGroundCover()
  const geo = useMemo(() => ({ bush: new DodecahedronGeometry(1, 1), flower: new SphereGeometry(1, 6, 4), tuft: tuftGeometry() }), [])
  return (
    <>
      <InstancesWithMaterial geometry={geo.bush} items={bushes} castShadow>
        <meshStandardMaterial flatShading roughness={0.9} />
      </InstancesWithMaterial>
      <InstancesWithMaterial geometry={geo.flower} items={flowers} detail>
        <meshStandardMaterial roughness={0.6} />
      </InstancesWithMaterial>
      <InstancesWithMaterial geometry={geo.tuft} items={grass} detail>
        <meshStandardMaterial side={DoubleSide} roughness={1} />
      </InstancesWithMaterial>
    </>
  )
}

function InstancesWithMaterial({ geometry, items, castShadow, detail, children }: {
  geometry: BufferGeometry; items: Placement[]; castShadow?: boolean; detail?: boolean; children: React.ReactNode
}) {
  const ref = useRef<InstancedMesh>(null)
  useLayoutEffect(() => {
    const m = ref.current
    if (!m) return
    if (detail) m.layers.set(DETAIL_LAYER)
    const o = new Object3D()
    items.forEach((it, i) => {
      o.position.set(it.x, it.y ?? 0, it.z)
      o.rotation.set(0, it.yaw, 0)
      if (Array.isArray(it.scale)) o.scale.set(...it.scale)
      else o.scale.setScalar(it.scale)
      o.updateMatrix()
      m.setMatrixAt(i, o.matrix)
      if (it.color) m.setColorAt(i, it.color)
    })
    m.instanceMatrix.needsUpdate = true
    if (m.instanceColor) m.instanceColor.needsUpdate = true
    m.computeBoundingSphere()
  }, [items, detail])
  if (!items.length) return null
  return (
    <instancedMesh ref={ref} args={[geometry, undefined, items.length]} castShadow={castShadow} receiveShadow>
      {children}
    </instancedMesh>
  )
}

// ---------- Houses along the shore: whitewashed walls under tiled hip roofs ----------

function ShoreHouses() {
  const items = useMemo(() => {
    const r = seeded(77)
    const out: Placement[] = []
    for (let i = 0; i < 22; i++) {
      const a = (i / 22) * TAU + (r() - 0.5) * 0.15
      if (Math.abs(((a - 2.05 + Math.PI * 3) % TAU) - Math.PI) < 0.12) continue // leave room for the fishing net
      const [x, z] = onCircle(a, shoreAt(a) + 9 + r() * 6)
      out.push({ x, z, y: ISLAND_TOP, yaw: a + Math.PI, scale: 0.85 + r() * 0.35 })
    }
    return out
  }, [])
  const geo = useMemo(() => {
    const walls = new BoxGeometry(6, 2.8, 4.5)
    walls.translate(0, 1.4, 0)
    const roof = hipRoofGeometry(6, 4.5, 2, 0.9)
    roof.translate(0, 2.8, 0)
    return { walls, roof }
  }, [])
  const tiles = useMemo(() => tileTexture([1, 1]), [])
  return (
    <>
      <InstancesWithMaterial geometry={geo.walls} items={items} castShadow>
        <meshStandardMaterial color="#f1eadb" roughness={0.9} />
      </InstancesWithMaterial>
      <InstancesWithMaterial geometry={geo.roof} items={items} castShadow>
        <meshStandardMaterial map={tiles} roughness={0.85} side={DoubleSide} />
      </InstancesWithMaterial>
    </>
  )
}

export function Nature() {
  return (
    <>
      <Palms />
      <GroundCover />
      <Hyacinth />
      <ShoreHouses />
    </>
  )
}
