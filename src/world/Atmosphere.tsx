import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Environment, Lightformer } from '@react-three/drei'
import { Bloom, EffectComposer, ToneMapping, Vignette } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'
import { BackSide, Color, MathUtils, MeshStandardMaterial, ShaderMaterial, Vector3, type DirectionalLight, type HemisphereLight, type Mesh } from 'three'
import { useGame } from '../store'
import { playerPosition } from './player'

// Sun setting low in the west over the Arabian Sea; the ride starts heading into it
export const SUN_DIR = new Vector3(-1, 0.17, 0.28).normalize()
export const FOG = '#e7b38d' // golden-hour haze, close to the sky at the horizon

// Lit windows: dim in daylight, glowing once dusk falls (shared by every building's glass)
export const windowGlow = new MeshStandardMaterial({ color: '#1c3a3a', emissive: '#ffb070', emissiveIntensity: 0.25, roughness: 0.08, metalness: 0.4 })

// True on phones and tablets: skip the most expensive effects there
// (set on <html> by the script in index.html, which checks touch points and screen size too)
export const LOW_END = typeof document !== 'undefined' && document.documentElement.hasAttribute('data-touch')

// Golden-hour gradient: soft blue overhead, warm peach band, glowing horizon and sun.
// Shared with the water, which reflects it where there's no mirrored scene to show.
// uDusk (0..1) fades it to the blue hour for the finale.
export const dusk = { value: 0 }
export const SKY_GLSL = /* glsl */ `
  uniform float uDusk;
  vec3 lin(vec3 c) { return pow(c, vec3(2.2)); }
  vec3 skyColor(vec3 d, vec3 sunDir) {
    float h = d.y;
    vec3 zenith  = mix(lin(vec3(0.22, 0.40, 0.60)), lin(vec3(0.06, 0.08, 0.20)), uDusk);
    vec3 high    = mix(lin(vec3(0.55, 0.65, 0.76)), lin(vec3(0.20, 0.18, 0.34)), uDusk);
    vec3 band    = mix(lin(vec3(1.00, 0.80, 0.62)), lin(vec3(0.62, 0.36, 0.38)), uDusk);
    vec3 horizon = mix(lin(vec3(1.00, 0.68, 0.46)), lin(vec3(0.95, 0.46, 0.24)), uDusk);
    vec3 c = mix(horizon, band, smoothstep(0.0, 0.10, h));
    c = mix(c, high, smoothstep(0.10, 0.32, h));
    c = mix(c, zenith, smoothstep(0.32, 0.9, h));
    c = mix(c, mix(lin(vec3(0.62, 0.52, 0.46)), lin(vec3(0.16, 0.12, 0.16)), uDusk), smoothstep(0.0, -0.25, h));
    float s = max(dot(d, sunDir), 0.0);
    c += lin(vec3(1.0, 0.45, 0.25)) * pow(s, 6.0) * mix(0.55, 0.4, uDusk);
    c += lin(vec3(1.0, 0.70, 0.45)) * pow(s, 64.0) * mix(0.9, 0.5, uDusk);
    return c;
  }`

