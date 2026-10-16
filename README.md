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

## The walkthrough (`src/experience/`)

The hero is a five-chapter walkthrough driven by scroll. It has three
interchangeable visual layers, chosen automatically (the visitor can switch
with the Film / 3D / Photos control):

1. **Film:** a scroll-scrubbed architectural film. Active only once the
   footage and `src/experience/film/verona-film.json` exist. **The film has
   not been produced yet.** See [`ASSET_CREATION.md`](ASSET_CREATION.md) for
   the asset contract, shot list, prompts and tested export settings.
2. **3D:** the procedural Three.js residence. This is the default until the
   film exists, and the fallback when the film is missing, fails, decodes too
   slowly, or reduced motion is on.
3. **Photos:** the chapter photography. Used with Save-Data, without WebGL,
   or when both of the above fail.

Files:

- `chapters.js`: the story. Each chapter has its 3D camera keyframe, feature
  notes and fallback photograph.
- `timeline.js`: the shared scroll → journey mapping, with holds at each
  chapter.
- `film.js`: manifest validation, the guarded download, and the
  scroll-scrub player (one seek in flight, slow-decode detection).
- `scene.js`: the procedural Three.js residence. It is lazy-loaded and
  renders on demand only.
- `EstateExperience.jsx`: the sticky stage, view selection, feature points,
  chapter rail and lighting control.
- `experience.css`: styles, using the site tokens from `App.css`.

Only the active layer's assets are downloaded. Under reduced motion, the
journey cuts between chapter views instead of moving.

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
