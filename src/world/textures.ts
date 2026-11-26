// Procedural textures drawn on canvases at startup: no image downloads, and they tile seamlessly.
import { CanvasTexture, ClampToEdgeWrapping, NoColorSpace, RepeatWrapping, SRGBColorSpace, type Texture } from 'three'

export function seeded(seed: number) {
  let s = seed % 2147483647
  if (s <= 0) s += 2147483646
  return () => (s = (s * 16807) % 2147483647) / 2147483647
}

type Speck = { color: string; count: number; size: [number, number]; alpha?: number }
type Blob = { color: string; count: number; size: [number, number]; alpha: number }

function canvas(w: number, h = w) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return [c, c.getContext('2d')!] as const
}

// Draw at (x, y) and at the wrapped copies when near an edge, so the tile has no seams
function wrapped(size: number, x: number, y: number, r: number, draw: (x: number, y: number) => void) {
  const xs = [x, ...(x < r ? [x + size] : x > size - r ? [x - size] : [])]
  const ys = [y, ...(y < r ? [y + size] : y > size - r ? [y - size] : [])]
  for (const px of xs) for (const py of ys) draw(px, py)
}

function speckled(size: number, base: string, blobs: Blob[], specks: Speck[], seed: number) {
  const [c, g] = canvas(size)
  const r = seeded(seed)
  g.fillStyle = base
  g.fillRect(0, 0, size, size)
  // Large soft patches break up visible tiling
  for (const b of blobs) {
    for (let i = 0; i < b.count; i++) {
      const x = r() * size
      const y = r() * size
      const rad = b.size[0] + r() * (b.size[1] - b.size[0])
      wrapped(size, x, y, rad, (px, py) => {
        const grad = g.createRadialGradient(px, py, 0, px, py, rad)
        grad.addColorStop(0, b.color)
        grad.addColorStop(1, 'rgba(0,0,0,0)')
        g.globalAlpha = b.alpha
        g.fillStyle = grad
        g.fillRect(px - rad, py - rad, rad * 2, rad * 2)
      })
    }
  }
  for (const s of specks) {
    g.fillStyle = s.color
    g.globalAlpha = s.alpha ?? 1
    for (let i = 0; i < s.count; i++) {
      const x = r() * size
      const y = r() * size
      const d = s.size[0] + r() * (s.size[1] - s.size[0])
      g.fillRect(x, y, d, d)
    }
  }
  g.globalAlpha = 1
  return c
}

const canvases = new Map<string, HTMLCanvasElement>()
function once(key: string, make: () => HTMLCanvasElement) {
  let c = canvases.get(key)
  if (!c) canvases.set(key, (c = make()))
  return c
}

function toTexture(c: HTMLCanvasElement, repeat: [number, number], color = true): Texture {
  const t = new CanvasTexture(c)
  t.wrapS = t.wrapT = RepeatWrapping
  t.repeat.set(repeat[0], repeat[1])
  t.anisotropy = 8
  t.colorSpace = color ? SRGBColorSpace : NoColorSpace
  return t
}

export const grassTexture = (repeat: [number, number]) =>
  toTexture(
    once('grass', () =>
      speckled(
        512,
        '#5b8a3c',
        [
          { color: '#3f6d2b', count: 26, size: [40, 110], alpha: 0.35 },
          { color: '#8fae4f', count: 22, size: [30, 90], alpha: 0.25 },
        ],
        [
          { color: '#466f30', count: 16000, size: [0.6, 1.8] },
          { color: '#73a04a', count: 12000, size: [0.6, 1.6] },
          { color: '#a3ad5a', count: 2500, size: [0.5, 1.2], alpha: 0.8 },
          { color: '#2f5222', count: 3000, size: [0.6, 1.4], alpha: 0.7 },
        ],
        11,
      ),
    ),
    repeat,
  )

