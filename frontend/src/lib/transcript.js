// Saving a conversation. A chat holds things worth keeping: what a mentor advised, what the team
// promised, the dates. Both people in it can take a copy, and so can the team for a TYM AI chat.
//
// ponytail: the browser writes the PDF, through its own print dialog, instead of the server
// building one. A server-made PDF needs a font file shipped with it, and without one every name
// and message that is not plain Latin comes out as boxes. Students here write in Hindi, Arabic,
// Chinese and emoji. The browser already has the fonts for all of it. Swap this for a server
// endpoint the day a real font is bundled.
const escape = (text) => String(text ?? '').replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))

const when = (iso) => {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('en-GB',
    { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

const PAGE = `
  :root { color-scheme: light }
  * { box-sizing: border-box }
  body { margin: 0; padding: 32px 36px; background: #fff; color: #18181b;
         font: 15px/1.6 ui-sans-serif, system-ui, "Segoe UI", Roboto, Arial, sans-serif; }
  header { padding-bottom: 16px; margin-bottom: 24px; border-bottom: 1px solid #e4e4e7 }
  h1 { margin: 0 0 4px; font-size: 20px; font-weight: 600 }
  .sub, .saved { margin: 0; font-size: 13px; color: #71717a }
  .msg { margin: 0 0 18px; page-break-inside: avoid }
  .who { margin: 0 0 2px; font-size: 13px; font-weight: 600 }
  .at { margin-left: 8px; font-weight: 400; color: #a1a1aa }
  .body { margin: 0; white-space: pre-wrap; overflow-wrap: anywhere }
  .note { font-style: italic; color: #52525b }
  footer { margin-top: 28px; padding-top: 14px; border-top: 1px solid #e4e4e7;
           font-size: 12px; color: #a1a1aa }
  @page { margin: 18mm }
`

/** messages: [{ who, at, body, note }] — `note` marks a line the system wrote, not a person. */
export function saveTranscript({ title, subtitle, messages }) {
  const win = window.open('', '_blank')
  if (!win) return false   // a blocked popup: the caller says so rather than failing silently
  const lines = messages.map((m) => `
    <div class="msg">
      <p class="who">${escape(m.who)}<span class="at">${escape(when(m.at))}</span></p>
      <p class="body${m.note ? ' note' : ''}">${escape(m.body)}</p>
    </div>`).join('')
  win.document.write(`<!doctype html><html lang="en"><head><meta charset="utf-8">
    <title>${escape(title)}</title><style>${PAGE}</style></head><body>
    <header>
      <h1>${escape(title)}</h1>
      <p class="sub">${escape(subtitle)}</p>
      <p class="saved">Saved from The Youth Matters on ${escape(when(new Date().toISOString()))}</p>
    </header>
    ${lines || '<p class="note">There are no messages in this conversation yet.</p>'}
    <footer>${messages.length} message${messages.length === 1 ? '' : 's'} · theyouthmatters.com</footer>
    </body></html>`)
  win.document.close()
  win.focus()
  // Let the new window lay the text out before the dialog opens over it
  setTimeout(() => win.print(), 250)
  return true
}