function skyMaterial() {
  return new ShaderMaterial({
    side: BackSide,
    depthWrite: false,
    fog: false,
    uniforms: { sunDir: { value: SUN_DIR }, uDusk: dusk },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_Position = p.xyww; // always on the far plane
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 sunDir;
      varying vec3 vDir;
      ${SKY_GLSL}
      void main() {
        vec3 d = normalize(vDir);
        vec3 c = skyColor(d, normalize(sunDir));
        float s = max(dot(d, normalize(sunDir)), 0.0);
        c += vec3(3.2, 2.2, 1.3) * (1.0 - uDusk * 0.6) * smoothstep(0.9990, 0.9994, s); // sun disc, just bright enough to bloom
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
      }`,
  })
}

function SkyDome({ follow = true }: { follow?: boolean }) {
  const mesh = useRef<Mesh>(null)
  const material = useMemo(skyMaterial, [])
  useFrame(({ camera }) => {
    if (follow && mesh.current) mesh.current.position.copy(camera.position)
  })
  return (
    <mesh ref={mesh} material={material} renderOrder={-1} frustumCulled={false}>
      <sphereGeometry args={[400, 48, 24]} />
    </mesh>
  )
}

const SUN_DAY = new Color('#ffc58a')
const SUN_DUSK = new Color('#ff8a52')
const FOG_DAY = new Color(FOG)
const FOG_DUSK = new Color('#4a3442')

// Dusk for the finale: the sky, sun, fill light, reflections and haze all ease toward the blue hour
function DuskDriver() {
  const night = useGame((s) => s.night)
  const hemi = useRef<HemisphereLight>(null)
  useFrame(({ scene }, dt) => {
    const goal = night ? 1 : 0
    if (Math.abs(dusk.value - goal) < 1e-4 && dusk.value === goal) return
    dusk.value += (goal - dusk.value) * Math.min(1, dt * 0.45)
    if (Math.abs(dusk.value - goal) < 1e-3) dusk.value = goal
    const d = dusk.value
    if (hemi.current) hemi.current.intensity = MathUtils.lerp(0.65, 0.22, d)
    scene.environmentIntensity = MathUtils.lerp(1, 0.3, d)
    if (scene.fog) scene.fog.color.copy(FOG_DAY).lerp(FOG_DUSK, d)
    if (scene.background instanceof Color) scene.background.copy(FOG_DAY).lerp(FOG_DUSK, d)
    windowGlow.emissiveIntensity = MathUtils.lerp(0.25, 2.2, d)
  })
  return <hemisphereLight ref={hemi} args={['#bcd7ff', '#3d5a2e', 0.65]} />
}

// Directional sun whose shadow camera follows the car, so a small high-res shadow map covers what you see
function Sun() {
  const light = useRef<DirectionalLight>(null)
  const scene = useThree((s) => s.scene)
  useEffect(() => {
    const target = light.current!.target
    scene.add(target)
    return () => void scene.remove(target)
  }, [scene])
  useFrame(() => {
    const l = light.current
    if (!l) return
    l.intensity = MathUtils.lerp(2.6, 0.55, dusk.value)
    l.color.copy(SUN_DAY).lerp(SUN_DUSK, dusk.value)
    l.position.copy(playerPosition).addScaledVector(SUN_DIR, 90)
    l.target.position.copy(playerPosition)
    l.target.updateMatrixWorld()
  })
  const size = LOW_END ? 1024 : 2048
  return (
    <directionalLight
      ref={light}
      castShadow
      intensity={2.6}
      color="#ffc58a"
      shadow-mapSize={[size, size]}
      shadow-camera-left={-50}
      shadow-camera-right={50}
      shadow-camera-top={50}
      shadow-camera-bottom={-50}
      shadow-camera-near={1}
      shadow-camera-far={220}
      shadow-bias={-0.0004}
      shadow-normalBias={0.05}
    />
  )
}

export function Atmosphere() {
  return (
    <>
      <SkyDome />
      <fog attach="fog" args={[FOG, 90, 420]} />
      {/* Cool sky fill against the warm sun, green bounce from the land */}
      <DuskDriver />
      <Sun />
      {/* Reflections: the same sky plus soft strips so water, paint and glass catch warm and green light */}
      <Environment resolution={256} frames={1} environmentIntensity={1}>
        <SkyDome follow={false} />
        <Lightformer form="rect" intensity={1.2} color="#fff1dc" position={[0, 14, 0]} rotation-x={Math.PI / 2} scale={[30, 10, 1]} />
        <Lightformer form="rect" intensity={1.2} color="#ffb27a" position={[-16, 4, 0]} rotation-y={Math.PI / 2} scale={[24, 1.5, 1]} />
        <Lightformer form="rect" intensity={1} color="#c8f5e0" position={[16, 4, 0]} rotation-y={-Math.PI / 2} scale={[24, 1.5, 1]} />
      </Environment>
    </>
  )
}

export function Effects() {
  return (
    <EffectComposer multisampling={LOW_END ? 0 : 4} enableNormalPass={false}>
      {/* No screen-space AO: on open water it painted a dark ghost of the boat beside it, and it cost frame time */}
      <Bloom mipmapBlur luminanceThreshold={1.05} luminanceSmoothing={0.25} intensity={0.55} />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      <Vignette offset={0.25} darkness={0.5} />
    </EffectComposer>
  )
}