// Coconut frond: a midrib with drooping leaflets, on a transparent background (used with alphaTest).
// u runs along the frond, v across it.
export const frondTexture = () => {
  const t = toTexture(
    once('frond', () => {
      const [c, g] = canvas(512, 128)
      const r = seeded(5)
      g.lineCap = 'round'
      for (let x = 10; x < 500; x += 5) {
        const t = x / 512
        const env = Math.pow(Math.sin(Math.PI * (0.06 + 0.9 * t)), 0.7)
        const len = 58 * env * (0.8 + r() * 0.2)
        const sweep = 26 * env
        const light = 26 + r() * 16
        g.strokeStyle = `hsl(${88 + r() * 22}, ${42 + r() * 14}%, ${light}%)`
        g.lineWidth = 2.2 + 2.2 * env
        for (const side of [-1, 1]) {
          g.beginPath()
          g.moveTo(x, 64)
          g.quadraticCurveTo(x + sweep * 0.25, 64 + side * len * 0.6, x + sweep, 64 + side * len)
          g.stroke()
        }
      }
      g.strokeStyle = '#8a8a3c'
      g.lineWidth = 5
      g.beginPath(); g.moveTo(0, 64); g.lineTo(505, 64); g.stroke()
      return c
    }),
    [1, 1],
  )
  t.wrapS = t.wrapT = ClampToEdgeWrapping
  return t
}

// Tileable ripple normal map built from integer-frequency sine waves (analytic derivatives)
export const waterNormals = (repeat: [number, number]) =>
  toTexture(
    once('water', () => {
      const S = 256
      const [c, g] = canvas(S)
      const img = g.createImageData(S, S)
      const r = seeded(77)
      const waves = Array.from({ length: 14 }, () => ({
        kx: Math.round((r() - 0.5) * 16) || 1,
        ky: Math.round((r() - 0.5) * 16),
        a: 0.3 + r() * 0.7,
        p: r() * Math.PI * 2,
      }))
      for (let y = 0; y < S; y++) {
        for (let x = 0; x < S; x++) {
          let dx = 0
          let dy = 0
          for (const w of waves) {
            const ph = ((w.kx * x + w.ky * y) / S) * Math.PI * 2 + w.p
            const k = w.a * Math.cos(ph) * 0.06
            dx += k * w.kx
            dy += k * w.ky
          }
          const len = Math.hypot(dx, dy, 1)
          const i = (y * S + x) * 4
          img.data[i] = ((-dx / len) * 0.5 + 0.5) * 255
          img.data[i + 1] = ((-dy / len) * 0.5 + 0.5) * 255
          img.data[i + 2] = ((1 / len) * 0.5 + 0.5) * 255
          img.data[i + 3] = 255
        }
      }
      g.putImageData(img, 0, 0)
      return c
    }),
    repeat,
    false,
  )

// Vertical fade for the light beams over the zone pads (alphaMap reads the green channel)
export const fadeTexture = () => {
  const t = toTexture(
    once('fade', () => {
      const [c, g] = canvas(4, 128)
      const grad = g.createLinearGradient(0, 0, 0, 128)
      grad.addColorStop(0, '#000')
      grad.addColorStop(1, '#fff')
      g.fillStyle = grad
      g.fillRect(0, 0, 4, 128)
      return c
    }),
    [1, 1],
    false,
  )
  t.wrapS = t.wrapT = ClampToEdgeWrapping
  return t
}

// Soft dark blob under the car, faking contact shadow / ambient occlusion
export const blobTexture = () => {
  const t = toTexture(
    once('blob', () => {
      const [c, g] = canvas(128)
      const grad = g.createRadialGradient(64, 64, 4, 64, 64, 64)
      grad.addColorStop(0, 'rgba(0,0,0,0.75)')
      grad.addColorStop(0.55, 'rgba(0,0,0,0.4)')
      grad.addColorStop(1, 'rgba(0,0,0,0)')
      g.fillStyle = grad
      g.fillRect(0, 0, 128, 128)
      return c
    }),
    [1, 1],
  )
  t.wrapS = t.wrapT = ClampToEdgeWrapping
  return t
}

