// Optional Google Analytics 4. Off unless VITE_GA_ID is set at build time (e.g. VITE_GA_ID=G-XXXXXXX npm run build),
// so nothing is loaded or sent by default. Events: ride_start, stop_reached (which stop), finale, read_as_page.
const GA_ID = import.meta.env.VITE_GA_ID as string | undefined

type Gtag = (...args: unknown[]) => void
let gtag: Gtag | null = null

export function initAnalytics() {
  if (!GA_ID || gtag) return
  const w = window as unknown as { dataLayer: unknown[]; gtag: Gtag }
  w.dataLayer = w.dataLayer || []
  w.gtag = function () {
    // eslint-disable-next-line prefer-rest-params
    w.dataLayer.push(arguments)
  }
  gtag = w.gtag
  gtag('js', new Date())
  gtag('config', GA_ID, { anonymize_ip: true })
  const s = document.createElement('script')
  s.async = true
  s.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`
  document.head.appendChild(s)
}

export function track(event: string, params?: Record<string, string | number>) {
  gtag?.('event', event, params)
}
