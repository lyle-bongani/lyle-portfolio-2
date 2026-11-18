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
// `facts` are the big numbers in the case study's colour band (keep them true).
// `study` is the case study that opens when someone clicks the screen or the button: the brief, what was built, the result.
export const projects = [
  {
    name: 'DL Origin',
    tag: 'Web agency · Co-founded',
    color: '#ff7a00',
    blurb: 'Websites, hosting, domains and business email from Harare, with one team and one bill. Websites from $300, hosting from $3 a month.',
    role: 'Co-founder: design, build and run the business',
    stack: 'Next.js, React, TypeScript, Tailwind CSS, GSAP, Lenis',
    href: 'https://www.dlorigin.com/',
    facts: [
      { value: "$300", label: "Websites from" },
      { value: "$3/mo", label: "Hosting from" },
      { value: "1 bill", label: "Site, hosting, domain and email together" },
    ],
    study: {
      brief: "Launch our own web agency, with a site that sells websites, hosting, domains and business email as one simple offer: one team and one bill.",
      built: [
        "A brand-led home page with clear starting prices: websites from $300, hosting from $3 a month.",
        "Smooth scrolling with Lenis and GSAP motion that carries you through every service.",
        "A Next.js and TypeScript build, styled with Tailwind CSS, kept fast and easy to find in search.",
      ],
      result: "The live home of DL Origin, and the first place new clients meet the business.",
    },
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
    facts: [
      { value: "3D", label: "Interactive product hero" },
      { value: "2", label: "Product ranges: tubes and containers" },
    ],
    study: {
      brief: "A Zimbabwean maker of collapsible aluminium tubes and rigid containers needed a site that makes an industrial product feel premium.",
      built: [
        "An interactive 3D tube as the hero, built with Three.js and React Three Fiber, that you can look around.",
        "Scroll-led storytelling with GSAP and Lenis, so the product reveals itself section by section.",
        "Clear sections for the tube and container ranges, built in Next.js and React.",
      ],
      result: "Buyers can see and turn the product before they ever hold one.",
    },
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
    facts: [
      { value: "0", label: "Frameworks: hand-written HTML, CSS and JS" },
      { value: "3", label: "Featured projects: app, packaging, branding" },
    ],
    study: {
      brief: "A UI/UX designer wanted a portfolio that feels like their own work, not a template.",
      built: [
        "A layout built around African pattern artwork.",
        "A bold black and copper look carried through type, colour and detail.",
        "Hand-written HTML, CSS and JavaScript with no framework, so it stays light and quick.",
      ],
      result: "A portfolio as distinctive as the designer behind it.",
    },
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
    facts: [
      { value: "WebGL", label: "Interactive 3D scenes" },
      { value: "14", label: "Projects on show" },
    ],
    study: {
      brief: "My main portfolio had to show what I can do with WebGL, not just list it.",
      built: [
        "A press-start intro screen that sets the tone before the site opens.",
        "Interactive 3D scenes built with Three.js and React Three Fiber.",
        "Motion with GSAP and Framer Motion, styled with Tailwind CSS.",
      ],
      result: "The home of my work, with every project and how to reach me.",
    },
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
    facts: [
      { value: "USD", label: "Prices in US dollars" },
      { value: "Nationwide", label: "Delivery across Zimbabwe" },
    ],
    study: {
      brief: "Pinnacle needed a standalone online store for its welding machines, consumables and safety gear.",
      built: [
        "A product catalogue priced in US dollars, with delivery across Zimbabwe.",
        "A Node.js and Express server behind plain HTML, CSS and JavaScript pages.",
        "Product pages laid out so buyers can compare machines and gear quickly.",
      ],
      result: "Pinnacle's range is online and can be ordered from anywhere in the country.",
    },
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
    facts: [
      { value: "1000+", label: "Pokémon to explore" },
      { value: "Live", label: "Data straight from PokéAPI" },
    ],
    study: {
      brief: "A personal project: a fast, friendly Pokédex that stays current without hand-entering data.",
      built: [
        "1000+ Pokémon with stats, abilities, evolution chains and types, pulled live from PokéAPI with Axios.",
        "Search, plus favourites you can come back to.",
        "React and TypeScript, with React Router for the pages and Tailwind CSS for the look.",
      ],
      result: "Every Pokémon is a search away, and the data stays current on its own.",
    },
    image: '/media/projects/pok-dex.jpg',
  },
  {
    name: 'First Aid Kits',
    tag: 'E-commerce · Two countries',
    color: '#e11d2e',
    blurb: 'Online shops for first aid kits, fire extinguishers and safety supplies, priced in USD for Zimbabwe and in ZMW for Zambia, from one shared codebase.',
    role: 'Design and build of two storefronts from one codebase',
    stack: 'Astro, TypeScript, JavaScript, Python',
    href: 'https://firstaidkits.co.zw/',
    facts: [
      { value: "2", label: "Countries: Zimbabwe and Zambia" },
      { value: "1", label: "Shared codebase" },
      { value: "2", label: "Currencies: USD and ZMW" },
    ],
    study: {
      brief: "One safety-supplies business selling in two countries, Zimbabwe and Zambia, each in its own currency.",
      built: [
        "Two storefronts for first aid kits, fire extinguishers and safety supplies, built from one shared codebase.",
        "Prices in US dollars for Zimbabwe and in Zambian kwacha for Zambia.",
        "Fast, mostly static pages built with Astro and TypeScript.",
      ],
      result: "Both shops run from the same code, so a change made once goes live in both countries.",
    },
    image: '/media/projects/first-aid-kits.jpg',
  },
  {
    name: 'Free PSD Mockups',
    tag: 'Content site · 10,000+ templates',
    color: '#6d3bd9',
    blurb: 'A free library of 10,000+ PSD mockups for packaging, devices, apparel and branding, with no registration, no watermarks and commercial use included.',
    role: 'Design and front-end build',
    stack: 'Next.js, React',
    href: 'https://www.freepsdmockups.org/',
    facts: [
      { value: "10,000+", label: "Free mockups" },
      { value: "0", label: "Sign-ups or watermarks" },
    ],
    study: {
      brief: "Build a free library of design mockups that people can actually find and use.",
      built: [
        "10,000+ PSD mockups across packaging, devices, apparel and branding.",
        "No registration and no watermarks, with commercial use included.",
        "A Next.js and React build, with pages made to be found in search.",
      ],
      result: "Designers get print-ready mockups in a couple of clicks, free.",
    },
    image: '/media/projects/free-psd-mockups.jpg',
  },
];
