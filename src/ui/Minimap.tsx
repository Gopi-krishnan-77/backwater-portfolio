// North-up minimap on a 2D canvas: the lagoon drawn once, then the route, stops and boat on top.
import { useEffect, useRef } from 'react'
import { zones } from '../content'
import { useGame } from '../store'
import { playerHeading, playerPosition } from '../world/player'
import { CHANNEL_R, ISLANDS, islandEdge, shoreEdge } from '../world/layout'
import { currentRoute } from '../world/route'

const SIZE = 184
const SPAN = 280 // world metres across the map
const toMap = (v: number) => ((v + SPAN / 2) / SPAN) * SIZE

function drawBase(dpr: number) {
  const c = document.createElement('canvas')
  c.width = c.height = SIZE * dpr
  const g = c.getContext('2d')!
  g.scale(dpr, dpr)
  const k = SIZE / SPAN
  const circle = (x: number, z: number, r: number) => {
    g.beginPath()
    g.arc(toMap(x), toMap(z), r * k, 0, Math.PI * 2)
  }
  // An outline traced from its edge function, grown or shrunk by `pad` metres
  const outline = (cx: number, cz: number, edge: (dx: number, dz: number) => number, pad: number) => {
    g.beginPath()
    for (let s = 0; s <= 96; s++) {
      const a = (s / 96) * Math.PI * 2
      const dx = Math.sin(a)
      const dz = Math.cos(a)
      const r = edge(dx, dz) + pad
      if (s === 0) g.moveTo(toMap(cx + dx * r), toMap(cz + dz * r))
      else g.lineTo(toMap(cx + dx * r), toMap(cz + dz * r))
    }
  }
  // Land all round, the lagoon, then islands with a sandy rim (the same shorelines as the 3D world)
  g.fillStyle = '#2c5236'
  g.fillRect(0, 0, SIZE, SIZE)
  g.fillStyle = '#d9bf8f'
  outline(0, 0, shoreEdge, 2.5)
  g.fill()
  g.fillStyle = '#17524a'
  outline(0, 0, shoreEdge, 0)
  g.fill()
  ISLANDS.forEach((i, k) => {
    g.fillStyle = '#d9bf8f'
    outline(i.x, i.z, (dx, dz) => islandEdge(k, dx, dz), 0)
    g.fill()
    g.fillStyle = '#3f7a46'
    outline(i.x, i.z, (dx, dz) => islandEdge(k, dx, dz), -2.4)
    g.fill()
  })
  // The story channel, faintly
  g.strokeStyle = 'rgba(250, 250, 248, 0.22)'
  g.setLineDash([3, 4])
  g.lineWidth = 1
  circle(0, 0, CHANNEL_R)
  g.stroke()
  g.setLineDash([])
  return c
}

export function Minimap() {
  const ref = useRef<HTMLCanvasElement>(null)
  const readMode = useGame((s) => s.readMode)

  useEffect(() => {
    if (readMode) return
    const canvas = ref.current
    if (!canvas) return
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    canvas.width = canvas.height = SIZE * dpr
    const g = canvas.getContext('2d')!
    const base = drawBase(dpr)
    let raf = 0
    let last = 0
    const draw = (t: number) => {
      raf = requestAnimationFrame(draw)
      if (t - last < 50) return
      last = t
      const { target, visited } = useGame.getState()
      g.setTransform(1, 0, 0, 1, 0, 0)
      g.drawImage(base, 0, 0)
      g.setTransform(dpr, 0, 0, dpr, 0, 0)

      // GPS route
      const route = currentRoute.route
      if (route && route.points.length > 1) {
        g.save()
        g.strokeStyle = '#FF5C1A'
        g.lineWidth = 2.5
        g.lineJoin = 'round'
        g.beginPath()
        route.points.forEach(([x, z], i) => (i ? g.lineTo(toMap(x), toMap(z)) : g.moveTo(toMap(x), toMap(z))))
        g.stroke()
        g.restore()
      }

      // Stops
      g.font = '700 8px "JetBrains Mono", monospace'
      g.textAlign = 'center'
      g.textBaseline = 'middle'
      zones.forEach((zone, i) => {
        const x = toMap(zone.pad[0])
        const y = toMap(zone.pad[1])
        const done = visited.includes(zone.id)
        const isTarget = zone.id === target
        g.fillStyle = isTarget ? '#FF5C1A' : done ? '#0A2318' : '#FAFAF8'
        g.strokeStyle = done ? '#00E87A' : '#0A2318'
        g.lineWidth = 1.5
        g.beginPath()
        g.arc(x, y, isTarget ? 7.5 : 6.5, 0, Math.PI * 2)
        g.fill()
        g.stroke()
        g.fillStyle = isTarget ? '#ffffff' : done ? '#00E87A' : '#0A2318'
        g.fillText(done ? '✓' : String(i + 1), x, y + 0.5)
      })

      // Boat arrow
      const h = playerHeading.value
      g.save()
      g.translate(toMap(playerPosition.x), toMap(playerPosition.z))
      g.rotate(Math.PI - h) // the arrow is drawn pointing up (north, heading = PI)
      g.fillStyle = '#ffffff'
      g.beginPath()
      g.moveTo(0, -7)
      g.lineTo(5, 5)
      g.lineTo(0, 2.5)
      g.lineTo(-5, 5)
      g.closePath()
      g.fill()
      g.restore()
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [readMode])

  return <canvas ref={ref} className="minimap" style={{ width: SIZE, height: SIZE }} aria-hidden />
}
