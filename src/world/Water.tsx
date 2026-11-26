// The backwater surface: still, dark water that mirrors the palms and sky, turns olive-green in the
// shallows, laps against every bank with a line of foam, and breaks the low sun into glitter.
import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import {
  ClampToEdgeWrapping, DataTexture, HalfFloatType, LinearFilter, Matrix4, PerspectiveCamera, RedFormat,
  ShaderMaterial, UniformsLib, UniformsUtils, UnsignedByteType, Vector2, Vector3, WebGLRenderTarget, type Mesh,
} from 'three'
import { dusk, LOW_END, SKY_GLSL, SUN_DIR } from './Atmosphere'
import { waterNormals } from './textures'
import { ISLANDS, WATER_Y, islandEdge, shoreEdge } from './layout'

// ---------- Distance to the nearest bank, baked once into a small texture ----------

const EXTENT = 140 // the map covers -EXTENT..EXTENT on x and z
const RES = 256
const MAX_D = 20 // metres stored (beyond this the water is simply "deep")

function shoreDistance() {
  const data = new Uint8Array(RES * RES)
  for (let row = 0; row < RES; row++) {
    const z = ((row + 0.5) / RES) * 2 * EXTENT - EXTENT
    for (let col = 0; col < RES; col++) {
      const x = ((col + 0.5) / RES) * 2 * EXTENT - EXTENT
      let d = shoreEdge(x, z) - Math.hypot(x, z)
      ISLANDS.forEach((i, k) => {
        const dx = x - i.x
        const dz = z - i.z
        const c = Math.hypot(dx, dz)
        if (c - i.r * 1.15 - 2.4 > d) return // can't be the nearest
        d = Math.min(d, c - islandEdge(k, dx, dz))
      })
      data[row * RES + col] = Math.round(Math.min(1, Math.max(0, d / MAX_D)) * 255)
    }
  }
  const t = new DataTexture(data, RES, RES, RedFormat, UnsignedByteType)
  t.magFilter = t.minFilter = LinearFilter
  t.wrapS = t.wrapT = ClampToEdgeWrapping
  t.needsUpdate = true
  return t
}

// ---------- Material ----------