export const sandTexture = (repeat: [number, number]) =>
  toTexture(
    once('sand', () =>
      speckled(
        512,
        '#e9cfa3',
        [
          { color: '#d6b583', count: 20, size: [40, 120], alpha: 0.35 },
          { color: '#f6e2bf', count: 16, size: [30, 90], alpha: 0.3 },
        ],
        [
          { color: '#cfae7c', count: 14000, size: [0.5, 1.4] },
          { color: '#fbecd0', count: 10000, size: [0.5, 1.3] },
          { color: '#a88a60', count: 1500, size: [0.5, 1.1], alpha: 0.7 },
        ],
        59,
      ),
    ),
    repeat,
  )

// Art Deco facade: a grid of window bays (8 x 8 per tile). The colour map is white walls
// (tinted by the material colour) with dark glass; the emissive map lights ~30% of windows.
const BAY = 32
function facadeCanvases() {
  const S = BAY * 8
  const [map, g] = canvas(S)
  const [lit, e] = canvas(S)
  const r = seeded(91)
  g.fillStyle = '#ffffff'
  g.fillRect(0, 0, S, S)
  e.fillStyle = '#000000'
  e.fillRect(0, 0, S, S)
  const glows = ['#ffcf8a', '#ffcf8a', '#ffb070', '#ff7ab8', '#7fffe8']
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const x = col * BAY + 6
      const y = row * BAY + 7
      const w = BAY - 12
      const h = BAY - 13
      const on = r() < 0.3
      const grad = g.createLinearGradient(x, y, x + w, y + h)
      grad.addColorStop(0, on ? '#ffe7bf' : '#3a4a6e')
      grad.addColorStop(1, on ? '#f3c98f' : '#1c2238')
      g.fillStyle = grad
      g.fillRect(x, y, w, h)
      g.fillStyle = 'rgba(255,255,255,0.35)'
      g.fillRect(x + w / 2 - 0.5, y, 1, h) // mullion
      // eyebrow shade over each window
      g.fillStyle = 'rgba(0,0,0,0.12)'
      g.fillRect(x - 2, y - 3, w + 4, 2)
      if (on) {
        e.fillStyle = glows[Math.floor(r() * glows.length)]
        e.fillRect(x, y, w, h)
      }
    }
  }
  return { map, lit }
}

let facade: ReturnType<typeof facadeCanvases> | null = null
export function facadeTextures(w: number, h: number, bay = 3, floor = 3.4) {
  facade ??= facadeCanvases()
  const repeat: [number, number] = [w / (bay * 8), h / (floor * 8)]
  return { map: toTexture(facade.map, repeat), emissive: toTexture(facade.lit, repeat) }
}

// Kerala terracotta roof tiles: overlapping rows of half-round tiles
export const tileTexture = (repeat: [number, number]) =>
  toTexture(
    once('tiles', () => {
      const [c, g] = canvas(256)
      const r = seeded(13)
      g.fillStyle = '#9c3f22'
      g.fillRect(0, 0, 256, 256)
      for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
          const x = col * 32 + (row % 2) * 16
          const y = row * 32
          const shade = 0.85 + r() * 0.3
          const grad = g.createLinearGradient(x, 0, x + 32, 0)
          grad.addColorStop(0, `rgba(${120 * shade},${48 * shade},${26 * shade},1)`)
          grad.addColorStop(0.5, `rgba(${196 * shade},${92 * shade},${52 * shade},1)`)
          grad.addColorStop(1, `rgba(${120 * shade},${48 * shade},${26 * shade},1)`)
          g.fillStyle = grad
          for (const dx of [0, -256, 256]) g.fillRect(x + dx + 1, y, 30, 30)
        }
        g.fillStyle = 'rgba(40, 14, 6, 0.55)'
        g.fillRect(0, row * 32 + 28, 256, 4)
      }
      return c
    }),
    repeat,
  )

