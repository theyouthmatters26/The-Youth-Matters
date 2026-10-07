import { useMemo } from 'react'
import { useApi } from './api'
import { parseArticle } from './article'

// Blog articles come from the API (the team writes them in the admin panel).
// The body arrives as the text the writer typed; parseArticle turns it into the blocks the page renders.

const displayDate = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
const shaped = (a) => ({ ...a, date: displayDate(a.published) })

export function useArticles() {
  const { data, loading } = useApi('/blogs')
  const articles = useMemo(() => (data || []).map(shaped), [data])
  return { articles, loading }
}

export function useArticle(slug) {
  const { data, error, loading } = useApi(`/blogs/${slug}`)
  const post = useMemo(() => data && { ...shaped(data), body: parseArticle(data.source) }, [data])
  return { post, loading, missing: error?.status === 404, error }
}
