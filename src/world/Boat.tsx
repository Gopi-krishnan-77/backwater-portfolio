import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  AdditiveBlending, Color, DoubleSide, ExtrudeGeometry, Group, InstancedMesh, MathUtils,
  MeshPhysicalMaterial, MeshStandardMaterial, Object3D, PerspectiveCamera, Shape, Vector3,
} from 'three'
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { useGame } from '../store'
import { audioFrame, bump, buzz } from '../audio'
import { LOW_END } from './Atmosphere'
import { foamTexture, plankTexture } from './textures'
import { layouts, START, START_HEADING } from './layout'
import { currentRoute } from './route'
import { collide, markerAt } from './collision'
import { playerHeading, playerPosition } from './player'

// Boat handling: thrust along the heading, but the hull's actual motion only slowly
// lines up with it, so turns slide a little like a real boat.
const ACCEL = 9
const REVERSE_ACCEL = 5
const MAX_SPEED = 16
const MAX_REVERSE = 5
const DRAG = 0.55 // coasting
const BRAKE_DRAG = 4.2
const HULL_BRAKE = 3.2 // braking also bleeds off the hull's drift, so the boat actually stops
const STEER = 1.35
const GRIP = 1.9 // how quickly the drift lines back up with the heading

const START_POS = new Vector3(...START)
const camTarget = new Vector3()
const lookTarget = new Vector3()
const lookCurrent = new Vector3()
const dockCam = new Vector3()
const dockLook = new Vector3()
type Layout = (typeof layouts)[number]

// ---------- Hull: a Kerala vallam with upturned bow and stern (x = forward, y = up) ----------

function hullShape() {
  const s = new Shape()
  s.moveTo(-2.4, 0.05)
  s.quadraticCurveTo(0, -0.42, 2.3, 0.0) // keel
  s.quadraticCurveTo(2.75, 0.25, 2.95, 0.98) // bow sweeps up
  s.lineTo(2.74, 0.98)
  s.quadraticCurveTo(2.3, 0.55, 1.8, 0.5)
  s.lineTo(-1.9, 0.5) // gunwale
  s.quadraticCurveTo(-2.35, 0.55, -2.55, 0.78) // stern
  s.lineTo(-2.66, 0.78)
  s.quadraticCurveTo(-2.6, 0.3, -2.4, 0.05)
  return s
}

function hullGeometry() {
  const beam = 1.6
  let g = new ExtrudeGeometry(hullShape(), {
    depth: beam, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.05, bevelSegments: 3, curveSegments: 24,
  })
  g.translate(0, 0, -beam / 2)
  const p = g.attributes.position
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i)
    // Pinch both ends to points, the bow more than the stern
    const t = Math.max(0, (Math.abs(x) - 0.3) / 2.65)
    p.setZ(i, p.getZ(i) * (1 - Math.pow(Math.min(1, t), 1.8) * (x > 0 ? 0.92 : 0.7)))
  }
  g.deleteAttribute('normal')
  g = mergeVertices(g, 1e-4) as ExtrudeGeometry
  g.computeVertexNormals()
  return g
}

