// After `vite build`: render the portfolio as static HTML into dist/index.html, and add
// link-preview and structured-data tags. Set SITE_URL (e.g. SITE_URL=https://ride.example.com)
// so preview images get the absolute URLs that LinkedIn, Slack and X need.
import { readFile, writeFile } from 'node:fs/promises'
import { createServer } from 'vite'

const SITE_URL = (process.env.SITE_URL || '').replace(/\/$/, '')
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' })
try {
  const { renderStatic, personJsonLd } = await server.ssrLoadModule('/src/seo.tsx')
  const { owner } = await server.ssrLoadModule('/src/content.ts')
  const file = new URL('../dist/index.html', import.meta.url)
  let html = await readFile(file, 'utf8')

  const title = `${owner.name} — a boat ride through my work`
  const description = 'Full-stack engineer at Cooee, based in Kerala. Take a boat ride through the Kerala backwaters to see my experience, skills and projects, or read it as a normal page.'
  const abs = (p) => (SITE_URL ? SITE_URL + p : p)
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
  const head = [
    `<meta property="og:type" content="website" />`,
    `<meta property="og:title" content="${esc(title)}" />`,
    `<meta property="og:description" content="${esc(description)}" />`,
    `<meta property="og:image" content="${abs('/og.jpg')}" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta property="og:image:alt" content="A wooden boat on the Kerala backwaters at sunset, palms reflected in the water" />`,
    SITE_URL ? `<meta property="og:url" content="${SITE_URL}/" />` : '',
    SITE_URL ? `<link rel="canonical" href="${SITE_URL}/" />` : '',
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<script type="application/ld+json">${JSON.stringify(personJsonLd(SITE_URL)).replace(/</g, '\\u003c')}</script>`,
  ].filter(Boolean).join('\n    ')

  html = html
    .replace(/<meta name="description" content="[^"]*" \/>/, `<meta name="description" content="${esc(description)}" />`)
    .replace('</head>', `    ${head}\n  </head>`)
    .replace('<div id="root"></div>', `<div id="root">${renderStatic()}</div>`)
  await writeFile(file, html)
  console.log(`prerendered dist/index.html (${(html.length / 1024).toFixed(1)} KB)${SITE_URL ? '' : ' — set SITE_URL for absolute preview-image links'}`)
} finally {
  await server.close()
}
