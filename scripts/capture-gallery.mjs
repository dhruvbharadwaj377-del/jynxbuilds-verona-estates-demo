// Captures the gallery stills from the estate itself: the same code-built scene as
// the hero, viewed from chosen positions. No external imagery, no offline renderer.
//
//   npm run build && npx vite preview --port 4317 --strictPort   (in another terminal)
//   node scripts/capture-gallery.mjs
//
// Requires Google Chrome. Writes public/Images/estate/<name>-<width>.webp.

import { spawn } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gradedHeight } from '../src/experience/estate/plan.js'

const OUT = fileURLToPath(new URL('../public/Images/estate/', import.meta.url))
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const URL_ = process.env.URL || 'http://localhost:4317/'

// p: point in the journey (sets build state, light and time of day).
// pos/look: camera in world metres; a `ground` entry (metres above the finished ground)
// replaces y for eye-level shots, since the site slopes. size: output pixels. widths: files to write.
const SHOTS = [
  { name: 'estate-aerial', p: 0.86, pos: [96, 68, 92], look: [-4, 0, -24], fov: 34, size: [2400, 1350], widths: [2400, 1200] },
  { name: 'hero-dusk', p: 0.965, pos: [9, { ground: 6 }, -93], look: [-2.5, { ground: 3.2 }, -118], fov: 40, size: [2400, 1350], widths: [2400, 1200] },
  { name: 'pool-terrace', p: 0.86, pos: [-59, 2.2, 13], look: [-40, 2.6, 0], fov: 42, size: [2000, 1500], widths: [2000, 1000] },
  { name: 'oak-fins', p: 0.86, pos: [-50.5, 5.4, 43], look: [-43.4, 5, 50.5], fov: 32, size: [1500, 2000], widths: [1500, 750] },
  { name: 'avenue', p: 0.875, pos: [1.6, 1.65, 122], look: [0, 3.4, 40], fov: 38, size: [1500, 2000], widths: [1500, 750] },
  { name: 'club-dusk', p: 0.965, pos: [64, 2.3, 117], look: [42, 2, 104], fov: 40, size: [2400, 1350], widths: [2400, 1200] },
  { name: 'garden-dusk', p: 0.965, pos: [14, { ground: 1.7 }, -138], look: [-1, { ground: 3.2 }, -121], fov: 42, size: [2000, 1500], widths: [2000, 1000] },
  { name: 'foundations', p: 0.318, pos: [-15, 2.2, 62], look: [-34, -0.3, 50], fov: 40, size: [2000, 1500], widths: [2000, 1000] },
]

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
mkdirSync(OUT, { recursive: true })
const profile = mkdtempSync(join(tmpdir(), 'verona-capture-'))
const port = 9900 + Math.floor(Math.random() * 90)
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--enable-gpu', '--use-angle=metal', 'about:blank'], { stdio: 'ignore' })

let ws
for (let i = 0; i < 60; i++) {
  try {
    const page = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find((t) => t.type === 'page')
    ws = new WebSocket(page.webSocketDebuggerUrl)
    await new Promise((r, j) => { ws.onopen = r; ws.onerror = j })
    break
  } catch { await sleep(200) }
}
let id = 0
const pending = new Map()
ws.onmessage = (m) => { const msg = JSON.parse(m.data); if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id) } }
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })) })
const evaluate = async (expression) => {
  const res = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
  if (res.result?.exceptionDetails) throw new Error(res.result.exceptionDetails.exception?.description || res.result.exceptionDetails.text)
  return res.result?.result?.value
}
await send('Page.enable')
await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 900, deviceScaleFactor: 1, mobile: false })

// Resolve eye-level heights against the master plan's finished ground.
const resolve = ([x, y, z]) => [x, typeof y === 'object' ? gradedHeight(x, z) + y.ground : y, z]
for (const s of SHOTS) {
  s.pos = resolve(s.pos)
  s.look = resolve(s.look)
}

for (const shot of SHOTS) {
  await send('Page.navigate', { url: `${URL_}?debug&quality=high&p=${shot.p}` })
  let ready = false
  for (let i = 0; i < 400 && !ready; i++) {
    await sleep(100)
    ready = await evaluate(`!!document.querySelector('.estate--ready') && !!window.__verona`).catch(() => false)
  }
  if (!ready) throw new Error(`scene not ready for ${shot.name}`)
  await sleep(2500) // let the damped progress settle on p
  const images = await evaluate(`(() => {
    const { renderer, scene, camera } = window.__verona
    const [W, H] = ${JSON.stringify(shot.size)}
    // Grass is culled by distance to the hero camera; show it all for the still.
    scene.traverse((o) => { if (o.userData.grassChunk) o.visible = true })
    camera.position.set(${shot.pos.join(',')})
    camera.lookAt(${shot.look.join(',')})
    camera.fov = ${shot.fov}
    camera.aspect = W / H
    camera.clearViewOffset()
    camera.updateProjectionMatrix()
    renderer.setPixelRatio(1)
    renderer.setSize(W * 2, H * 2, false) // render at 2x, downsample for clean edges
    renderer.render(scene, camera)
    const out = {}
    for (const w of ${JSON.stringify(shot.widths)}) {
      const h = Math.round((w * H) / W)
      const c = document.createElement('canvas')
      c.width = w
      c.height = h
      const x = c.getContext('2d')
      x.imageSmoothingQuality = 'high'
      x.drawImage(renderer.domElement, 0, 0, w, h)
      out[w] = c.toDataURL('image/webp', 0.84).split(',')[1]
    }
    return out
  })()`)
  for (const [w, data] of Object.entries(images)) {
    const file = join(OUT, `${shot.name}-${w}.webp`)
    writeFileSync(file, Buffer.from(data, 'base64'))
    console.log(file)
  }
}

ws.close()
chrome.kill()
await sleep(300)
rmSync(profile, { recursive: true, force: true })
