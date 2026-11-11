# Lyle Chadya: portfolio that crosses the solar system

Scroll-driven 3D portfolio. A caped hero runs and flies along a red thread of light from Earth to the Moon, Mars, Saturn and Pluto, then jumps out to look at the Milky Way. Built with Vite and Three.js.

```bash
npm install
npm run dev
```

## Where things are

| What | Where |
|---|---|
| All text, links and projects | `src/content.js` |
| The 3D world, route and camera | `src/world.js` |
| Sound (the song is filtered and shaped by scroll) | `src/audio.js` |
| Page, effects and interface | `src/main.js`, `src/style.css` |
| Music | `public/audio/track.mp3` |
| Models (built in Blender) | `public/models/`, sources in `tools/` |

## Adding a project

Add an entry to `projects` in `src/content.js`, then take its screenshot:

```bash
npm run shot -- https://your-site.com my-project
```

Sites with an intro gate: add `Enter` or the button text as a third argument.

## Rebuilding the 3D models

`npm run build:hero`, `npm run build:planets` and `npm run build:galaxy` re-run the Blender scripts in `tools/` (Blender 5 on your PATH).
