import { useEffect, useRef, useState } from 'react'
import { chapterOf, chapters, owner, zones } from '../content'
import { nextInStory, PAINTS, useGame } from '../store'
import { LOW_END } from '../world/Atmosphere'
import { currentRoute } from '../world/route'
import { buzz, chime, swell } from '../audio'
import { track } from '../analytics'
import { blipEls } from './blips'
import { Minimap } from './Minimap'
import { ZoneContent } from './Panel'
import { TouchControls } from './TouchControls'

const pad2 = (n: number) => String(n).padStart(2, '0')

export function Hud() {
  const activeId = useGame((s) => s.activeZone)
  const readMode = useGame((s) => s.readMode)
  const setReadMode = useGame((s) => s.setReadMode)
  const reset = useGame((s) => s.reset)
  const ready = useGame((s) => s.ready)
  const started = useGame((s) => s.started)
  const finale = useGame((s) => s.finale)
  const sound = useGame((s) => s.sound)
  const setSound = useGame((s) => s.setSound)
  const zone = zones.find((z) => z.id === activeId)
  // Docking: a chime and a short buzz. The finale: a slow chord.
  useEffect(() => {
    if (!activeId) return
    chime()
    buzz(18)
    track('stop_reached', { stop: activeId })
  }, [activeId])
  useEffect(() => {
    if (!finale) return
    swell()
    track('finale')
  }, [finale])
  useEffect(() => {
    if (started) track('ride_start')
  }, [started])
  useEffect(() => {
    if (readMode) track('read_as_page')
  }, [readMode])
  // On a first arrival the chapter title shows on its own, then the panel slides in as it fades
  const arrival = useGame((s) => s.arrival)
  const [holding, setHolding] = useState(false)
  useEffect(() => {
    if (!arrival) return
    setHolding(true)
    const id = setTimeout(() => setHolding(false), 1300)
    return () => clearTimeout(id)
  }, [arrival])
  const open = !!zone && !holding
  // Keep showing the last zone while the panel slides out, so it doesn't leave empty
  const lastZone = useRef(zone)
  if (zone) lastZone.current = zone
  const shown = zone ?? lastZone.current
  // The closed panel is off-screen but still in the DOM: keep its links out of tab order
  const panelRef = useRef<HTMLElement>(null)
  useEffect(() => {
    panelRef.current?.toggleAttribute('inert', !open)
  }, [open])
  // A new stop starts at the top of its panel, not wherever you'd scrolled the last one to.
  // On phones it also starts as a small card, so the water ahead stays visible.
  const [expanded, setExpanded] = useState(false)
  useEffect(() => {
    panelRef.current?.scrollTo({ top: 0 })
    setExpanded(false)
  }, [shown?.id])

  return (
    <>
      {!ready && !readMode && (
        <div className="loader" role="status">
          <h1>{owner.name}</h1>
          <p>Loading</p>
          <span className="loader-bar" aria-hidden />
          <button className="link" onClick={() => setReadMode(true)}>Read as a page instead</button>
        </div>
      )}
      {ready && !started && !readMode && <TitleCard />}

      {started && finale && !readMode && <FinaleCard />}
      {started && (
        <>
          {!finale && <Blips />}
          <header className="hud-top">
            <div className="who">
              <h1>{owner.name}</h1>
              <p>{owner.role}</p>
            </div>
            <div className="hud-actions">
              <button className="sound-toggle" aria-pressed={sound} aria-label="Sound" onClick={() => setSound(!sound)} title="Sound (M)">
                <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor" stroke="none" />
                  {sound ? <path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" /> : <path d="M17 9l5 6M22 9l-5 6" />}
                </svg>
                <span className="wide-only">{sound ? 'Sound on' : 'Sound off'}</span>
              </button>
              <button onClick={reset} title="Back to the start (R)">Reset boat</button>
              <button className="primary" onClick={() => setReadMode(true)}>Read as a page</button>
            </div>
          </header>
          {!zone && !finale && <GpsReadout />}
          <ChapterCard />
        </>
      )}

      <aside ref={panelRef} className={`panel ${open ? 'panel--open' : ''} ${expanded ? 'panel--expanded' : ''}`} aria-live="polite">
        {shown && (
          <>
            <ZoneContent zone={shown} />
            <UpNext from={shown} />
            {/* Only shown on touch screens, where the panel opens as a small card */}
            <div className="panel-actions">
              <button className="panel-more" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>
                {expanded ? 'Show less' : 'Read more'}
              </button>
              {!expanded && <NextStopButton from={shown} />}
            </div>
          </>
        )}
      </aside>

      {started && !finale && (
        <>
          <NavCard />
          <TouchControls />
        </>
      )}
      {readMode && <ReadMode onClose={() => setReadMode(false)} />}
    </>
  )
}

// Closing card over the dusk aerial shot: thanks, and the ways to get in touch
function FinaleCard() {
  const setFinale = useGame((s) => s.setFinale)
  const setReadMode = useGame((s) => s.setReadMode)
  const links = zones.find((z) => z.id === 'contact')?.links ?? []
  const [primary, ...rest] = links
  return (
    <div className="title-card finale-card" role="dialog" aria-label="End of the ride">
      <div className="title-inner">
        <p className="label">The end of the ride</p>
        <h1>Thanks for sailing through.</h1>
        <p className="title-pitch">
          Every light on the water is a chapter you’ve seen. If you’d like to build something together, I’d love to hear from you.
        </p>
        <div className="finale-links">
          {primary && <a className="button primary" href={primary.href}>{primary.label}</a>}
          {rest.map((l) => (
            <a key={l.href} className="button" href={l.href} target="_blank" rel="noreferrer">{l.label}</a>
          ))}
        </div>
        <div className="title-actions">
          <button autoFocus onClick={() => setFinale(false)}>Keep sailing</button>
          <button className="link" onClick={() => setReadMode(true)}>Read it as a page</button>
        </div>
      </div>
    </div>
  )
}

// Opening card over the aerial shot: who this is, the chapters, and Start
function TitleCard() {
  const start = useGame((s) => s.start)
  const setReadMode = useGame((s) => s.setReadMode)
  return (
    <div className="title-card" role="dialog" aria-label="Start the ride">
      <div className="title-inner">
        <p className="label">Portfolio · Kerala</p>
        <h1>{owner.name}</h1>
        <p className="title-role">{owner.role}</p>
        <p className="title-pitch">{owner.pitch}</p>
        <ol className="itinerary">
          {chapters.map((c, i) => (
            <li key={c.id}>
              <span className="itin-n">{pad2(i + 1)}</span>
              <b>{c.title}</b>
              <i>{zones.filter((z) => z.chapter === c.id).map((z) => z.sign).join(', ')}</i>
            </li>
          ))}
        </ol>
        <div className="title-actions">
          <button className="primary title-start" autoFocus onClick={start}>Start the ride</button>
          <button onClick={() => setReadMode(true)}>Read as a page</button>
        </div>
        <p className="title-hint">
          {LOW_END ? 'Steer with the round pad, or tap Take me there to let the boat sail itself.' : 'Enter to start. W A S D or arrow keys to steer, space to slow down, T for autopilot, M for sound.'}
        </p>
      </div>
    </div>
  )
}

// Chapter title when you reach a stop for the first time
function ChapterCard() {
  const arrival = useGame((s) => s.arrival)
  const visited = useGame((s) => s.visited)
  const [shown, setShown] = useState<typeof arrival>(null)
  useEffect(() => {
    if (!arrival) return
    setShown(arrival)
    const id = setTimeout(() => setShown(null), 2000)
    return () => clearTimeout(id)
  }, [arrival])
  const z = zones.find((x) => x.id === shown?.id)
  if (!shown || !z) return null
  const ch = chapterOf(z)
  const finished = visited.length === zones.length
  return (
    <div className="chapter-card" key={shown.at} aria-hidden>
      <span className="label">{finished ? 'Last stop' : `Chapter ${ch.n}`}</span>
      <b>{ch.title}</b>
      <i>{z.title}</i>
    </div>
  )
}

// Phones: sail on to the next stop straight from the small docked card
function NextStopButton({ from }: { from: (typeof zones)[number] }) {
  const visited = useGame((s) => s.visited)
  const target = useGame((s) => s.target)
  const setTarget = useGame((s) => s.setTarget)
  const setAutopilot = useGame((s) => s.setAutopilot)
  const setFinale = useGame((s) => s.setFinale)
  const nextId = target && target !== from.id ? target : nextInStory(from.id, visited)
  if (!nextId) return <button className="primary panel-go" onClick={() => setFinale(true)}>Finish the ride</button>
  return (
    <button className="primary panel-go" onClick={() => { if (nextId !== target) setTarget(nextId); setAutopilot(true) }}>
      Next stop
    </button>
  )
}

// Panel footer: where the story goes next
function UpNext({ from }: { from: (typeof zones)[number] }) {
  const visited = useGame((s) => s.visited)
  const target = useGame((s) => s.target)
  const setAutopilot = useGame((s) => s.setAutopilot)
  const setTarget = useGame((s) => s.setTarget)
  const nextId = target && target !== from.id ? target : nextInStory(from.id, visited)
  const setFinale = useGame((s) => s.setFinale)
  const next = zones.find((z) => z.id === nextId)
  if (!next)
    return (
      <p className="up-next">
        <span className="label">That’s every stop</span>
        <b>Thanks for coming along.</b>
        <i>Sail on whenever you like, or end the ride here.</i>
        <button className="primary up-next-go" onClick={() => setFinale(true)}>Finish the ride</button>
      </p>
    )
  const ch = chapterOf(next)
  return (
    <p className="up-next">
      <span className="label">Next</span>
      <b>
        {ch.n} {ch.title} · {next.title}
      </b>
      <i>Follow the orange line, or let the boat take you.</i>
      <button
        className="primary up-next-go"
        onClick={() => { if (next.id !== target) setTarget(next.id); setAutopilot(true) }}
      >
        Take me there
      </button>
    </p>
  )
}

// One marker per stop; Guidance's tracker positions them every frame
function Blips() {
  const target = useGame((s) => s.target)
  const visited = useGame((s) => s.visited)
  const active = useGame((s) => s.activeZone)
  return (
    // Hidden while a panel is open so markers never sit on top of the text you are reading
    <div className={`blips ${active ? 'blips--hidden' : ''}`} aria-hidden>
      {zones.map((z, i) => (
        <div
          key={z.id}
          ref={(el) => { if (el) blipEls.set(z.id, el); else blipEls.delete(z.id) }}
          className={['blip', target === z.id && 'blip--target', visited.includes(z.id) && 'blip--visited'].filter(Boolean).join(' ')}
        >
          <span className="blip-arrow" />
          <span className="blip-pin">{visited.includes(z.id) ? '✓' : i + 1}</span>
          <span className="blip-text">
            <b>{z.sign}</b>
            <i className="blip-dist" />
          </span>
        </div>
      ))}
    </div>
  )
}

// Where the GPS is taking you next in the story, and how far it is along the channel
function GpsReadout() {
  const target = useGame((s) => s.target)
  const visited = useGame((s) => s.visited)
  const autopilot = useGame((s) => s.autopilot)
  const setAutopilot = useGame((s) => s.setAutopilot)
  const [dist, setDist] = useState<number | null>(null)
  useEffect(() => {
    const id = setInterval(() => setDist(currentRoute.route ? Math.round(currentRoute.route.length) : null), 250)
    return () => clearInterval(id)
  }, [])
  const goal = zones.find((z) => z.id === target)
  if (!goal) {
    return <p className="gps">{visited.length === zones.length ? 'Every stop visited. Thanks for coming along.' : 'Pick a stop on the map to set a course.'}</p>
  }
  const ch = chapterOf(goal)
  return (
    <div className="gps">
      <span className="label">{autopilot ? 'Autopilot' : `Next · ${ch.n} ${ch.title}`}</span>
      <b>{goal.sign}</b>
      {dist !== null && <span className="gps-dist">{dist} m</span>}
      <button className={`autopilot ${autopilot ? 'autopilot--on' : ''}`} onClick={() => setAutopilot(!autopilot)} title="Autopilot (T)">
        {autopilot ? 'Stop' : (<><span className="wide-only">Take me there</span><span className="narrow-only">Go</span></>)}
      </button>
    </div>
  )
}

// Map card: progress and minimap; the stop list and paint colours fold out underneath
function NavCard() {
  const visited = useGame((s) => s.visited)
  const target = useGame((s) => s.target)
  const setTarget = useGame((s) => s.setTarget)
  const paint = useGame((s) => s.paint)
  const setPaint = useGame((s) => s.setPaint)
  const [open, setOpen] = useState(false)
  const current = zones.find((z) => z.id === target)
  return (
    <section className={`nav ${open ? 'nav--open' : ''}`} aria-label="Map and stops">
      <div className="nav-head">
        <span className="label">{current ? `Ch ${chapterOf(current).n}/${pad2(chapters.length)}` : 'Done'}</span>
        <span className="progress-bar" aria-label={`${visited.length} of ${zones.length} stops visited`}>
          {zones.map((z) => (
            <i key={z.id} className={visited.includes(z.id) ? 'on' : undefined} />
          ))}
        </span>
        <button className="nav-toggle" aria-expanded={open} onClick={() => setOpen(!open)}>
          {open ? 'Close' : 'Stops'}
        </button>
      </div>
      <Minimap />
      {open && (
        <div className="nav-more">
          {chapters.map((c, ci) => (
            <div key={c.id} className="stops-group">
              <p className="label">{pad2(ci + 1)} {c.title}</p>
              {zones.map((z, i) =>
                z.chapter !== c.id ? null : (
                  <button
                    key={z.id}
                    className={`stop ${target === z.id ? 'stop--target' : ''} ${visited.includes(z.id) ? 'stop--visited' : ''}`}
                    onClick={() => { setTarget(z.id); setOpen(false) }}
                    aria-pressed={target === z.id}
                  >
                    <span className="stop-num">{visited.includes(z.id) ? '✓' : i + 1}</span>
                    {z.title}
                  </button>
                ),
              )}
            </div>
          ))}
          <p className="label">Boat colour</p>
          <div className="paints" role="radiogroup" aria-label="Boat colour">
            {PAINTS.map((p) => (
              <button
                key={p.color}
                role="radio"
                aria-checked={paint === p.color}
                aria-label={p.name}
                title={p.name}
                className={`swatch ${paint === p.color ? 'swatch--on' : ''}`}
                style={{ background: p.color }}
                onClick={() => setPaint(p.color)}
              />
            ))}
          </div>
          <p className="nav-keys">W A S D steer · Space slow · T autopilot · M sound · R reset</p>
        </div>
      )}
    </section>
  )
}

// The whole story as a plain page, chapter by chapter
function ReadMode({ onClose }: { onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="read" role="dialog" aria-modal="true" aria-label="Portfolio as a page">
      <div className="read-inner">
        <div className="read-head">
          <div>
            <h1>{owner.name}</h1>
            <p>{owner.role}</p>
          </div>
          <button ref={closeRef} onClick={onClose}>Back to the boat</button>
        </div>
        {chapters.map((c, i) => (
          <section key={c.id} className="read-chapter">
            <h2 className="read-chapter-title">
              <span>{pad2(i + 1)}</span> {c.title}
            </h2>
            {zones
              .filter((z) => z.chapter === c.id)
              .map((z) => (
                <article key={z.id} className="read-section">
                  <ZoneContent zone={z} headingLevel={3} eyebrow={false} />
                </article>
              ))}
          </section>
        ))}
      </div>
    </div>
  )
}