function BoatModel({ paint }: { paint: string }) {
  const hull = useMemo(hullGeometry, [])
  const mats = useMemo(
    () => ({
      hull: new MeshPhysicalMaterial({ color: paint, roughness: 0.45, clearcoat: 0.6, clearcoatRoughness: 0.2 }),
      deck: new MeshStandardMaterial({ map: plankTexture([2, 1]), roughness: 0.8 }),
      thatch: new MeshStandardMaterial({ color: '#b98d4f', roughness: 1, side: DoubleSide }),
      bamboo: new MeshStandardMaterial({ color: '#c9a86a', roughness: 0.7 }),
      motor: new MeshStandardMaterial({ color: '#23262b', metalness: 0.5, roughness: 0.4 }),
      cowl: new MeshStandardMaterial({ color: '#FF5C1A', roughness: 0.35 }),
      lamp: new MeshStandardMaterial({ color: '#ffe2a8', emissive: '#ffb347', emissiveIntensity: 6 }),
      flag: new MeshStandardMaterial({ color: '#00E87A', emissive: '#00E87A', emissiveIntensity: 0.6, side: DoubleSide }),
    }),
    [],
  )
  useEffect(() => {
    mats.hull.color.set(paint)
  }, [paint, mats])

  return (
    // Built with x forward; turned so the boat faces +z like the rigid body
    <group rotation={[0, -Math.PI / 2, 0]}>
      <mesh geometry={hull} material={mats.hull} castShadow receiveShadow />
      {/* Plank deck inside the gunwales */}
      <mesh position={[-0.05, 0.505, 0]} rotation={[-Math.PI / 2, 0, 0]} material={mats.deck}>
        <planeGeometry args={[3.7, 1.3]} />
      </mesh>
      {[-1.6, 1.3].map((x) => (
        <mesh key={x} position={[x, 0.68, 0]} material={mats.bamboo} castShadow>
          <boxGeometry args={[0.3, 0.06, 1.4]} />
        </mesh>
      ))}
      {/* Woven thatch canopy on bamboo poles */}
      <mesh position={[-0.25, 0.55, 0]} rotation={[0, 0, Math.PI / 2]} castShadow material={mats.thatch}>
        <cylinderGeometry args={[0.78, 0.78, 2.1, 20, 1, true, 0, Math.PI]} />
      </mesh>
      {[-1.25, 0.75].map((x) =>
        [-0.7, 0.7].map((z) => (
          <mesh key={`${x}${z}`} position={[x, 0.9, z]} material={mats.bamboo}>
            <cylinderGeometry args={[0.03, 0.03, 0.8, 6]} />
          </mesh>
        )),
      )}
      <mesh position={[-0.25, 1.55, 0]} material={mats.bamboo}>
        <cylinderGeometry args={[0.02, 0.02, 0.5, 6]} />
      </mesh>
      <mesh position={[-0.05, 1.7, 0]} material={mats.flag}>
        <planeGeometry args={[0.4, 0.22]} />
      </mesh>
      {/* Outboard motor */}
      <group position={[-2.62, 0.8, 0]}>
        <mesh material={mats.motor} castShadow>
          <boxGeometry args={[0.36, 0.42, 0.32]} />
        </mesh>
        <mesh position={[0, 0.25, 0]} material={mats.cowl}>
          <boxGeometry args={[0.38, 0.1, 0.34]} />
        </mesh>
        <mesh position={[-0.05, -0.55, 0]} material={mats.motor}>
          <cylinderGeometry args={[0.05, 0.05, 0.75, 8]} />
        </mesh>
      </group>
      {/* Bow lantern */}
      <mesh position={[2.72, 1.08, 0]} material={mats.lamp}>
        <sphereGeometry args={[0.09, 10, 8]} />
      </mesh>
    </group>
  )
}

// ---------- Wake: soft foam left behind the stern, spreading out and fading ----------

const WAKE = 56
const WAKE_LIFE = 2.4
const foamColor = new Color()
const dummy = new Object3D()

function Wake({ speed, heading }: { speed: React.MutableRefObject<number>; heading: React.MutableRefObject<number> }) {
  const ref = useRef<InstancedMesh>(null)
  const parts = useMemo(() => Array.from({ length: WAKE }, () => ({ x: 0, z: 0, age: WAKE_LIFE, yaw: 0, s: 1 })), [])
  const foam = useMemo(foamTexture, [])
  const next = useRef(0)
  const timer = useRef(0)
  useFrame((_, rawDt) => {
    const m = ref.current
    if (!m) return
    const dt = Math.min(rawDt, 1 / 30)
    timer.current += dt
    const fast = Math.abs(speed.current) > 1.5
    if (fast && timer.current > 0.07) {
      timer.current = 0
      const p = parts[next.current]
      next.current = (next.current + 1) % WAKE
      const h = heading.current
      const side = (Math.random() - 0.5) * 0.8 // a little irregular, like real foam
      p.x = playerPosition.x - Math.sin(h) * 2.8 + Math.cos(h) * side
      p.z = playerPosition.z - Math.cos(h) * 2.8 - Math.sin(h) * side
      p.age = 0
      p.yaw = h + (Math.random() - 0.5) * 0.6
      p.s = 0.8 + Math.random() * 0.5
    }
    parts.forEach((p, i) => {
      p.age += dt
      const t = Math.min(1, p.age / WAKE_LIFE)
      dummy.position.set(p.x, 0.04, p.z)
      dummy.rotation.set(-Math.PI / 2, 0, p.yaw)
      const s = (0.9 + t * 3.4) * p.s
      dummy.scale.set(s * 1.3, s * 1.9, 1)
      dummy.updateMatrix()
      m.setMatrixAt(i, dummy.matrix)
      foamColor.setScalar(Math.pow(1 - t, 1.6) * 0.17)
      m.setColorAt(i, foamColor)
    })
    m.instanceMatrix.needsUpdate = true
    if (m.instanceColor) m.instanceColor.needsUpdate = true
  })
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, WAKE]} frustumCulled={false}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial map={foam} color="#ffffff" transparent blending={AdditiveBlending} depthWrite={false} />
    </instancedMesh>
  )
}

