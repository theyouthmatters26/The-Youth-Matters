// Finding a mentor on the Mentors page. A student types whatever comes to mind: a country, a city,
// a university, a course, a language, or what they are stuck on. Every word has to match somewhere,
// so each word they add narrows the list, and the likeliest person comes first.

// What people type for a country when its name is not what came to mind
export const ALSO_CALLED = {
  uk: 'britain british england london scotland wales',
  usa: 'us america american states',
  canada: 'canadian toronto vancouver',
  australia: 'australian sydney melbourne aus',
  ireland: 'irish dublin eire',
  germany: 'german berlin munich deutschland',
  france: 'french paris',
}

// Everything one mentor can be found by, in a single string
export const searchable = (m) => [
  m.user.displayName, m.university, m.course, m.headline, m.experience, m.graduationYear,
  m.community.country.name, m.community.country.slug, ALSO_CALLED[m.community.country.slug],
  (m.topics || []).join(' '), (m.languages || []).join(' '),
].filter(Boolean).join(' ').toLowerCase()

// The words someone typed, as words: "leeds, SOP" looks for leeds and sop
export const typed = (text) => text.toLowerCase().match(/[a-z0-9+#]+/g) || []

// Who they most likely meant: a hit on the name, a topic, the country, the university or the course
// counts for more than one buried in a biography, and a better-rated mentor wins a tie.
export const relevance = (m, words) => {
  const strong = [m.user.displayName, (m.topics || []).join(' '), m.community.country.name,
    ALSO_CALLED[m.community.country.slug], m.university, m.course].filter(Boolean).join(' ').toLowerCase()
  return words.filter((w) => strong.includes(w)).length * 10 + (m.rating || 0)
}

// The mentors to show, best match first. `words` comes from typed().
export function search(mentors, words) {
  if (!words.length) return mentors
  return mentors
    .filter((m) => { const text = searchable(m); return words.every((w) => text.includes(w)) })
    .sort((a, b) => relevance(b, words) - relevance(a, words))
}
