// All the words on the site live here.
// The facts (name, projects, experience, links) come from the Lyle-Portfolio- project.

export const site = {
  name: 'Lyle Chadya',
  initials: 'LC',
  photo: '', // e.g. '/media/profile.jpg' — leave empty to show initials
  email: 'lylechadya139@gmail.com',
  music: '/audio/track.mp3', // put the file in public/audio. Empty = built-in synth drone
  year: 2026,
  status: { text: 'Co-founder of', link: 'DL Origin', href: 'https://www.dlorigin.com/' },
  also: { text: 'Part of', link: 'Uncommon.org', href: 'https://uncommon.org/' },
  links: [
    { label: 'GitHub', href: 'https://github.com/lyle-bongani' },
    { label: 'LinkedIn', href: 'https://www.linkedin.com/in/lyle-chadya-368930358/' },
    { label: 'Instagram', href: 'https://www.instagram.com/itsjust_lyle/' },
    { label: 'WhatsApp', href: 'https://wa.me/263775312695' },
  ],
  skills: ['React', 'Three.js', 'TypeScript', 'Motion', 'UI design'],
};

export const intro = {
  kicker: 'A portfolio that crosses the solar system · 2026',
  title: 'Lyle Chadya — web developer building sites that move.',
};

// Each chapter is a planet on the route. `from`/`to` say where on the scroll (0 to 1) its words
// are on screen; `starts` is where the chapter counter and the index switch over to it.
// The planets themselves, and where the hero is at each scroll position, are set in world.js.
export const chapters = [
  {
    label: 'Earth',
    starts: 0.11,
    from: 0.125,
    to: 0.21,
    title: 'One desk',
    line: 'Web developer and creative coder. React, Three.js and motion, from first sketch to deployed site.',
  },
  {
    label: 'The Moon',
    starts: 0.25,
    from: 0.268,
    to: 0.355,
    title: 'Static pages are buried here',
    line: 'Flat layouts and sites that just sit there. I left that way of building on the Moon.',
  },
  {
    label: 'Mars',
    starts: 0.4,
    from: 0.415,
    to: 0.455,
    title: 'A different frame',
    line: 'Design and code through one frame: pixel-perfect interfaces that also perform.',
    tags: [0.46, 0.515],
  },
  {
    label: 'Saturn',
    starts: 0.55,
    from: 0.555,
    to: 0.595,
    title: 'The work',
    line: 'Live projects in orbit around Saturn. Keep scrolling to fly past each one.',
    work: [0.6, 0.765],
  },
  {
    label: 'Pluto',
    starts: 0.795,
    from: 0.81,
    to: 0.885,
    title: 'Shipped',
    line: 'Sites taken from first idea to live launch: designed, built and shipped.',
    stats: [
      { value: '2 yrs', label: 'Building websites and web apps' },
      { value: 'Co-founder', label: 'DL Origin: websites, hosting and domains from Harare' },
    ],
  },
  {
    label: 'Beyond',
    starts: 0.9,
    from: 0.905,
    to: 0.965,
    title: 'What’s next',
    line: 'One jump past the edge, and the whole Milky Way fits in a single look. Bring the idea and I will carry it this far.',
    stats: [
      { value: '3D', label: 'Scroll-driven worlds built in code and Blender' },
      { value: 'Live', label: 'Every project on Saturn is online right now' },
    ],
  },
];

export const footer = {
  from: 0.975,
  kicker: 'Open for new work · 2026',
  title: 'Let’s build',
  titleSoft: 'what’s next.',
};

// PROJECTS. Each one becomes a screen orbiting Saturn. To add a project, add one entry here and put its
// screenshot in public/media/projects/. The screens space themselves out automatically.
// Take a screenshot with:  npm run shot -- <url> <file-name> [Enter | "text of an intro button"]
// `image` is the screenshot; without one the screen shows a placeholder in the project colour.
export const projects = [
  {
    name: 'DL Origin',
    tag: 'Web agency · Co-founded',
    color: '#ff7a00',
    blurb: 'Websites, hosting, domains and business email from Harare, with one team and one bill. Websites from $300, hosting from $3 a month.',
    role: 'Co-founder: design, build and run the business',
    stack: 'Next.js, React, TypeScript, Tailwind CSS, GSAP, Lenis',
    href: 'https://www.dlorigin.com/',
    image: '/media/projects/dl-origin.jpg',
  },
  {
    name: 'Southern Hunters',
    tag: 'Manufacturing · 3D site',
    color: '#e0237f',
    blurb: 'A marketing site for a Zimbabwe manufacturer of collapsible aluminium tubes and rigid containers, led by an interactive 3D tube.',
    role: 'Front-end build with an interactive 3D product hero and smooth scroll',
    stack: 'Next.js, React, Three.js, React Three Fiber, GSAP, Lenis',
    href: 'https://southernhunterssite.vercel.app/',
    image: '/media/projects/southern-hunters.jpg',
  },
  {
    name: 'Tay Dylan Magwaro',
    tag: 'UI/UX designer portfolio',
    color: '#c98a5a',
    blurb: 'A portfolio for a UI/UX designer, built around African pattern artwork with a bold black and copper look.',
    role: 'Design and development',
    stack: 'HTML, CSS, JavaScript',
    href: 'https://taydylan-portfolio.vercel.app/',
    image: '/media/projects/tay-dylan.jpg',
  },
  {
    name: 'Lyle Portfolio',
    tag: 'Portfolio · WebGL',
    color: '#4ac8ff',
    blurb: 'My own portfolio: a software developer in Bulawayo showing interactive websites built with React, Three.js and WebGL. It opens with a press-start screen.',
    role: 'Design, 3D and front-end build',
    stack: 'React, Three.js, React Three Fiber, GSAP, Framer Motion, Tailwind CSS',
    href: 'https://www.lyle-portfolio.dev/',
    image: '/media/projects/lyle-portfolio.jpg',
  },
  {
    name: 'Pinnacle Welding',
    tag: 'E-commerce · Storefront',
    color: '#e23b2e',
    blurb: 'A standalone storefront for Pinnacle welding machines, consumables and safety gear, priced in US dollars and delivered across Zimbabwe.',
    role: 'Storefront design and build',
    stack: 'Node.js, Express, HTML, CSS, JavaScript',
    href: 'https://pinnacle.indigoprints.co.zw/',
    image: '/media/projects/pinnacle-welding.jpg',
  },
  {
    name: 'PokéDex',
    tag: 'Web app · Live data',
    color: '#ffcb05',
    blurb: 'An interactive Pokédex covering 1000+ Pokémon, with stats, abilities, evolution chains and types, fed live by PokéAPI. Search and favourites included.',
    role: 'Design and front-end build, with live data from PokéAPI',
    stack: 'React, TypeScript, Tailwind CSS, React Router, Axios',
    href: 'https://pok-dex-gilt.vercel.app/',
    image: '/media/projects/pok-dex.jpg',
  },
];
