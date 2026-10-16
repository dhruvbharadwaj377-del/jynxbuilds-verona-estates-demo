# VÉRONA film — asset creation guide

The walkthrough at the top of the site can be driven by a scroll-controlled
architectural film. **The film has not been produced yet.** Until it is
supplied, the site runs the procedural Three.js walkthrough, then the
chapter photography, exactly as before — nothing points at missing files.

This document is the contract between the footage and the code: what to
shoot or generate, how to export it, and how to switch it on.

---

## Status

| Item | State |
|---|---|
| Scroll-driven film player, fallbacks and asset contract | Implemented and tested with a stand-in clip |
| **The VÉRONA film itself** (1080p, 720p, poster, and an optional night grade) | **Not produced. Required before Film appears on the site.** |
| Feature-point coordinates on the footage | Set after the film exists (section 7) |

No video-generation tool was available while this was built, so nothing
has been generated. The stand-in clip used for testing stitched together
photos of *different* houses. It was deliberately kept out of the
repository and must not be used as the film.

## 1. Switching the film on

1. Put the exported files in `public/video/`:

   | File | Required | Purpose |
   |---|---|---|
   | `verona-film-1080.mp4` | yes | Desktop / tablet, 1920×1080 |
   | `verona-film-720.mp4` | recommended | Phones and low-memory devices, 1280×720 |
   | `verona-film-poster.jpg` | recommended | Exact first frame, shown instantly while the film downloads |
   | `verona-film-night-1080.mp4` (+ `-720`, poster) | optional | A night grade **of the same footage** — enables the Dusk/Night switch |

2. Copy `src/experience/film/verona-film.example.json` to
   `src/experience/film/verona-film.json` and set `duration` and the chapter
   timestamps to match the real cut (section 3).
3. `npm run build`. The manifest is read at build time, so a site without it
   never requests any video.

### Manifest reference

```jsonc
{
  "version": 1,
  "duration": 22,                       // seconds, from ffprobe
  "sources": {
    "desktop": "/video/verona-film-1080.mp4",
    "mobile":  "/video/verona-film-720.mp4",      // optional
    "poster":  "/video/verona-film-poster.jpg"    // optional
  },
  "night": {                            // optional — omit unless it exists
    "desktop": "/video/verona-film-night-1080.mp4",
    "mobile":  "/video/verona-film-night-720.mp4",
    "poster":  "/video/verona-film-night-poster.jpg"
  },
  "chapters": {                         // one per chapter, strictly increasing
    "intro": 0, "arrival": 5, "terrace": 9.5,
    "living": 14, "suite": 18.5, "closing": 21.9
  },
  "hotspots": {                         // optional, see section 7
    "pool": { "x": 0.46, "y": 0.63 }
  }
}
```

An invalid manifest is ignored with a console warning, and the 3D view is
used instead.

---

## 2. How the site uses the footage

- The visitor's scroll position sets the film's timestamp. Scrolling down
  moves the camera forward and scrolling up reverses it. The video never
  autoplays and never plays sound.
- Each chapter **holds on its timestamp** while its card is being read,
  then eases to the next. So the camera should be nearly still around
  each chapter mark (about ±0.4 s), with motion in between.
- The full file is downloaded once, then scrubbed from memory. Size
  matters, and so does the keyframe interval (section 5).
- Fallbacks are automatic:

  | Condition | What the visitor sees |
  |---|---|
  | The film is missing, fails or is too slow to scrub | The 3D walkthrough |
  | Save-Data is on, or there is no WebGL | Photography |
  | Reduced motion | 3D by default, with cuts between views and no scrubbing. If the visitor picks Film, it cuts between chapter frames instead of scrubbing. |

---

## 3. The property: continuity bible

Every frame must show **one** house. The chapter cards on the site already
describe it, so the footage must match these facts or the copy becomes
untrue:

- **Stone core:** a solid, warm travertine volume (horizontal coursing)
  containing the entrance. It anchors the plan.
- **Cantilevered suite:** a long upper box clad in the same travertine,
  projecting well past the ground floor over the terrace. It has no
  columns beneath it, and its long side is fully glazed towards the city.
