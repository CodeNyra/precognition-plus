// Records docs/demo.gif from the demo: the same form filled in with plain Laravel Precognition on the
// left and with Precognition Plus on the right, each counting the requests it sends to the server.
//
// Start the demo first (see demo/README.md), then:
//
//   cd demo/scripts
//   npm install && npx playwright install chromium
//   node record-gif.mjs [the demo's URL, http://localhost:8000 by default]
//
// It needs ffmpeg. Each side is a page of its own, so both can type at once, and ffmpeg puts the two
// recordings side by side, speeds them up and holds the last frame.
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { chromium } from 'playwright'

const base = (process.argv[2] ?? 'http://localhost:8000').replace(/\/$/, '')
const gif = join(import.meta.dirname, '../../docs/demo.gif')
const size = { width: 400, height: 520 }

// The same input on both sides. Leaving a field validates it, and Precognition waits 1.5 seconds before
// it does, so each step waits for that before the next one.
const steps = [
  ['name', 'Taylor'],
  ['age', '17'],
  ['age', '25'],
  ['postcode', '1234'],
  ['postcode', '12345'],
  ['email', 'new@example.com'],
]

const videos = mkdtempSync(join(tmpdir(), 'precognition-plus-gif-'))
const browser = await chromium.launch()

async function open(query) {
  const context = await browser.newContext({ viewport: size, recordVideo: { dir: videos, size } })
  const page = await context.newPage()
  const opened = Date.now()
  await page.goto(`${base}/?compact${query}`)
  await page.locator('#email').waitFor()
  return { context, page, opened }
}

const sides = await Promise.all([open('&plus=off'), open('')])
await sides[0].page.waitForTimeout(600)
const start = Date.now()

for (const [field, value] of steps) {
  await Promise.all(sides.map(async ({ page }) => {
    const input = page.locator(`#${field}`)
    await input.fill('')
    await input.pressSequentially(value, { delay: 70 })
    await input.press('Tab')
  }))
  await sides[0].page.waitForTimeout(2000)
}

const length = (Date.now() - start) / 1000
const counts = await Promise.all(sides.map(({ page }) => page.locator('span.text-2xl').innerText()))
const recordings = []

for (const { context, page, opened } of sides) {
  await context.close()
  recordings.push(['-ss', String((start - opened) / 1000), '-t', String(length), '-i', await page.video().path()])
}

await browser.close()

// About 7 seconds of filling in, then the counts held for 2.5 seconds.
const speed = Math.max(1, length / 7)
execFileSync('ffmpeg', [
  '-y', '-loglevel', 'error', ...recordings.flat(),
  '-filter_complex',
  `[0:v][1:v]hstack=inputs=2,setpts=PTS/${speed},fps=12,tpad=stop_mode=clone:stop_duration=2.5,split[a][b];`
    + '[a]palettegen[palette];[b][palette]paletteuse=dither=none:diff_mode=rectangle',
  gif,
])
rmSync(videos, { recursive: true })

console.log(`Plain Precognition sent ${counts[0]} requests, Precognition Plus ${counts[1]}.`)
console.log(`Wrote ${gif}, ${(statSync(gif).size / 1024 / 1024).toFixed(2)} MB.`)
