import { Suspense, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { PerformanceMonitor } from '@react-three/drei'
import { World } from './world/World'
import { Boat } from './world/Boat'
import { Guidance } from './world/Guidance'
import { Atmosphere, Effects, FOG, LOW_END } from './world/Atmosphere'
import { mirrorQuality } from './world/Water'
import { Hud } from './ui/Hud'
import { useKeyboard } from './useKeyboard'
import { useGame } from './store'

// Stable object: a new one on re-render would make r3f re-apply it and snap the camera back
const CAMERA = { position: [0, 5, 32] as [number, number, number], fov: 55, near: 0.3, far: 900 }

export default function App() {
  useKeyboard()
  // The scene is hidden behind the read-mode page, so stop rendering it
  const readMode = useGame((s) => s.readMode)
  const started = useGame((s) => s.started)
  // 1.25x keeps edges crisp (with multisampling) and leaves headroom for steady frame pacing on
  // large Retina and 120 Hz screens; full 2x falls off a performance cliff with the postprocessing
  const maxDpr = 1.25
  const [dpr, setDpr] = useState(maxDpr)
  return (
    <>
      <Canvas
        shadows="soft"
        dpr={dpr}
        gl={{ antialias: false, powerPreference: 'high-performance', stencil: false }}
        camera={CAMERA}
        frameloop={readMode ? 'never' : 'always'}
      >
        {/* Only watch frame rate once the ride is under way (loading always stutters), and only ever step down once:
            switching resolution back and forth reallocates every buffer and causes its own hitches */}
        {started && <PerformanceMonitor ms={500} iterations={8} onDecline={() => {
          mirrorQuality.enabled = false // the water's live reflection is the most expensive extra
          setDpr(1)
        }} />}
        <color attach="background" args={[FOG]} />
        <Atmosphere />
        <Suspense fallback={null}>
          <World />
          <Boat />
          <Guidance />
        </Suspense>
        <Effects />
      </Canvas>
      <Hud />
    </>
  )
}
