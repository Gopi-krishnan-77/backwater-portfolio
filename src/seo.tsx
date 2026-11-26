// The portfolio as plain HTML, rendered into index.html at build time (scripts/prerender.mjs).
// Search engines, link previews and visitors without JavaScript get the whole story; everyone else
// sees the same loading screen as before, and the 3D ride replaces it as soon as it starts.
import { renderToStaticMarkup } from 'react-dom/server'
import { chapters, owner, zones } from './content'
import { ZoneContent } from './ui/Panel'

const pad2 = (n: number) => String(n).padStart(2, '0')

function StaticPage() {
  return (
    <div className="seo">
      <header className="seo-hero">
        <h1>{owner.name}</h1>
        <p className="seo-loading">Loading</p>
        <span className="loader-bar" aria-hidden />
        <a className="link" href="#portfolio">Read as a page instead</a>
      </header>
      <main id="portfolio" className="read-inner">
        <div className="read-head">
          <div>
            <h2 className="seo-name">{owner.name}</h2>
            <p>{owner.role}</p>
          </div>
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
      </main>
    </div>
  )
}

export const renderStatic = () => renderToStaticMarkup(<StaticPage />)

// Structured data so search engines know who this page is about
export function personJsonLd(siteUrl: string) {
  const contact = zones.find((z) => z.id === 'contact')
  const sameAs = (contact?.links ?? []).map((l) => l.href).filter((h) => /^https:\/\/(www\.)?(github|linkedin)\.com/.test(h))
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: owner.name,
    jobTitle: 'Full-stack engineer',
    worksFor: { '@type': 'Organization', name: 'Cooee', url: 'https://callcooee.com' },
    alumniOf: { '@type': 'CollegeOrUniversity', name: 'Saintgits College of Engineering' },
    address: { '@type': 'PostalAddress', addressRegion: 'Kerala', addressCountry: 'IN' },
    email: `mailto:${owner.email}`,
    ...(siteUrl ? { url: siteUrl } : {}),
    sameAs,
  }
}