- **Timber soffit:** warm timber lines the underside of the cantilever,
  with a regular grid of small recessed downlights.
- **Glass pavilion:** the ground floor is floor-to-ceiling sliding glazing
  in slim dark-bronze frames, opening onto the terrace at the same level.
- **Infinity pool:** a long rectangular pool runs the length of the
  terrace, parallel to the façade. It ends in a vanishing edge towards the
  view, and turquoise underwater lights show at dusk.
- **Arrival:** a path of large-format pale stone pavers rises through a
  dark garden. It is lined with low bollard lights and ends in a few broad
  steps up to the terrace.
- **Landscape:** palms and low clipped shrubs, a dark lawn, and no
  neighbouring houses in shot.
- **Setting:** the plot is elevated. Beyond it, a valley of scattered warm
  city lights and a distant skyline sit low on the horizon, with a soft
  ridge line behind.
- **Interior:** warm timber slat walls, a low dark sofa group, a stone
  kitchen island, three small globe pendants over a dining table, one
  dark artwork, and pale linen in the suite.
- **Light:** blue-hour dusk, about 20 minutes after sunset. The sky runs
  from deep blue to a warm peach horizon, and the warm 2700 K interior
  glow is the brightest thing in frame. Light direction stays consistent
  throughout.
- **Grade:** warm highlights, slightly lifted blacks, no teal-orange cliché,
  gentle contrast, and no lens flares or bloom.

---

## 4. Shot list (target ≈ 22 s, 16:9, one continuous-feeling take)

Times below match the example manifest. Adjust the manifest to the real cut.

| Time | Chapter | Camera |
|---|---|---|
| 0.0 – 1.0 | **Overview (hold)** | High three-quarter establishing view from the front-left at about 10 m height. The whole house, the pool and the city lights beyond. Almost static. |
| 1.0 – 5.0 | → Arrival | A slow descending arc down to eye height (1.6 m) at the foot of the garden path, looking up the path towards the entrance in the stone core. |
| 5.0 (hold) | **Arrival** | Bollards in the foreground, the stone core and the lit glazing ahead. |
| 5.4 – 9.5 | → Terrace | A steady dolly up the steps, turning left onto the terrace. The pool comes into view along its length, with the vanishing edge and the living room on the right. |
| 9.5 (hold) | **Terrace** | Low (1.2 m) view along the pool towards the vanishing edge. The glass pavilion and timber soffit are visible. |
| 9.9 – 14.0 | → Living | Track towards an **open** glazed slider and pass through the opening into the living room. |
| 14.0 (hold) | **Living** | Inside, looking back out through the full-height glass to the terrace and pool. |
| 14.4 – 18.5 | → Suite | Rise up the interior (or a motivated cut, see section 6) to the upper level. Move slowly across the suite towards its glazing. |
| 18.5 (hold) | **Suite** | Bed in the foreground, with the long window framing the city skyline. |
| 18.9 – 22.0 | Closing | A very slow push or drift onto a calm final composition: the skyline through the suite glazing, or the cantilever silhouetted at dusk. The film ends on a frame that can be held indefinitely. |

Camera rules:

- Gimbal or dolly-like inertia, at roughly walking pace or slower.
- No whip pans, no sudden zooms, and no handheld shake.
- Focal length is roughly constant (24–35 mm full-frame equivalent).
- Avoid heavy motion blur. Scrubbed frames are seen as stills.

---

## 5. Export specification (tested)

Scroll-scrubbing seeks constantly, so the keyframe interval matters far
more than bitrate. These are measurements from headless desktop Chrome on
an Apple-silicon Mac. The 20.8 s, 1080p, 30 fps test clip was built from
the site's photos. It is a timing fixture, not the film, so treat the
numbers as relative.

