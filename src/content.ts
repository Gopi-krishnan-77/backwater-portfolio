// All portfolio copy lives here. Edit this file, not the 3D code.
// The stops are listed in story order: the GPS leads you through them one after another,
// round the channel that circles the central island.

export type Link = { label: string; href: string; secondary?: boolean }
export type Section = { title: string; items: string[]; chips?: boolean }

export const chapters = [
  { id: 'profile', title: 'Profile', line: 'About me' },
  { id: 'experience', title: 'Experience', line: 'Where I’ve worked' },
  { id: 'skills', title: 'Skills', line: 'What I work with' },
  { id: 'projects', title: 'Projects', line: 'What I’ve built on my own' },
  { id: 'contact', title: 'Contact', line: 'How to reach me' },
] as const
export type ChapterId = (typeof chapters)[number]['id']

export type Zone = {
  id: string
  chapter: ChapterId
  title: string
  sign: string // short name on the stop's marker and its signboard
  story: string // one line that carries the narrative, shown first in the panel
  meta?: string
  tags?: string[] // tech stack chips
  body: string[]
  bullets?: string[]
  sections?: Section[]
  links?: Link[]
  shot?: { src: string; alt: string } // a screenshot of the live product, in the panel and on a billboard by the jetty
  color: string // accent on the signboard
  position: [number, number] // building centre (and island centre), x/z on the map
  island: number // island radius
  size: [number, number, number] // building width, height, depth
  kind: 'house' | 'office' | 'tower' | 'boatyard' | 'mast' | 'ground' | 'eco' | 'lighthouse'
  pad: [number, number] // jetty marker on the channel; the building turns to face it
}

export const owner = {
  name: 'Gopikrishnan B',
  role: 'Full-stack engineer at Cooee',
  email: 'gopikrishnanb2003@gmail.com',
  pitch: 'My work in five chapters, on a boat ride through the Kerala backwaters.',
}

const GITHUB = 'https://github.com/Gopi-krishnan-77'

