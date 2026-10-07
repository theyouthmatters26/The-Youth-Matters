// The public pages are also built ahead of time into plain HTML, so the first screen shows before any
// script has loaded (frontend/scripts/prerender.mjs opens each page in headless Chrome and saves what
// it drew). Three small things make that work:
//
//   building      true only inside that Chrome. Anything that moves on a timer (the hero slideshow)
//                 stays on its first frame, so the saved page is the page as it first appears.
//   carry(path)   while building, each API answer the page used is written into the page itself.
//   carried(path) in a visitor's browser, the first render reads those answers back, so React draws
//                 exactly what is already on screen instead of blanking it to a loading state.

export const building = navigator.userAgent.includes('TYM-Prerender')

const BOX = 'tym-data'
let answers

export function carried(path) {
  if (answers === undefined) {
    try { answers = JSON.parse(document.getElementById(BOX)?.textContent || '{}') } catch { answers = {} }
  }
  return answers[path] ?? null
}

export function carry(path, data) {
  let box = document.getElementById(BOX)
  if (!box) {
    box = Object.assign(document.createElement('script'), { id: BOX, type: 'application/json' })
    document.body.appendChild(box)
  }
  // "<" is written as an escape so nothing in the data can close the script tag early
  box.textContent = JSON.stringify({ ...JSON.parse(box.textContent || '{}'), [path]: data }).replace(/</g, '\\u003c')
}