// ---------- Autopilot ----------

const LOOKAHEAD = 9 // metres along the route to aim at
const wrapAngle = (a: number) => Math.atan2(Math.sin(a), Math.cos(a))

// Steer toward a point a little way along the GPS route; ease off for bends and when nearly there
function pilot(pos: { x: number; z: number }, heading: number, speed: number, target: string | null) {
  const route = currentRoute.route
  const goal = layouts.find((l) => l.id === target)
  if (!route || !goal || route.points.length < 2) return { throttle: 0, steer: 0, brake: true }
  let aim = route.points[route.points.length - 1]
  for (const pt of route.points.slice(1)) {
    if (Math.hypot(pt[0] - pos.x, pt[1] - pos.z) >= LOOKAHEAD) {
      aim = pt
      break
    }
  }
  const error = wrapAngle(Math.atan2(aim[0] - pos.x, aim[1] - pos.z) - heading)
  const toGoal = Math.hypot(goal.padX - pos.x, goal.padZ - pos.z)
  const want = Math.min(MAX_SPEED * 0.8, 1.5 + toGoal * 0.55) * (1 - Math.min(0.75, Math.abs(error) * 0.9))
  return {
    throttle: speed < want ? 1 : 0,
    steer: MathUtils.clamp(error * 2.2, -1, 1),
    brake: speed > want + 2.5,
  }
}

// ---------- The boat ----------

