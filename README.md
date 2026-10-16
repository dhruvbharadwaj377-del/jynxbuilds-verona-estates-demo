# VÉRONA Estates — JynxBuilds concept demo

A fictional luxury real-estate brand built by JynxBuilds to show what a
hybrid-3D property website can feel like. Residences, locations and the 3D
house are illustrative, not real listings.

## Run

```bash
npm install
npm run dev      # local development
npm run build    # production build → dist/
npm run preview  # serve the production build
npm run lint
```

## The 3D walkthrough (`src/experience/`)

- `chapters.js` — the story: one entry per scroll chapter with its camera
  keyframe, hotspots and fallback photograph. Edit this to change the tour.
- `scene.js` — procedural Three.js residence (no model files). Loaded with a
  dynamic `import()` so three.js stays out of the initial bundle. Renders on
  demand only — no frames while idle or offscreen.
- `EstateExperience.jsx` — sticky stage, scroll → camera progress, hotspots,
  Dusk/Night lighting, 3D on/off toggle.
- `experience.css` — styles, using the site tokens from `App.css`.

Fallbacks: without WebGL (or with Save-Data on), or if the scene fails, the
same chapters play over the existing photography. With reduced motion the
camera cuts between views instead of flying, and pointer parallax is off.
Smaller screens and touch devices get a lighter scene (no shadows, fewer
objects, capped pixel ratio).

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
