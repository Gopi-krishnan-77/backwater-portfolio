import { chapterOf, type Zone } from '../content'

// One stop's content: chapter eyebrow, title, the story line, then the details
export function ZoneContent({ zone, headingLevel = 2, eyebrow = true }: { zone: Zone; headingLevel?: 2 | 3; eyebrow?: boolean }) {
  const H = headingLevel === 2 ? 'h2' : 'h3'
  const S = headingLevel === 2 ? 'h3' : 'h4'
  const ch = chapterOf(zone)
  return (
    <div className="zone">
      {eyebrow && (
        <p className="label zone-eyebrow">
          Chapter {ch.n} · {ch.title}
        </p>
      )}
      <H className="zone-title">{zone.title}</H>
      <p className="zone-story">{zone.story}</p>
      {zone.meta && <p className="zone-meta">{zone.meta}</p>}
      {zone.shot && (
        <figure className="zone-shot">
          <img src={zone.shot.src} alt={zone.shot.alt} loading="lazy" width={1024} height={640} />
        </figure>
      )}
      {zone.tags && (
        <ul className="zone-tags" aria-label="Tech stack">
          {zone.tags.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      )}
      {zone.body.map((p, i) => (
        <p key={i}>{p}</p>
      ))}
      {zone.bullets && (
        <ul>
          {zone.bullets.map((b, i) => (
            <li key={i}>{b}</li>
          ))}
        </ul>
      )}
      {zone.sections?.map((sec) => (
        <div key={sec.title} className="zone-section">
          <S className="label zone-section-title">{sec.title}</S>
          <ul className={sec.chips ? 'zone-tags' : undefined}>
            {sec.items.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </div>
      ))}
      {zone.links && (
        <div className="zone-links">
          {zone.links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className={l.secondary ? 'secondary' : undefined}
              target={l.href.startsWith('mailto') ? undefined : '_blank'}
              rel="noreferrer"
            >
              {l.label}
            </a>
          ))}
        </div>
      )}
    </div>
  )
}