export const zones: Zone[] = [
  {
    id: 'about',
    chapter: 'profile',
    title: 'About me',
    sign: 'About',
    story: 'Full-stack engineer based in Kerala, with a computer science degree from Saintgits College of Engineering.',
    meta: 'Kerala, India',
    body: [
      'I work mostly in Go on the backend and React on the front, and I like owning a feature from the first API question to the deploy.',
    ],
    sections: [
      {
        title: 'Education',
        items: [
          'B.Tech in Computer Science and Engineering, Saintgits College of Engineering, 2021 to 2025. CGPA 8.42, minor in Robotics and Automation.',
          'AISSCE, Science with Computer Science, Kendriya Vidyalaya Pattom, 2021. 96%.',
        ],
      },
      {
        title: 'Recognition',
        items: [
          'Research publication: “Security in Metaverse”, Springer CCIS, ICAISM 2025.',
          'Finalist, SIGHT 2.0, UST 2024.',
          'Runner-up, Web3 for India 2030 Ideathon, Kerala Blockchain Academy (BlockHash LIVE) 2023.',
          'Project showcase at ETHIndia 2023; Intel Unnati industrial trainee 2023.',
          'Special Recognition Award, Saintgits CSE department, 2025.',
        ],
      },
      {
        title: 'Off the keyboard',
        items: ['Treasurer of EXCEL Saintgits, the student technical association, and captain of the college cricket team, 2024 to 2025.'],
      },
    ],
    color: '#00E87A',
    position: [-45.6, 97.9],
    island: 14,
    size: [10, 6, 8],
    kind: 'house',
    pad: [-35.9, 77.0],
  },
  {
    id: 'benfi',
    chapter: 'experience',
    title: 'Benfi Consultants',
    sign: 'Benfi',
    story: 'My first role: a five-month internship building Django APIs and testing LLMs for reporting.',
    meta: 'Software Developer Intern · Jul to Nov 2024',
    tags: ['Python', 'Django', 'LLMs'],
    body: [],
    bullets: [
      'Developed and optimised Django APIs behind internal business intelligence workflows.',
      'Evaluated the Qwen series of LLMs for automating analytics generation and reporting.',
      'Contributed to early prototypes of an AI-driven home assistant and analytics tooling.',
    ],
    color: '#00E87A',
    position: [-56.2, 26.2],
    island: 11,
    size: [8, 7, 8],
    kind: 'office',
    pad: [-77.0, 35.9],
  },
  {
    id: 'cooee',
    chapter: 'experience',
    title: 'Cooee',
    sign: 'Cooee HQ',
    story: 'Where I work now. Cooee gives people real phone numbers inside an app; I work across calling, payments and support.',
    meta: 'Graduate Software Engineer, Full Stack · Dec 2025 to now (intern from Sept 2025, converted to full-time)',
    tags: ['Go', 'PostgreSQL', 'GraphQL', 'RabbitMQ', 'TypeScript', 'React', 'Next.js', 'WebRTC'],
    body: [],
    bullets: [
      'Own Cooee Business end to end, from the first prototype to launch: Go and PostgreSQL APIs plus the React web app for onboarding, team management, usage dashboards and payments.',
      'Led the move to a new customer support platform across backend and web. Go services on the platform’s GraphQL API bridge our in-app chat into the agent dashboard and pull customer context and app logs into threads on demand, with ticket migration and a one-switch rollback. Issue resolution went from days to hours.',
      'Built the web frontend for calling and billing: international calling over WebRTC and socket signalling, call forwarding, simultaneous ring, time-based routing, plan upgrades and downgrades, auto top-ups and churn flows.',
      'Moved signup-abandonment emails off a third-party tool to an in-house Go and RabbitMQ pipeline, with UTM tracking through GA4.',
      'Worked on the web app redesign and moved the marketing site from WordPress to Next.js with a headless CMS, country-specific pages, SEO improvements and GA4.',
      'Interviewed graduate candidates (frontend, backend and live DSA), onboarded and mentored an intern, and organised an online hackathon.',
    ],
    links: [{ label: 'callcooee.com', href: 'https://callcooee.com' }],
    shot: { src: '/shots/cooee.jpg', alt: 'The Cooee website: calls, texts and data through a virtual number on the Cooee eSIM app' },
    color: '#00E87A',
    position: [-104.3, -27.9],
    island: 15,
    size: [11, 22, 10],
    kind: 'tower',
    pad: [-82.1, -22.0],
  },
  {
    id: 'skills',
    chapter: 'skills',
    title: 'Skills and earlier work',
    sign: 'Skills',
    story: 'The languages, frameworks and platforms I use most, and projects from before Cooee.',
    body: [],
    sections: [
      { title: 'Languages', chips: true, items: ['Go', 'TypeScript', 'JavaScript', 'Python', 'Solidity'] },
      { title: 'Frontend', chips: true, items: ['React', 'Next.js', 'TanStack Query', 'Redux', 'Tailwind CSS'] },
      { title: 'Backend and APIs', chips: true, items: ['Go REST APIs', 'GraphQL', 'RabbitMQ', 'Express.js', 'Django'] },
      { title: 'Real-time', chips: true, items: ['WebRTC', 'WebSockets', 'Socket signalling'] },
      { title: 'Data', chips: true, items: ['PostgreSQL', 'Redis', 'Firebase', 'Supabase', 'BigQuery'] },
      { title: 'Platforms', chips: true, items: ['Cloudflare Workers', 'AWS Amplify', 'Auth0', 'Stripe', 'Sanity CMS', 'Playwright', 'GA4'] },
      {
        title: 'Earlier builds',
        items: [
          'TEDx Saintgits: the official event site with ticketing (Next.js, Firebase).',
          'AlertEye: real-time driver drowsiness detection from facial landmarks (Python, OpenCV).',
          'EduFinEase: fee tracking, payments and reports for schools and colleges (React, Node.js, Firebase).',
          'DeEx3 DAO: researchers publish and peer-review work on-chain (Solidity, React, IPFS).',
        ],
      },
    ],
    links: [
      { label: 'AlertEye', href: `${GITHUB}/Alert-Eye`, secondary: true },
      { label: 'TEDx Saintgits', href: 'https://github.com/basilrari/tedxsaintgits', secondary: true },
      { label: 'EduFinEase', href: 'https://github.com/EduFinEase', secondary: true },
      { label: 'DeEx3 DAO', href: 'https://github.com/orgs/DeEx3-DAO/repositories', secondary: true },
    ],
    color: '#00E87A',
    position: [-35.6, -50.8],
    island: 11,
    size: [10, 5, 8],
    kind: 'boatyard',
    pad: [-48.8, -69.6],
  },
  {
    id: 'callcheck',
    chapter: 'projects',
    title: 'CallCheck',
    sign: 'CallCheck',
    story: 'A free tool that tells you whether your network can handle a VoIP call.',
    meta: 'VoIP network tester · May 2026',
    tags: ['Next.js', 'TypeScript', 'Go'],
    body: ['A free in-browser tool that measures latency, jitter, packet loss and a MOS score, built from what I learned shipping WebRTC calling at Cooee.'],
    links: [
      { label: 'Try CallCheck', href: 'https://callcheck.gopikrishnanb.co.in' },
      { label: 'GitHub', href: `${GITHUB}/callcheck`, secondary: true },
    ],
    shot: { src: '/shots/callcheck.jpg', alt: 'CallCheck: a call-readiness test with a choice of Wi-Fi, Ethernet or mobile and a Start test button' },
    color: '#00E87A',
    position: [5.4, -61.8],
    island: 10,
    size: [6, 24, 6],
    kind: 'mast',
    pad: [7.4, -84.7],
  },
  {
    id: 'draft',
    chapter: 'projects',
    title: 'Draft Arena',
    sign: 'Draft Arena',
    story: 'A football drafting game for two players, with an AI that judges the result.',
    meta: 'Football drafting game · 2026',
    tags: ['Next.js', 'TypeScript', 'Supabase', 'Postgres', 'OpenRouter'],
    body: ['Two managers snake-draft an all-time XI, on one phone or live online.'],
    bullets: [
      'Live online rooms with a 60-second pick clock.',
      'Draft rules enforced in Postgres, so nobody can cheat the clock or the pick order.',
      'An AI judges both squads and calls a winner in one of four personalities.',
    ],
    links: [
      { label: 'Play Draft Arena', href: 'https://draft.gopikrishnanb.co.in' },
      { label: 'GitHub', href: `${GITHUB}/Draft-arena`, secondary: true },
    ],
    shot: { src: '/shots/draft.jpg', alt: 'Draft Arena home page: Pick your XI, settle the debate, with Create draft and Quick play buttons' },
    color: '#00E87A',
    position: [76.4, -76.4],
    island: 17,
    size: [22, 3, 14],
    kind: 'ground',
    pad: [60.1, -60.1],
  },
  {
    id: 'decarb',
    chapter: 'projects',
    title: 'DeCarb',
    sign: 'DeCarb',
    story: 'A carbon credit marketplace built so people without crypto wallets can take part.',
    meta: 'Carbon credit marketplace · 2025',
    tags: ['Next.js', 'Tailwind', 'Express.js', 'Solidity', 'Web3Auth', 'Razorpay'],
    body: ['A decentralised marketplace for transparent carbon credit trading, where anyone can buy, sell and retire credits.'],
    bullets: [
      'Web3Auth wallet onboarding and Razorpay fiat payments.',
      'Toucan-based retirement certificates.',
      'Finalist at SIGHT 2.0 (UST) and runner-up at BlockHash LIVE.',
    ],
    links: [{ label: 'GitHub', href: 'https://github.com/DeCarb-Marketplace', secondary: true }],
    color: '#00E87A',
    position: [61.8, -5.4],
    island: 11,
    size: [9, 4, 8],
    kind: 'eco',
    pad: [84.7, -7.4],
  },
  {
    id: 'contact',
    chapter: 'contact',
    title: 'Say hello',
    sign: 'Contact',
    story: 'Thanks for making it to the end. Here’s how to reach me.',
    body: ['I’m open to interesting problems in real-time systems, payments and product engineering. If something here caught your eye, I’d love to hear from you.'],
    links: [
      { label: 'Email me', href: 'mailto:gopikrishnanb2003@gmail.com' },
      { label: 'LinkedIn', href: 'https://linkedin.com/in/gopikrishnanbalagopal' },
      { label: 'Resume (PDF)', href: 'https://gopikrishnanb.co.in/resume.pdf' },
      { label: 'GitHub', href: GITHUB },
      { label: 'Main site', href: 'https://www.gopikrishnanb.co.in', secondary: true },
    ],
    color: '#00E87A',
    position: [88.5, 61.9],
    island: 13,
    size: [5, 18, 5],
    kind: 'lighthouse',
    pad: [69.6, 48.8],
  },
]

export const chapterOf = (z: Zone) => {
  const i = chapters.findIndex((c) => c.id === z.chapter)
  return { ...chapters[i], n: String(i + 1).padStart(2, '0') }
}