| Encode | Size | Seek, scroll-sized steps | Seek, chapter jumps | Verdict |
|---|---|---|---|---|
| H.264 all-intra (`-g 1`) | 33.2 MB | ~7 ms | p95 ~20 ms | Smooth, but too large to download |
| **H.264 GOP 15, no B-frames** | **11.1 MB** | **~13–14 ms** | **p95 ~7–12 ms** | **Use this** |
| H.264 default long-GOP (`-g 300`) | 6.2 MB | ~117 ms | p95 ~274 ms | Judders at roughly 8 fps. The site detects it and falls back to 3D. |
| VP9 WebM, GOP 15 (`crf 36`) | 7.3 MB | stalled | stalled | After the first seek, `seeked` never fired, with `readyState` stuck at `HAVE_METADATA`. Served as the film, it failed with a media error and the site fell back to 3D. |

Phones will be slower than this machine. That is why the 720p encode
exists, and why the player hands over to 3D if seeks average more than
100 ms or a seek has not resolved after 2.5 s.

Commands, from a high-quality master (ProRes or a high-bitrate MP4):

```bash
# Desktop
ffmpeg -i master.mov -an -vf "scale=1920:1080:flags=lanczos,fps=30" \
  -c:v libx264 -preset slow -crf 23 -pix_fmt yuv420p \
  -g 15 -keyint_min 15 -bf 0 -sc_threshold 0 -movflags +faststart \
  public/video/verona-film-1080.mp4

# Mobile
ffmpeg -i master.mov -an -vf "scale=1280:720:flags=lanczos,fps=30" \
  -c:v libx264 -preset slow -crf 25 -pix_fmt yuv420p \
  -g 15 -keyint_min 15 -bf 0 -sc_threshold 0 -movflags +faststart \
  public/video/verona-film-720.mp4

# Poster = exact first frame
ffmpeg -i public/video/verona-film-1080.mp4 -frames:v 1 -q:v 3 \
  public/video/verona-film-poster.jpg

# Duration for the manifest
ffprobe -v error -show_entries format=duration -of csv=p=0 public/video/verona-film-1080.mp4
```

Targets:

- 1080p at 15 MB or less, and 720p at 6 MB or less, for about 22 s. If a
  file is larger, raise the CRF by 1–2 rather than lengthening the GOP.
- 30 fps.
- No audio track (`-an`).
- H.264 MP4 only. The VP9 WebM variant was smaller, but it would not scrub
  in testing (see the table above). The player therefore only consumes MP4
  sources, and an optional WebM would add nothing.

**Night grade:** create it by grading the **same master**, never by
regenerating, so that every frame lines up. Export it with identical
settings, and add the `night` block to the manifest. Without it, the
Dusk/Night switch is hidden in film mode.

---

## 6. Practical production workflows

Pick the most reliable route available. Do not stitch together clips of
different houses and present them as one take.

### A. Rendered from a 3D model (most reliable)

Model the house in Blender, Unreal or Twinmotion, following the continuity
bible above. The procedural scene in `src/experience/scene.js` is a usable
massing and layout reference. Animate one camera along the shot list and
path-trace it at dusk. The result is true continuity, an exact night grade
(re-render with the lights changed), and a free hand with timing. This is
the right choice for any real development, because the footage must show
the actual design.

### B. AI video generation, multi-shot with locked keyframes

Long single generations rarely hold architecture steady for 20 s or more,
so:

1. **Lock the design.** Generate or paint one hero still from the
   continuity bible, then derive a small reference set from it: front
   three-quarter, terrace, living room, suite. Reject any still where
   the architecture drifts.
2. **Make a still for each chapter mark.** The five hold frames in the shot
   list come from the reference set. These become the shared boundary
   frames between shots.
3. **Animate between marks.** Use image-to-video with **start-frame and
   end-frame conditioning**. Shot *n* ends on exactly the frame that shot
   *n + 1* starts on, so the joins are continuous with no cut. That gives
   four shots of about 4–5 s each.
4. **Hide the exterior-to-interior move behind the glass.** Generate the
   push through an *open* slider. If the model warps the frame, end the
   exterior shot on a close pass across a dark mullion or the stone core
   edge, and start the interior shot from the same occluder. This hides
   the join where the architecture motivates it.
5. **Ground floor to suite:** use a vertical move past the stone core wall
   or the dark soffit edge. Again, the occluder carries the join.
6. **Conform:** join on the shared frames and apply one grade across the
   whole sequence. Stabilise if needed, and remove any frames with
   artefacts.
