// Sound, synthesised with Web Audio (nothing to download): lapping water and the odd bird, an
// outboard motor that follows the boat's speed, a chime when you dock, a thud when you bump, and a
// warm chord when the ride ends. Off until the visitor turns it on; browsers only allow audio to
// start from a click or key press anyway.

let ctx: AudioContext | null = null
let master: GainNode | null = null
let motorGain: GainNode | null = null
let motorOsc: OscillatorNode[] = []
let motorFilter: BiquadFilterNode | null = null
let birdTimer = 0
let on = false

function noiseBuffer(c: AudioContext, seconds: number) {
  const b = c.createBuffer(1, c.sampleRate * seconds, c.sampleRate)
  const d = b.getChannelData(0)
  // Brown-ish noise: softer than white, like water rather than static
  let last = 0
  for (let i = 0; i < d.length; i++) {
    last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02
    d[i] = last * 3.5
  }
  return b
}

function build() {
  const c = new AudioContext()
  ctx = c
  master = c.createGain()
  master.gain.value = 0
  master.connect(c.destination)

  // Water: looped noise through a band-pass, swelling slowly like small waves on the bank
  const water = c.createBufferSource()
  water.buffer = noiseBuffer(c, 4)
  water.loop = true
  const band = c.createBiquadFilter()
  band.type = 'bandpass'
  band.frequency.value = 520
  band.Q.value = 0.6
  const lap = c.createGain()
  lap.gain.value = 0.35
  const lfo = c.createOscillator()
  lfo.frequency.value = 0.18
  const lfoDepth = c.createGain()
  lfoDepth.gain.value = 0.18
  lfo.connect(lfoDepth).connect(lap.gain)
  water.connect(band).connect(lap).connect(master)
  water.start()
  lfo.start()

  // Motor: two detuned low oscillators, muffled, rising with speed
  motorFilter = c.createBiquadFilter()
  motorFilter.type = 'lowpass'
  motorFilter.frequency.value = 280
  motorGain = c.createGain()
  motorGain.gain.value = 0.02
  motorOsc = [
    Object.assign(c.createOscillator(), { type: 'sawtooth' as OscillatorType }),
    Object.assign(c.createOscillator(), { type: 'square' as OscillatorType }),
  ]
  motorOsc.forEach((o, i) => {
    o.frequency.value = 38 * (i + 1)
    o.connect(motorFilter!)
    o.start()
  })
  motorFilter.connect(motorGain).connect(master)
}

function tone(freq: number, start: number, length: number, peak: number, type: OscillatorType = 'sine', glideTo?: number) {
  if (!ctx || !master) return
  const o = ctx.createOscillator()
  o.type = type
  o.frequency.setValueAtTime(freq, start)
  if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, start + length * 0.8)
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.0001, start)
  g.gain.exponentialRampToValueAtTime(peak, start + Math.min(0.02, length / 4))
  g.gain.exponentialRampToValueAtTime(0.0001, start + length)
  o.connect(g).connect(master)
  o.start(start)
  o.stop(start + length + 0.05)
}

export function setSoundOn(v: boolean) {
  on = v
  if (v && !ctx) build()
  if (!ctx || !master) return
  if (v) void ctx.resume()
  master.gain.setTargetAtTime(v ? 0.9 : 0, ctx.currentTime, 0.25)
}

// Called every frame from the boat with its speed in m/s
export function audioFrame(speed: number, dt: number) {
  if (!on || !ctx || !motorGain || !motorFilter) return
  const s = Math.min(1, Math.abs(speed) / 16)
  const t = ctx.currentTime
  motorGain.gain.setTargetAtTime(0.018 + s * 0.07, t, 0.15)
  motorFilter.frequency.setTargetAtTime(240 + s * 520, t, 0.15)
  motorOsc.forEach((o, i) => o.frequency.setTargetAtTime((34 + s * 42) * (i + 1) * (i ? 1.01 : 1), t, 0.15))
  // Now and then a bird somewhere over the water
  birdTimer -= dt
  if (birdTimer <= 0) {
    birdTimer = 7 + Math.random() * 10
    const base = 2200 + Math.random() * 1400
    const n = 2 + Math.floor(Math.random() * 3)
    for (let i = 0; i < n; i++) tone(base, t + i * 0.16, 0.11, 0.035, 'sine', base * 1.35)
  }
}

export function chime() {
  if (!on || !ctx) return
  const t = ctx.currentTime
  tone(659, t, 1.4, 0.08)
  tone(988, t + 0.12, 1.6, 0.06)
}

export function bump(strength: number) {
  if (!on || !ctx || !master) return
  const t = ctx.currentTime
  tone(70, t, 0.35, Math.min(0.25, 0.06 + strength * 0.02), 'sine', 40)
}

// The end of the ride: a slow, warm chord
export function swell() {
  if (!on || !ctx || !master) return
  const t = ctx.currentTime
  for (const [f, d] of [[220, 0], [277.2, 0.4], [329.6, 0.8], [440, 1.4]] as const) {
    const o = ctx.createOscillator()
    o.frequency.value = f
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t + d)
    g.gain.exponentialRampToValueAtTime(0.04, t + d + 2)
    g.gain.exponentialRampToValueAtTime(0.0001, t + d + 7)
    o.connect(g).connect(master)
    o.start(t + d)
    o.stop(t + d + 7.2)
  }
}

// A short buzz on phones that support it (Android; iOS Safari ignores it)
export function buzz(ms: number) {
  try {
    navigator.vibrate?.(ms)
  } catch {
    // not allowed here
  }
}