export function Boat() {
  const root = useRef<Group>(null)
  const pos = useRef({ x: START_POS.x, z: START_POS.z })
  const actualSpeed = useRef(0) // how fast the boat really moved last frame, after collisions
  const hullGroup = useRef<Group>(null)
  const speed = useRef(0)
  const heading = useRef(START_HEADING)
  const vel = useRef({ x: 0, z: 0 })
  const startedAt = useRef(-1)
  const stuck = useRef(0)
  const unstickUntil = useRef(0)
  const dockMix = useRef(0) // 0 = chase camera, 1 = the arrival shot at a stop
  const dockAt = useRef<Layout | null>(null)
  const dockSide = useRef(1)
  const finaleMix = useRef(0)
  const lastBump = useRef(0)
  const orbit = useRef({ a0: 0, t0: -1 })
  const resetTick = useGame((s) => s.resetTick)
  const paint = useGame((s) => s.paint)

  // Mounting the boat means the scene is up, so this ends the loading screen
  useEffect(() => useGame.getState().setReady(), [])

  useEffect(() => {
    speed.current = 0
    heading.current = START_HEADING
    vel.current = { x: 0, z: 0 }
    pos.current = { x: START_POS.x, z: START_POS.z }
  }, [resetTick])

  useFrame((state, rawDt) => {
    const dt = Math.min(rawDt, 1 / 30)
    const game = useGame.getState()
    const { forward, back, left, right, brake } = game.input

    // Controls as amounts: from the keys or pad, or from the autopilot
    let throttle = forward ? 1 : 0
    let reverse = back ? 1 : 0
    let steer = (left ? 1 : 0) - (right ? 1 : 0)
    let hold = brake
    const actual = actualSpeed.current
    if (game.autopilot) {
      const ap = pilot(pos.current, heading.current, speed.current, game.target)
      throttle = ap.throttle
      steer = ap.steer
      hold = ap.brake
      // Wedged against something: back off for a moment, then try again
      stuck.current = throttle > 0 && actual < 0.6 ? stuck.current + dt : 0
      if (stuck.current > 1.2) unstickUntil.current = state.clock.elapsedTime + 1
      if (state.clock.elapsedTime < unstickUntil.current) {
        throttle = 0
        reverse = 1
        steer = -steer
        stuck.current = 0
      }
    } else if (performance.now() < game.dockUntil && !forward && !back && !left && !right) {
      hold = true // the autopilot just arrived: come to a stop at the jetty
    }

    // Throttle
    speed.current += ACCEL * throttle * dt
    if (reverse) speed.current -= (speed.current > 0.5 ? ACCEL * 1.2 : REVERSE_ACCEL) * dt
    const braking = hold || (reverse > 0 && speed.current > 0.5)
    speed.current *= 1 - Math.min(1, (braking ? BRAKE_DRAG : DRAG) * dt)
    speed.current = Math.max(-MAX_REVERSE, Math.min(MAX_SPEED, speed.current))
    if (braking) {
      const hold = 1 - Math.min(1, HULL_BRAKE * dt)
      vel.current.x *= hold
      vel.current.z *= hold
    }

    // Ran aground or into a jetty: don't keep pushing at full speed
    if (Math.abs(speed.current) > actual + 2.5) speed.current = Math.sign(speed.current) * (actual + 2.5)

    // A boat turns even when slow, just less sharply
    const authority = MathUtils.clamp(Math.abs(speed.current) / 4, 0.3, 1)
    heading.current += steer * STEER * authority * (speed.current < -0.3 ? -1 : 1) * dt

    // Drift: the hull's motion catches up with the heading gradually
    const dirX = Math.sin(heading.current)
    const dirZ = Math.cos(heading.current)
    const k = 1 - Math.exp(-GRIP * dt)
    vel.current.x += (dirX * speed.current - vel.current.x) * k
    vel.current.z += (dirZ * speed.current - vel.current.z) * k

    // Move, then slide out of anything solid (islands, jetties, moored boats, the shore)
    const p0x = pos.current.x
    const p0z = pos.current.z
    pos.current.x += vel.current.x * dt
    pos.current.z += vel.current.z * dt
    const vx0 = vel.current.x
    const vz0 = vel.current.z
    collide(pos.current, vel.current, heading.current)
    // A hard knock against something: a thud, and a buzz on phones
    const impact = Math.hypot(vel.current.x - vx0, vel.current.z - vz0)
    if (impact > 3 && state.clock.elapsedTime - lastBump.current > 0.6) {
      lastBump.current = state.clock.elapsedTime
      bump(impact)
      buzz(Math.min(40, 10 + impact * 2))
    }
    audioFrame(actualSpeed.current, dt)
    actualSpeed.current = Math.hypot(pos.current.x - p0x, pos.current.z - p0z) / Math.max(dt, 1e-4)
    const r = root.current
    if (r) {
      r.position.set(pos.current.x, 0, pos.current.z)
      r.rotation.y = heading.current
    }
    playerPosition.set(pos.current.x, 0, pos.current.z)
    playerHeading.value = heading.current

    // Steering onto (or off) a stop's marker opens (or closes) its panel
    const at = markerAt(pos.current.x, pos.current.z, game.activeZone)
    if (at !== game.activeZone) game.setActiveZone(at)

    // Bobbing on the water, bow lifting under power and leaning into turns
    const now = state.clock.elapsedTime
    const g = hullGroup.current
    if (g) {
      const s = speed.current / MAX_SPEED
      g.position.y = Math.sin(now * 1.7) * 0.05
      g.rotation.x = MathUtils.lerp(g.rotation.x, -Math.max(0, s) * 0.08 + Math.sin(now * 1.3) * 0.02, 1 - Math.exp(-4 * dt))
      g.rotation.z = MathUtils.lerp(g.rotation.z, steer * s * 0.09 + Math.sin(now * 1.1) * 0.025, 1 - Math.exp(-4 * dt))
    }

  })

  // Camera runs after every other per-frame update (priority 0.5; the composer renders at 1),
  // so it always follows the position the boat is actually drawn at this frame
  useFrame((state, rawDt) => {
    const dt = Math.min(rawDt, 1 / 30)
    const now = state.clock.elapsedTime
    const p = pos.current
    const dirX = Math.sin(heading.current)
    const dirZ = Math.cos(heading.current)

    const cam = state.camera as PerspectiveCamera
    // Title card: a slow aerial orbit over the backwaters
    if (!useGame.getState().started) {
      const a = now * 0.045
      cam.position.set(Math.sin(a) * 150, 72, Math.cos(a) * 150)
      lookCurrent.set(0, 0, 0)
      cam.lookAt(lookCurrent)
      startedAt.current = -1
      return
    }
    if (startedAt.current < 0) startedAt.current = now
    const swooping = now - startedAt.current < 2.8 // glide down from the aerial shot after Start

    // Chase camera, high enough to read the water ahead. On a portrait phone the view is narrow,
    // so sit further back and higher or the boat fills the screen.
    const portrait = state.size.width < state.size.height
    // Where the stop card sits: right on desktop, left on a phone held sideways, bottom on other touch screens
    const panelSide = !LOW_END ? 'right' : !portrait && state.size.height <= 540 ? 'left' : 'bottom'
    const camBack = portrait ? 14 : 10
    const camUp = portrait ? 6.2 : 4.4
    const follow = 1 - Math.exp(-(swooping ? 1.5 : 3.8) * dt)
    camTarget.set(p.x - dirX * camBack, camUp, p.z - dirZ * camBack)
    lookTarget.set(p.x + dirX * (portrait ? 9 : 6), 0.8, p.z + dirZ * (portrait ? 9 : 6))

    // Arrival shot: once the boat settles at a stop, swing round to frame the boat, the jetty and the
    // building together, leaving room for the panel (right on wide screens, bottom on phones).
    // Pulling away blends back to the chase camera.
    const game = useGame.getState()
    const here = !swooping && game.activeZone && Math.abs(speed.current) < 4 ? layouts.find((l) => l.id === game.activeZone) : undefined
    if (here && dockAt.current?.id !== here.id) {
      // Stay on the side the camera is already on, so the swing is short
      const qx = (here.padZ - here.z) / here.dist
      const qz = -(here.padX - here.x) / here.dist
      dockSide.current = Math.sign((cam.position.x - here.padX) * qx + (cam.position.z - here.padZ) * qz) || 1
    }
    if (here) dockAt.current = here
    dockMix.current += ((here ? 1 : 0) - dockMix.current) * (1 - Math.exp(-(here ? 0.9 : 2) * dt))
    const L = dockAt.current
    if (L && dockMix.current > 0.001) {
      // From out on the water beyond the boat, a little to one side, looking back down the jetty:
      // the boat in the foreground, the festoon lights leading the eye to the building
      const ux = (L.padX - L.x) / L.dist
      const uz = (L.padZ - L.z) / L.dist
      const side = dockSide.current * 7
      const tall = Math.min(L.h, 24)
      const back = 13 + tall * 0.12
      dockCam.set(L.padX + ux * back + uz * side, 6.5 + tall * 0.3, L.padZ + uz * back - ux * side)
      dockLook.set(L.x + ux * L.dist * 0.25, 1 + tall * 0.4, L.z + uz * L.dist * 0.25)
      const fx = dockLook.x - dockCam.x
      const fz = dockLook.z - dockCam.z
      const reach = Math.hypot(fx, fz)
      if (panelSide === 'bottom') dockLook.y -= reach * 0.14 // lift the scene up the screen
      else {
        // Aim toward the card, so the subject sits in the open part of the screen
        const k = panelSide === 'left' ? -0.24 : 0.2
        dockLook.x -= (fz / reach) * reach * k
        dockLook.z += (fx / reach) * reach * k
      }
      const m = MathUtils.smootherstep(dockMix.current, 0, 1)
      camTarget.lerp(dockCam, m)
      lookTarget.lerp(dockLook, m)
    }
    // Finale: rise into a slow orbit high over the lagoon, every finished stop lit below.
    // The card takes the left of a wide screen (bottom of a phone), so the lagoon is framed beside it.
    const finale = game.finale
    finaleMix.current += ((finale ? 1 : 0) - finaleMix.current) * (1 - Math.exp(-(finale ? 0.55 : 1.6) * dt))
    if (finale && orbit.current.t0 < 0) orbit.current = { a0: Math.atan2(cam.position.x, cam.position.z), t0: now }
    if (!finale && finaleMix.current < 0.01) orbit.current.t0 = -1
    if (finaleMix.current > 0.001) {
      const a = orbit.current.a0 + (now - orbit.current.t0) * 0.035
      dockCam.set(Math.sin(a) * 112, 46, Math.cos(a) * 112)
      dockLook.set(0, panelSide === 'bottom' ? -24 : 0, 0)
      if (!portrait) {
        // aim left of the centre, so the lagoon sits to the right of the card
        // camera right is (cos a, -sin a) when looking at the centre from angle a
        dockLook.x -= Math.cos(a) * 38
        dockLook.z += Math.sin(a) * 38
      }
      const m = MathUtils.smootherstep(finaleMix.current, 0, 1)
      camTarget.lerp(dockCam, m)
      lookTarget.lerp(dockLook, m)
    }

    cam.position.lerp(camTarget, finaleMix.current > 0.001 ? 1 - Math.exp(-2 * dt) : follow)
    lookCurrent.lerp(lookTarget, 1 - Math.exp(-(swooping ? 2.4 : finaleMix.current > 0.001 ? 3 : 10) * dt))
    cam.lookAt(lookCurrent)
    const fov = 55 + (Math.abs(speed.current) / MAX_SPEED) * 8
    if (Math.abs(cam.fov - fov) > 0.01) {
      cam.fov = MathUtils.lerp(cam.fov, fov, follow)
      cam.updateProjectionMatrix()
    }
  }, 0.5)

  return (
    <>
      <group ref={root} position={START_POS.toArray()} rotation={[0, START_HEADING, 0]}>
        <group ref={hullGroup}>
          <BoatModel paint={paint} />
        </group>
      </group>
      <Wake speed={speed} heading={heading} />
    </>
  )
}
