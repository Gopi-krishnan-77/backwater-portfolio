// Egrets: small flocks of white birds wheeling over the lagoon, flapping and then gliding.
// Three instanced meshes (bodies, left wings, right wings), so the whole sky is three draw calls.
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { DoubleSide, Euler, InstancedMesh, Matrix4, MeshStandardMaterial, PlaneGeometry, Quaternion, SphereGeometry, Vector3 } from 'three'
import { seeded } from './textures'

type Bird = { cx: number; cz: number; r: number; y: number; w: number; phase: number; flap: number }

const FLOCKS = [
  { x: -30, z: 60, n: 5 }, // in view early on, near the first stop
  { x: 40, z: -30, n: 4 },
  { x: -60, z: -50, n: 4 },
  { x: 70, z: 50, n: 3 },
]

function makeBirds(): Bird[] {
  const r = seeded(808)
  const out: Bird[] = []
  for (const f of FLOCKS) {
    const radius = 22 + r() * 20
    const speed = (0.11 + r() * 0.05) * (r() < 0.5 ? 1 : -1)
    const height = 11 + r() * 6
    for (let i = 0; i < f.n; i++) {
      // Loose formation: each bird a little behind, beside and above the one ahead
      out.push({
        cx: f.x + (r() - 0.5) * 4, cz: f.z + (r() - 0.5) * 4, r: radius + (r() - 0.5) * 5,
        y: height + (r() - 0.5) * 3, w: speed, phase: -i * 0.09 + r() * 0.03, flap: 4.5 + r() * 1.5,
      })
    }
  }
  return out
}

const body = new Matrix4()
const part = new Matrix4()
const out = new Matrix4()
const q = new Quaternion()
const e = new Euler()
const p = new Vector3()
const s = new Vector3(1, 1, 1)

export function Birds() {
  const birds = useMemo(makeBirds, [])
  const geo = useMemo(() => {
    const b = new SphereGeometry(1, 8, 6)
    b.scale(0.11, 0.1, 0.42)
    const wing = new PlaneGeometry(0.85, 0.32)
    wing.rotateX(-Math.PI / 2) // lie flat
    wing.translate(0.42, 0, 0.02) // hinge at the body
    return { body: b, wing }
  }, [])
  const mat = useMemo(() => new MeshStandardMaterial({ color: '#fbf8f0', roughness: 0.8, side: DoubleSide }), [])
  const bodies = useRef<InstancedMesh>(null)
  const left = useRef<InstancedMesh>(null)
  const right = useRef<InstancedMesh>(null)

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    birds.forEach((b, i) => {
      const a = t * b.w + b.phase * Math.PI * 2
      p.set(b.cx + Math.sin(a) * b.r, b.y + Math.sin(t * 0.4 + i) * 0.6, b.cz + Math.cos(a) * b.r)
      // Face along the circle, banking into the turn
      const heading = a + (b.w > 0 ? Math.PI / 2 : -Math.PI / 2)
      e.set(0, heading, b.w > 0 ? -0.25 : 0.25, 'YXZ')
      q.setFromEuler(e)
      body.compose(p, q, s)
      bodies.current?.setMatrixAt(i, body)
      // A few strong beats, then a long glide
      const cycle = (t * 0.35 + i * 0.37) % 1
      const beating = cycle < 0.45
      const angle = beating ? Math.sin(t * b.flap + i) * 0.75 : 0.08 + Math.sin(t * 1.3 + i) * 0.04
      part.makeRotationZ(angle)
      left.current?.setMatrixAt(i, out.multiplyMatrices(body, part))
      part.makeRotationZ(Math.PI - angle)
      right.current?.setMatrixAt(i, out.multiplyMatrices(body, part))
    })
    for (const m of [bodies.current, left.current, right.current]) if (m) m.instanceMatrix.needsUpdate = true
  })

  return (
    <>
      <instancedMesh ref={bodies} args={[geo.body, mat, birds.length]} frustumCulled={false} />
      <instancedMesh ref={left} args={[geo.wing, mat, birds.length]} frustumCulled={false} />
      <instancedMesh ref={right} args={[geo.wing, mat, birds.length]} frustumCulled={false} />
    </>
  )
}
