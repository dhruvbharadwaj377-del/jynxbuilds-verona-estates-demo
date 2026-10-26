# VÉRONA Estates — JynxBuilds concept demo

A fictional luxury real-estate brand built by JynxBuilds to show what a
code-first, real-time 3D property website can feel like. The estate, its
residences and locations are illustrative, not a real development.

## Run

```bash
npm install
npm run dev      # local development
npm run build    # production build → dist/
npm run preview  # serve the production build
npm run lint
```

## The estate (`src/experience/`)

The hero is one continuous, scroll-driven journey: untouched land → site
preparation → foundations → structure → architecture → landscape → the
finished estate at dusk → a handoff into the page. It is built entirely in
code with Three.js: no video, no image sequences, no external models.

Everything is a pure function of scroll progress, so scrolling backwards
un-builds the estate exactly. Each construction element carries its own
schedule in vertex attributes (`aBuild`, `aRise`); one shared uniform reveals
walls course by course, pours slabs across their rebar and strikes formwork
top-first, in the shader. Machinery positions and poses are computed from the
same progress value.

Add `?p=0.42` to the URL to jump to a point in the journey, `?debug` to expose
renderer stats on `window.__verona`, `?quality=low|high` to force a tier and
`?nowebgl` to see the fallback.

- `estate/plan.js`: the master plan. Terrain, plots, roads, every building's
  construction schedule and the machinery routes. All other modules read it.
- `estate/villa.js`: the procedural villa, built in construction order.
- `estate/site.js`: roads, kerbs, footpaths, lighting, gate, hoarding,
  compound and tower crane.
- `estate/terrain.js`: one seamless ground mesh carrying clearing, grading,
  excavation and turf timings per vertex.
- `estate/vegetation.js`: instanced woodland, avenue, garden trees and grass,
  with growth windows.
- `estate/machines.js`: articulated excavators, dump truck and mixers.
- `estate/materials.js`: the build-reveal and triplanar material patches,
  vegetation growth and the terrain shader.
- `estate/textures.js`: procedural, seamlessly tiling canvas textures.
- `estate/atmosphere.js`: sky, sun, fog and reflections from dawn to blue hour.
- `estate/camera.js`: the camera keyframes and their monotone-cubic timing.
- `scene.js`: assembles the estate progressively, compiles and warms up the
  shaders, then renders on demand with MSAA, bloom (high tier) and a grade.
- `stages.js`: the story copy and each stage's scroll window.
- `SitePlan.jsx`: the master plan as an SVG drawing, used while the 3D view
  loads and as the fallback without WebGL2 or with Save-Data.
- `EstateExperience.jsx`: the sticky stage, stage cards, rail, loading state,
  view toggle (3D / Plan), reduced motion and the handoff.

Under reduced motion the journey cuts between each stage's finished view
instead of moving.

## Gallery stills (`public/Images/estate/`)

The gallery, philosophy, experience and enquiry images are views of the same
code-built estate, captured from chosen camera positions, not photographs and
not stock. To regenerate them after changing the estate:

```bash
npm run build
npx vite preview --port 4317 --strictPort   # in another terminal
node scripts/capture-gallery.mjs            # needs Google Chrome
```

The shot list (journey point, camera and output sizes) is at the top of
`scripts/capture-gallery.mjs`. The interior photographs in `public/Images/`
are mood imagery and are labelled as such on the page.

---

# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and Oxlint's TypeScript related rules in your project.