// Weathered wooden planks, running along u
export const plankTexture = (repeat: [number, number]) =>
  toTexture(
    once('planks', () => {
      const [c, g] = canvas(256)
      const r = seeded(17)
      for (let i = 0; i < 8; i++) {
        const l = 30 + r() * 12
        g.fillStyle = `hsl(28, ${32 + r() * 10}%, ${l}%)`
        g.fillRect(0, i * 32, 256, 32)
        g.fillStyle = 'rgba(30, 16, 6, 0.6)'
        g.fillRect(0, i * 32 + 30, 256, 2)
        for (let k = 0; k < 40; k++) {
          g.fillStyle = `rgba(${r() < 0.5 ? '20,10,4' : '255,230,200'}, ${0.08 + r() * 0.08})`
          g.fillRect(r() * 256, i * 32 + r() * 30, 20 + r() * 60, 1)
        }
      }
      return c
    }),
    repeat,
  )

// Football pitch with markings, u along the length
export const pitchTexture = () =>
  toTexture(
    once('pitch', () => {
      const [c, g] = canvas(512, 320)
      for (let i = 0; i < 10; i++) {
        g.fillStyle = i % 2 ? '#3f8f3a' : '#4a9c42'
        g.fillRect((i * 512) / 10, 0, 512 / 10 + 1, 320)
      }
      g.strokeStyle = 'rgba(255,255,255,0.92)'
      g.lineWidth = 4
      g.strokeRect(14, 14, 484, 292)
      g.beginPath(); g.moveTo(256, 14); g.lineTo(256, 306); g.stroke()
      g.beginPath(); g.arc(256, 160, 42, 0, Math.PI * 2); g.stroke()
      g.strokeRect(14, 80, 70, 160)
      g.strokeRect(428, 80, 70, 160)
      g.strokeRect(14, 125, 26, 70)
      g.strokeRect(472, 125, 26, 70)
      return c
    }),
    [1, 1],
  )

// Fishing-net mesh on a transparent background (use with alphaTest)
export const netTexture = () =>
  toTexture(
    once('net', () => {
      const [c, g] = canvas(256)
      g.strokeStyle = 'rgba(235, 225, 200, 0.95)'
      g.lineWidth = 2
      for (let i = 0; i <= 256; i += 16) {
        g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 256); g.stroke()
        g.beginPath(); g.moveTo(0, i); g.lineTo(256, i); g.stroke()
      }
      return c
    }),
    [3, 3],
  )

// Red and white lighthouse bands, v up the tower
export const bandTexture = () =>
  toTexture(
    once('bands', () => {
      const [c, g] = canvas(4, 256)
      for (let i = 0; i < 6; i++) {
        g.fillStyle = i % 2 ? '#f4efe6' : '#c8322a'
        g.fillRect(0, (i * 256) / 6, 4, 256 / 6 + 1)
      }
      return c
    }),
    [1, 1],
  )

// Route ribbon: a soft orange band with chevrons pointing along +u (toward the destination)
export const chevronTexture = () => {
  const t = toTexture(
    once('chevrons', () => {
      const [c, g] = canvas(128, 64)
      g.fillStyle = 'rgba(255, 92, 26, 0.38)'
      g.fillRect(0, 10, 128, 44)
      g.strokeStyle = 'rgba(255, 236, 214, 0.95)'
      g.lineWidth = 9
      g.lineCap = 'round'
      g.lineJoin = 'round'
      g.beginPath()
      g.moveTo(44, 16)
      g.lineTo(76, 32)
      g.lineTo(44, 48)
      g.stroke()
      return c
    }),
    [1, 1],
  )
  t.wrapT = ClampToEdgeWrapping
  return t
}

// Soft foam blob for the wake: white in the middle, fading to nothing (used with additive blending)
export const foamTexture = () => {
  const t = toTexture(
    once('foam', () => {
      const [c, g] = canvas(64)
      const grad = g.createRadialGradient(32, 32, 2, 32, 32, 32)
      grad.addColorStop(0, 'rgba(255,255,255,1)')
      grad.addColorStop(0.45, 'rgba(255,255,255,0.45)')
      grad.addColorStop(1, 'rgba(255,255,255,0)')
      g.fillStyle = grad
      g.fillRect(0, 0, 64, 64)
      return c
    }),
    [1, 1],
  )
  t.wrapS = t.wrapT = ClampToEdgeWrapping
  return t
}
