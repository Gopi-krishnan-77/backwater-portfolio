# Backwater portfolio

A boat ride through my work, Kerala style. Vite + React + React Three Fiber, with a small hand-written
collision module instead of a physics engine (about 340 KB to download in all).

Five chapters, eight stops, in story order round a channel that circles a big central island:
01 Profile (a traditional house) → 02 Experience (Benfi's office, then the Cooee tower) →
03 Skills (a boatyard) → 04 Projects (a telecom mast for CallCheck, a football ground for Draft Arena,
mangroves and solar for DeCarb) → 05 Contact (the lighthouse at sunset).

Steer into a glowing marker at the end of each jetty and that stop's story opens. The orange line,
the minimap and the on-screen markers show the way; click a stop on the map card to route there.
"Read as a page" shows everything as a plain page.

The colours and fonts follow the main site (dark green, #00E87A, #FF5C1A, cream; Nunito Sans,
Plus Jakarta Sans, JetBrains Mono). The earlier city version lives on, untouched, in ../drive-portfolio.

## Run
npm install
npm run dev -- --port 5174

## Where things live
- src/content.ts           all copy, plus each stop's island, building kind and jetty marker. Edit this first.
- src/world/layout.ts      the lagoon: channel radius, shore, central island, islets.
- src/world/Boat.tsx       the vallam, its drift handling, autopilot, wake and chase camera. Tuning constants at the top.
- src/world/collision.ts   what the boat bumps into (islands, jetties, posts, moored boats, the shore) and which marker it's on.
- src/world/ZoneBuilding.tsx  Kerala buildings, jetties, signboards and markers for each stop.
- src/world/World.tsx      islands, shore, hills, fishing nets, houseboats and canoes.
- src/world/Water.tsx      the water shader: live mirror reflection (desktop), shallows, shoreline foam, sun glitter.
- src/world/Birds.tsx      egrets circling over the lagoon.
- src/audio.ts             synthesised sound (water, birds, motor, dock chime, bumps, finale chord) and phone vibration.
- src/analytics.ts         optional GA4 events; off unless VITE_GA_ID is set.
- src/seo.tsx + scripts/prerender.mjs  the portfolio as plain HTML in index.html, plus link-preview tags and structured data.
- public/                  favicon, link-preview image (og.jpg) and the project screenshots (shots/).
- src/world/Nature.tsx     coconut palms (swaying in the wind), bushes, grass, water hyacinth and shore houses.
- src/world/Atmosphere.tsx golden-hour sky, sun, reflections and postprocessing.
- src/world/route.ts + Guidance.tsx  GPS routing along the channel, the route line and stop markers.
- src/ui/                  HUD, title card, minimap, panels, "Read as a page", touch pad.

## Controls
W A S D or arrows to steer, space to slow, T for autopilot, R to reset. A round pad on touch devices,
and "Take me there" / "Next stop" buttons to let the boat sail itself.

## Deploy
npm run build, then ship dist/ to Vercel, Netlify or Cloudflare Pages.

## Building for release

    SITE_URL=https://your-domain npm run build

SITE_URL makes the link-preview image and canonical link absolute (LinkedIn, Slack and X need that).
Add VITE_GA_ID=G-XXXXXXX to turn on Google Analytics events: ride_start, stop_reached, finale, read_as_page.
The output in dist/ is static files and can go on any static host (Vercel, Netlify, GitHub Pages).
