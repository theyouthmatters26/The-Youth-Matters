// How blog articles are written. An article is plain text in the admin editor; this turns it into the
// typed blocks that components/blog/ArticleBody.jsx renders, and back again.
//
//   ## Section heading            (add {#custom-id} to choose the link anchor)
//   ### Smaller heading
//   A paragraph. **Bold** and [links](https://example.com) work in any text.
//   - A bullet                    1. A numbered point
//   > A quote
//   > — Priya Sharma, Mentor at Leeds
//   :::tip Optional title         :::warning Optional title
//   :::steps                      each line:  Step title | What to do
//   :::checklist Title            each line is one thing to tick
//   :::stats                      each line:  £1,171 | per month outside London
//   :::example Label              a sample passage, for example "Weak opening"
//   :::table                      first line is the header, cells split by " | "
//   :::cta mentor                 or  :::cta community  (one line, no closing)
//
// Blocks that open with ::: end with a line that is only :::

export const slugify = (text) => text.toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

const cells = (line) => line.split(' | ').map((c) => c.trim())
const STAT = /^(\D*?)(\d[\d,]*(?:\.\d+)?)(.*?) \| (.+)$/

function fenced(kind, arg, lines) {
  const text = lines.join('\n').trim()
  const rows = lines.map((l) => l.trim()).filter(Boolean)
  switch (kind) {
    case 'tip':
    case 'warning':
      return { type: 'callout', tone: kind, ...(arg ? { title: arg } : {}), text: rows.join(' ') }
    case 'steps':
      return { type: 'steps', items: rows.map((r) => { const [title, ...rest] = r.split(' | '); return { title: title.trim(), text: rest.join(' | ').trim() } }) }
    case 'checklist': {
      const id = arg.match(/\{#([a-z0-9-]+)\}\s*$/)
      const title = arg.replace(/\s*\{#[a-z0-9-]+\}\s*$/, '')
      return { type: 'checklist', id: id ? id[1] : `checklist-${slugify(title)}`, title, items: rows }
    }
    case 'stats':
      return { type: 'stats', items: rows.map((r) => { const m = r.match(STAT); return m ? { value: Number(m[2].replace(/,/g, '')), prefix: m[1], suffix: m[3], label: m[4].trim() } : null }).filter(Boolean) }
    case 'example':
      return { type: 'example', label: arg || 'Example', text }
    case 'table':
      return rows.length ? { type: 'table', head: cells(rows[0]), rows: rows.slice(1).map(cells) } : null
    default:
      return text ? { type: 'p', text } : null
  }
}

export function parseArticle(source = '') {
  const lines = source.replace(/\r\n?/g, '\n').split('\n')
  const blocks = []
  let i = 0
  const take = (test) => { const got = []; while (i < lines.length && test(lines[i])) got.push(lines[i++]); return got }

  while (i < lines.length) {
    const line = lines[i]
    if (!line.trim()) { i += 1; continue }

    const fence = line.match(/^:::(\w+)\s*(.*)$/)
    if (fence) {
      i += 1
      if (fence[1] === 'cta') { blocks.push({ type: 'cta', kind: fence[2].trim() === 'mentor' ? 'mentor' : 'community' }); continue }
      const inner = take((l) => l.trim() !== ':::')
      i += 1 // the closing :::
      const block = fenced(fence[1], fence[2].trim(), inner)
      if (block) blocks.push(block)
      continue
    }
    const h2 = line.match(/^##\s+(.+?)(?:\s*\{#([a-z0-9-]+)\})?\s*$/)
    if (h2 && !line.startsWith('###')) { blocks.push({ type: 'h2', id: h2[2] || slugify(h2[1]), text: h2[1] }); i += 1; continue }
    if (line.startsWith('### ')) { blocks.push({ type: 'h3', text: line.slice(4).trim() }); i += 1; continue }
    if (/^- /.test(line)) { blocks.push({ type: 'list', ordered: false, items: take((l) => /^- /.test(l)).map((l) => l.slice(2).trim()) }); continue }
    if (/^\d+\. /.test(line)) { blocks.push({ type: 'list', ordered: true, items: take((l) => /^\d+\. /.test(l)).map((l) => l.replace(/^\d+\. /, '').trim()) }); continue }
    if (line.startsWith('>')) {
      const said = take((l) => l.startsWith('>')).map((l) => l.replace(/^>\s?/, ''))
      const credit = said.findIndex((l) => /^[—–-]\s/.test(l))
      const [by, ...role] = credit >= 0 ? said[credit].replace(/^[—–-]\s+/, '').split(', ') : ['']
      blocks.push({ type: 'quote', text: (credit >= 0 ? said.slice(0, credit) : said).join(' ').trim(), by: by.trim(), ...(role.length ? { role: role.join(', ').trim() } : {}) })
      continue
    }
    blocks.push({ type: 'p', text: take((l) => l.trim() && !/^(:::|##|- |\d+\. |>)/.test(l)).join(' ').trim() })
  }
  return blocks
}

const WRITE = {
  p: (b) => b.text,
  h2: (b) => `## ${b.text}${b.id && b.id !== slugify(b.text) ? ` {#${b.id}}` : ''}`,
  h3: (b) => `### ${b.text}`,
  list: (b) => b.items.map((t, n) => (b.ordered ? `${n + 1}. ${t}` : `- ${t}`)).join('\n'),
  quote: (b) => `> ${b.text}${b.by ? `\n> — ${b.by}${b.role ? `, ${b.role}` : ''}` : ''}`,
  callout: (b) => `:::${b.tone === 'warning' ? 'warning' : 'tip'}${b.title ? ` ${b.title}` : ''}\n${b.text}\n:::`,
  steps: (b) => `:::steps\n${b.items.map((s) => `${s.title} | ${s.text}`).join('\n')}\n:::`,
  checklist: (b) => `:::checklist ${b.title}${b.id !== `checklist-${slugify(b.title)}` ? ` {#${b.id}}` : ''}\n${b.items.join('\n')}\n:::`,
  stats: (b) => `:::stats\n${b.items.map((s) => `${s.prefix || ''}${s.value}${s.suffix || ''} | ${s.label}`).join('\n')}\n:::`,
  example: (b) => `:::example ${b.label}\n${b.text}\n:::`,
  table: (b) => `:::table\n${[b.head, ...b.rows].map((r) => r.join(' | ')).join('\n')}\n:::`,
  cta: (b) => `:::cta ${b.kind}`,
}

export const writeArticle = (blocks) => blocks.map((b) => WRITE[b.type]?.(b)).filter(Boolean).join('\n\n')

// Snippets the editor's Insert buttons drop in, one per kind of block
export const SNIPPETS = [
  ['Heading', '## A section heading'],
  ['Subheading', '### A smaller heading'],
  ['Bullets', '- First point\n- Second point'],
  ['Numbered', '1. First\n2. Second'],
  ['Quote', '> What they said, in their own words.\n> — Name, Course and university'],
  ['Tip', ':::tip A short title\nA useful thing to know.\n:::'],
  ['Warning', ':::warning A short title\nSomething that catches people out.\n:::'],
  ['Steps', ':::steps\nFirst step | What to do and why.\nSecond step | What to do next.\n:::'],
  ['Checklist', ':::checklist Before you fly\nPassport and visa\nOffer letter\n:::'],
  ['Numbers', ':::stats\n28 days | the money must stay in the account\n£1,171 | a month outside London\n:::'],
  ['Example', ':::example Example opening\nThe passage you want to show.\n:::'],
  ['Table', ':::table\nCountry | What to do | Where\nUK | Check your eVisa | GOV.UK\n:::'],
  ['Mentor banner', ':::cta mentor'],
  ['Community banner', ':::cta community'],
]

export const wordCount = (source) => source.replace(/^:::.*$|[#>|*]/gm, ' ').split(/\s+/).filter(Boolean).length
