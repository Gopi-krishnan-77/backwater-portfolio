// Navigation inside the 3D scene: the route on the water and the screen-space stop markers.
import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { BufferAttribute, BufferGeometry, DoubleSide, Vector3 } from 'three'
import { chevronTexture } from './textures'
import { useGame } from '../store'
import { blipEls } from '../ui/blips'
import { LOW_END } from './Atmosphere'
import { playerPosition } from './player'
import { layouts } from './layout'
import { currentRoute, planRoute } from './route'

// The route drawn on the water: a ribbon with chevrons that flow toward the destination.
// One fixed-size buffer, rewritten in place four times a second (no allocations, no React re-renders).
const MAX_POINTS = 160
const RIBBON_HALF = 0.75
const CHEVRON_SPACING = 2.6 // metres per chevron along the ribbon

function RouteRibbon() {
  const target = useGame((s) => s.target)
  const geo = useMemo(() => {
    const g = new BufferGeometry()
    g.setAttribute('position', new BufferAttribute(new Float32Array(MAX_POINTS * 2 * 3), 3))
    g.setAttribute('uv', new BufferAttribute(new Float32Array(MAX_POINTS * 2 * 2), 2))
    const idx: number[] = []
    for (let i = 0; i < MAX_POINTS - 1; i++) {
      const a = i * 2
      idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3)
    }
    g.setIndex(idx)
    g.setDrawRange(0, 0)
    return g
  }, [])
  const tex = useMemo(chevronTexture, [])
  useFrame((_, dt) => {
    tex.offset.x -= Math.min(dt, 0.1) * 0.9
  })
  useEffect(() => {
    const goal = layouts.find((l) => l.id === target)
    const pos = geo.attributes.position as BufferAttribute
    const uv = geo.attributes.uv as BufferAttribute
    const tick = () => {
      const route = goal ? planRoute(playerPosition.x, playerPosition.z, goal.padX, goal.padZ) : null
      currentRoute.route = route
      if (!route || route.length < 4 || useGame.getState().finale) {
        geo.setDrawRange(0, 0)
        return
      }
      const pts = route.points.slice(0, MAX_POINTS)
      let along = 0
      pts.forEach(([x, z], i) => {
        const [px, pz] = pts[Math.max(0, i - 1)]
        const [nx, nz] = pts[Math.min(pts.length - 1, i + 1)]
        let tx = nx - px
        let tz = nz - pz
        const len = Math.hypot(tx, tz) || 1
        tx /= len
        tz /= len
        if (i > 0) along += Math.hypot(x - pts[i - 1][0], z - pts[i - 1][1])
        // left and right edges, perpendicular to the direction of travel
        pos.setXYZ(i * 2, x - tz * RIBBON_HALF, 0.1, z + tx * RIBBON_HALF)
        pos.setXYZ(i * 2 + 1, x + tz * RIBBON_HALF, 0.1, z - tx * RIBBON_HALF)
        uv.setXY(i * 2, along / CHEVRON_SPACING, 0)
        uv.setXY(i * 2 + 1, along / CHEVRON_SPACING, 1)
      })
      pos.needsUpdate = true
      uv.needsUpdate = true
      geo.setDrawRange(0, (pts.length - 1) * 6)
    }
    tick()
    const id = setInterval(tick, 250)
    return () => clearInterval(id)
  }, [target, geo])
  return (
    <mesh geometry={geo} frustumCulled={false} renderOrder={2}>
      <meshBasicMaterial map={tex} transparent depthWrite={false} side={DoubleSide} />
    </mesh>
  )
}

// Keep markers clear of the header, the minimap and the bottom readout
// (on phones the drive pad takes the bottom-right, so keep a taller bottom margin)
const MARGIN = LOW_END ? { left: 20, right: 20, top: 100, bottom: 190 } : { left: 24, right: 24, top: 120, bottom: 120 }
const world = new Vector3()
const view = new Vector3()

function BlipTracker() {
  const size = useThree((s) => s.size)
  const frame = useRef(0)
  useFrame(({ camera }) => {
    const n = frame.current++
    const { width: W, height: H } = size
    const cx = W / 2
    const cy = H / 2
    for (const l of layouts) {
      const el = blipEls.get(l.id)
      if (!el) continue
      world.set(l.padX, 4.6, l.padZ)
      view.copy(world).applyMatrix4(camera.matrixWorldInverse)
      const behind = view.z > 0
      world.project(camera)
      let x = (world.x + 1) * 0.5 * W
      let y = (1 - world.y) * 0.5 * H
      if (behind) {
        // Mirror points behind the camera so the arrow points the right way, and push them to the bottom
        x = W - x
        y = H * 2
      }
      const inside = !behind && x > MARGIN.left && x < W - MARGIN.right && y > MARGIN.top && y < H - MARGIN.bottom
      let angle = 0
      if (!inside) {
        // Slide toward the screen centre until the marker sits on the margin rectangle
        const dx = x - cx
        const dy = y - cy
        const sx = dx > 0 ? (W - MARGIN.right - cx) / dx : dx < 0 ? (MARGIN.left - cx) / dx : Infinity
        const sy = dy > 0 ? (H - MARGIN.bottom - cy) / dy : dy < 0 ? (MARGIN.top - cy) / dy : Infinity
        const s = Math.min(sx, sy, 1)
        x = cx + dx * s
        y = cy + dy * s
        angle = Math.atan2(dy, dx)
      }
      el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`
      el.style.setProperty('--a', `${angle}rad`)
      el.classList.toggle('blip--edge', !inside)
      el.classList.toggle('blip--flip', x > W - 190) // label goes left only when it would run off the right edge
      if (n % 10 === 0) {
        const d = Math.hypot(l.padX - playerPosition.x, l.padZ - playerPosition.z)
        const label = el.querySelector('.blip-dist')
        if (label) label.textContent = `${Math.round(d)} m`
      }
    }
  }, 0.6) // after the camera has moved this frame, so markers don't lag a frame behind
  return null
}

export function Guidance() {
  return (
    <>
      <RouteRibbon />
      <BlipTracker />
    </>
  )
}