7. **QA every frame** against section 8 before exporting.

### Production prompt: style block (prepend to every shot)

> Photorealistic architectural film of a single contemporary luxury villa at
> blue-hour dusk, about 20 minutes after sunset. A warm travertine stone core
> with horizontal coursing. A long cantilevered upper suite clad in the same
> travertine projects over the terrace with no supporting columns; its
> underside is warm timber with a grid of small recessed downlights. The
> ground floor is a pavilion of floor-to-ceiling sliding glass in slim
> dark-bronze frames. A long rectangular infinity pool with turquoise
> underwater lights runs parallel to the façade and ends in a vanishing edge.
> Large pale stone pavers, palms, clipped shrubs, low bollard lights. The plot
> is elevated above a valley of scattered warm city lights with a distant
> skyline low on the horizon. The warm 2700 K interior glow is the brightest
> element. The sky runs from deep blue to a peach horizon. Shot on a cinema
> camera, 28 mm lens, smooth gimbal movement, natural exposure, subtle film
> grain, editorial architectural photography, consistent geometry, sharp
> straight verticals.

### Per-shot prompts

1. **Overview → Arrival (0–5 s):** *[style block]* Start: a high
   three-quarter establishing view of the whole villa, pool and city lights.
   The camera slowly descends in a gentle arc to eye level at the foot of
   the lit garden path, ending looking up the path towards the entrance in
   the stone core.
2. **Arrival → Terrace (5–9.5 s):** *[style block]* Start: eye level on the
   garden path, bollards in the foreground. The camera glides steadily up
   the broad steps and turns left onto the terrace, revealing the full
   length of the infinity pool. It ends low beside the pool, looking towards
   the vanishing edge, with the glass pavilion and timber soffit on the
   right.
3. **Terrace → Living (9.5–14 s):** *[style block]* Start: low beside the
   pool. The camera tracks slowly towards an open full-height glass slider
   and passes through it into the warm living room. It ends inside, looking
   back out through the glass to the terrace and pool.
4. **Living → Suite → Close (14–22 s):** *[style block]* Start: inside the
   living room. The camera rises smoothly past the stone wall to the upper
   suite and drifts slowly towards the long window. It ends on a calm,
   centred composition of the bed and the city skyline through the glass,
   and the motion settles to a stop.

**Negative prompt / avoid:**

> different house, changing architecture, morphing windows, warped or bending
> mullions, flickering, melting geometry, extra floors, inconsistent
> furniture, people, cars, text, logos, watermark, lens flare, heavy motion
> blur, fast camera, handheld shake, zoom, fisheye, oversaturated, daylight,
> night without sky colour, fog, rain.

---

## 7. Feature points on the footage (optional)

The cards' "In this view" lists always work. To also pin a feature point on
the picture, measure it on the exact chapter-mark frame:

```bash
ffmpeg -ss 9.5 -i public/video/verona-film-1080.mp4 -frames:v 1 terrace.png
```

Then add `"pool": { "x": 0.46, "y": 0.63 }` to `hotspots`, where x and y
are fractions of the frame width and height. The ids come from
`src/experience/chapters.js`, and each point appears only while the film
rests on its chapter's mark. If a feature is not clearly visible at that
frame, do not add a point for it.

---

## 8. Quality checklist before shipping

- [ ] One house throughout: identical massing, cladding, window rhythm, pool
      shape, planting and furniture.
- [ ] No flicker, warping, swimming textures or bending verticals. Check by
      scrubbing frame by frame, which is how visitors will see it.
- [ ] The camera settles at each chapter mark, and the hold frames are
      sharp.
- [ ] The final frame is a composition worth holding.
- [ ] Every claim in the chapter copy (`src/experience/chapters.js`) is
      visible in the footage. Otherwise, edit the copy.
- [ ] The files meet the size targets, use GOP 15 with no B-frames, have no
      audio, and include faststart.
- [ ] Testing with `npm run build && npm run preview` shows film chapter
      rests land on the marks, reverse scrolling is smooth, and the status
      line shows no "Film was slow" fallback.
