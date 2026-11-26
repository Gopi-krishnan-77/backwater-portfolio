// Shared Kerala architecture geometry.
import { BufferGeometry, Float32BufferAttribute } from 'three'

// Hip roof with a ridge along the longer side, eaves overhanging the walls, and planar UVs
// (in metres) so a tile texture runs down each slope. Sits on y = 0.
export function hipRoofGeometry(w: number, d: number, rise: number, overhang = 0.8) {
  const W = w + overhang * 2
  const D = d + overhang * 2
  const swap = D > W
  const [L, S] = swap ? [D, W] : [W, D] // long and short side
  const A = [-L / 2, 0, -S / 2], B = [L / 2, 0, -S / 2], C = [L / 2, 0, S / 2], Dd = [-L / 2, 0, S / 2]
  const R1 = [-(L - S) / 2, rise, 0], R2 = [(L - S) / 2, rise, 0]
  const tris = [Dd, C, R2, Dd, R2, R1, B, A, R1, B, R1, R2, A, Dd, R1, C, B, R2]
  const pos: number[] = []
  const uv: number[] = []
  for (const v of tris) {
    const [x, y, z] = swap ? [v[2], v[1], v[0]] : v
    pos.push(x, y, z)
    uv.push(x / 2, (Math.abs(z) + Math.abs(x) * 0.3 + y) / 2)
  }
  const g = new BufferGeometry()
  g.setAttribute('position', new Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2))
  g.computeVertexNormals()
  return g
}
