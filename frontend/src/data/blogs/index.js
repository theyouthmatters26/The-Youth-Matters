// All published articles, newest first. Every other .js file in this folder is one article,
// stored as typed blocks (rendered by components/blog/ArticleBody.jsx): add a file to publish.
const modules = import.meta.glob(['./*.js', '!./index.js'], { eager: true })

const textOf = (b) => [b.text, b.title, b.label,
  ...(b.items || []).map((i) => (typeof i === 'string' ? i : [i.title, i.text, i.label].join(' '))),
  ...(b.rows || []).flat()].filter(Boolean).join(' ')

export const wordCount = (post) => post.body.map(textOf).join(' ').split(/\s+/).length

const displayDate = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

export const blogs = Object.values(modules)
  .map((m) => m.default)
  .map((post) => ({ ...post, readMins: Math.max(1, Math.round(wordCount(post) / 220)), date: displayDate(post.published) }))
  .sort((a, b) => b.published.localeCompare(a.published))