function waterMaterial(reflection: WebGLRenderTarget | null) {
  const normals = waterNormals([1, 1])
  const material = new ShaderMaterial({
    fog: true,
    uniforms: UniformsUtils.merge([
      UniformsLib.fog,
      {
        uTime: { value: 0 },
        uDusk: dusk,
        uSun: { value: SUN_DIR.clone() },
        uNormals: { value: null },
        uShore: { value: null },
        uReflection: { value: null },
        uHasReflection: { value: reflection ? 1 : 0 },
        uTexMatrix: { value: new Matrix4() },
        uShoreMap: { value: new Vector2(1 / (2 * EXTENT), MAX_D) },
      },
    ]),
    vertexShader: /* glsl */ `
      uniform mat4 uTexMatrix;
      varying vec3 vWorld;
      varying vec4 vRefl;
      #include <fog_pars_vertex>
      void main() {
        vec4 world = modelMatrix * vec4(position, 1.0);
        vWorld = world.xyz;
        vRefl = uTexMatrix * world;
        vec4 mvPosition = viewMatrix * world;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform vec3 uSun;
      uniform sampler2D uNormals;
      uniform sampler2D uShore;
      uniform sampler2D uReflection;
      uniform float uHasReflection;
      uniform vec2 uShoreMap;
      varying vec3 vWorld;
      varying vec4 vRefl;
      #include <fog_pars_fragment>
      ${SKY_GLSL}

      // Three layers of ripples drifting different ways, so the pattern never visibly repeats
      vec2 ripples(vec2 p) {
        vec2 a = texture2D(uNormals, p / 9.0 + vec2(uTime * 0.011, uTime * 0.007)).xy * 2.0 - 1.0;
        vec2 b = texture2D(uNormals, p / 5.3 + vec2(-uTime * 0.008, uTime * 0.012)).xy * 2.0 - 1.0;
        vec2 c = texture2D(uNormals, p / 2.1 + vec2(uTime * 0.021, -uTime * 0.016)).xy * 2.0 - 1.0;
        return a + b * 0.6 + c * 0.3;
      }
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

      void main() {
        vec2 p = vWorld.xz;
        vec3 toCam = cameraPosition - vWorld;
        float dist = length(toCam);
        vec3 V = toCam / dist;
        float shore = texture2D(uShore, p * uShoreMap.x + 0.5).r * uShoreMap.y; // metres to the nearest bank

        // Glassy near the banks, flatter in the distance (which also stops it shimmering)
        float strength = 0.085 * mix(0.4, 1.0, smoothstep(0.5, 7.0, shore)) * mix(1.0, 0.3, smoothstep(30.0, 200.0, dist));
        vec2 slope = ripples(p) * strength;
        vec3 N = normalize(vec3(slope.x, 1.0, slope.y));
        float NdV = max(dot(N, V), 0.0);
        // Water reflects little looking straight down and almost everything at a glancing angle;
        // pushed a little stronger than physics, the way backwaters look still and mirror-like
        float fres = 0.1 + 0.9 * pow(1.0 - NdV, 3.5);

        vec3 R = reflect(-V, N);
        R.y = abs(R.y);
        vec3 refl = skyColor(R, uSun);
        // Without the live mirror: darken toward the banks, where the palms would be reflected
        refl = mix(refl, vec3(0.025, 0.045, 0.02), (1.0 - smoothstep(1.0, 14.0, shore)) * 0.75 * smoothstep(0.0, 0.25, 1.0 - R.y));
        if (uHasReflection > 0.5) {
          vec2 uv = vRefl.xy / vRefl.w + slope * 0.4;
          refl = texture2D(uReflection, uv).rgb;
        }

        // Dark, tea-green depths; olive and silty in the shallows
        vec3 deep = vec3(0.010, 0.040, 0.034);
        vec3 shallow = vec3(0.10, 0.13, 0.06);
        vec3 body = mix(shallow, deep, smoothstep(0.0, 9.0, shore)) * (1.0 - uDusk * 0.5);
        vec3 col = mix(body, refl, fres);

        // The sun's reflection: a hot core plus a soft warm sheen around it
        float sd = max(dot(R, uSun), 0.0);
        float sunK = 1.0 - uDusk * 0.55;
        col += vec3(1.0, 0.62, 0.32) * (pow(sd, 1200.0) * 10.0 + pow(sd, 60.0) * 0.35) * sunK;

        // Glitter: each small patch of water tilts its own way and flashes when it catches the sun
        vec2 gp = p * 2.2;
        vec2 cell = floor(gp);
        float seed = hash(cell);
        float beat = floor(uTime * (3.0 + seed * 4.0) + seed * 10.0);
        float h1 = hash(cell + beat * 0.37);
        float h2 = hash(cell.yx + beat * 0.91 + 4.7);
        vec3 Ng = normalize(N + vec3(h1 - 0.5, 0.0, h2 - 0.5) * 0.22);
        float g = pow(max(dot(reflect(-V, Ng), uSun), 0.0), 900.0);
        float dotMask = smoothstep(0.42, 0.1, length(fract(gp) - 0.5));
        col += vec3(1.0, 0.82, 0.58) * g * dotMask * 22.0 * sunK * (1.0 - smoothstep(90.0, 220.0, dist));

        // Foam lapping at every bank: a bright edge and a fainter line that comes and goes
        float wobbleN = texture2D(uNormals, p / 13.0).x;
        float lap = 0.5 + 0.5 * sin(shore * 4.5 - uTime * 1.4 + wobbleN * 6.0);
        float foam = smoothstep(0.9, 0.0, shore) * (0.55 + 0.45 * lap);
        foam += smoothstep(2.8, 1.6, shore) * smoothstep(1.2, 1.9, shore + lap * 0.6) * smoothstep(0.75, 1.0, lap) * 0.45;
        col = mix(col, vec3(0.78, 0.72, 0.62) * (1.0 - uDusk * 0.6), clamp(foam, 0.0, 1.0) * 0.6);

        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
  })
  material.uniforms.uDusk = dusk // shared, not copied: merge() above clones uniform objects
  material.uniforms.uNormals.value = normals
  if (reflection) material.uniforms.uReflection.value = reflection.texture
  return material
}

// ---------- Mirror: the scene rendered upside down from below the water, every frame (desktop only) ----------

const mirror = new PerspectiveCamera()
const camPos = new Vector3()
const ahead = new Vector3()
const up = new Vector3()
const bufferSize = new Vector2()
const BIAS = new Matrix4().set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1)
export const WATER_LAYER = 1 // only the main camera sees the water, so the mirror never draws it
export const DETAIL_LAYER = 2 // grass and flowers: too small to matter in the reflection, so the mirror skips them
// Switched off if the frame rate struggles; the water then reflects the sky gradient instead
export const mirrorQuality = { enabled: !LOW_END }

export function Water() {
  const target = useMemo(() => (LOW_END ? null : new WebGLRenderTarget(1, 1, { type: HalfFloatType, depthBuffer: true })), [])
  const material = useMemo(() => waterMaterial(target), [target])
  const shore = useMemo(shoreDistance, [])
  const mesh = useRef<Mesh>(null)
  const camera = useThree((s) => s.camera)
  useEffect(() => {
    material.uniforms.uShore.value = shore
    camera.layers.enable(WATER_LAYER)
    camera.layers.enable(DETAIL_LAYER)
    mesh.current?.layers.set(WATER_LAYER)
    return () => {
      target?.dispose()
      shore.dispose()
    }
  }, [material, shore, camera, target])

  useFrame(({ gl, scene, camera: cam, clock }) => {
    material.uniforms.uTime.value = clock.elapsedTime
    const on = !!target && mirrorQuality.enabled
    material.uniforms.uHasReflection.value = on ? 1 : 0
    if (!target || !on) return
    const c = cam as PerspectiveCamera
    // Half resolution is plenty: the ripples blur it anyway
    gl.getDrawingBufferSize(bufferSize)
    const w = Math.max(1, Math.round(bufferSize.x * 0.5))
    const h = Math.max(1, Math.round(bufferSize.y * 0.5))
    if (target.width !== w || target.height !== h) target.setSize(w, h)

    // Reflect the camera in the plane y = WATER_Y: position, view direction and up all flip in y
    c.getWorldPosition(camPos)
    c.getWorldDirection(ahead)
    up.set(0, 1, 0).applyQuaternion(c.quaternion)
    mirror.position.set(camPos.x, 2 * WATER_Y - camPos.y, camPos.z)
    mirror.up.set(up.x, -up.y, up.z)
    mirror.lookAt(mirror.position.x + ahead.x, mirror.position.y - ahead.y, mirror.position.z + ahead.z)
    mirror.projectionMatrix.copy(c.projectionMatrix)
    mirror.projectionMatrixInverse.copy(c.projectionMatrixInverse)
    mirror.updateMatrixWorld()
    material.uniforms.uTexMatrix.value.copy(BIAS).multiply(mirror.projectionMatrix).multiply(mirror.matrixWorldInverse)

    // Reuse this frame's shadow map instead of re-rendering it for the mirror
    const autoShadows = gl.shadowMap.autoUpdate
    gl.shadowMap.autoUpdate = false
    gl.setRenderTarget(target)
    gl.clear()
    gl.render(scene, mirror)
    gl.setRenderTarget(null)
    gl.shadowMap.autoUpdate = autoShadows
  }, 0.9) // after the camera has moved (0.5), before the frame is drawn (1)

  return (
    <mesh ref={mesh} rotation={[-Math.PI / 2, 0, 0]} position={[0, WATER_Y, 0]} material={material} frustumCulled={false}>
      <planeGeometry args={[1600, 1600]} />
    </mesh>
  )
}
