// A check of the rules in search.js: node src/components/mentors/search.check.js
// Kept out of search.js so nothing in it reaches the browser bundle.
import assert from 'node:assert/strict'
import { search, typed } from './search.js'

const mentor = (id, name, slug, country, extra = {}) => ({
  id, rating: extra.rating ?? null, user: { displayName: name }, university: extra.university || 'Leeds',
  course: extra.course || 'MSc Marketing', headline: extra.headline || '', topics: extra.topics || [],
  languages: extra.languages || ['English'], community: { country: { slug, name: country } },
})
const priya = mentor(1, 'Priya Nair', 'uk', 'United Kingdom', { topics: ['student visas', 'SOPs'], rating: 4.9, languages: ['English', 'Hindi'] })
const rohan = mentor(2, 'Rohan Mehta', 'uk', 'United Kingdom', { university: 'Manchester', course: 'MSc Data Science', topics: ['part-time work'], rating: 4.1 })
const sneha = mentor(3, 'Sneha Kulkarni', 'canada', 'Canada', { university: 'Toronto', course: 'MEng', topics: ['study permits'], languages: ['English', 'Marathi'] })
const all = [priya, rohan, sneha]
const ids = (q) => search(all, typed(q)).map((m) => m.id)

assert.deepEqual(ids(''), [1, 2, 3])                 // nothing typed: everyone, in their own order
assert.deepEqual(ids('canada'), [3])                 // the country by name
assert.deepEqual(ids('uk'), [1, 2])                  // and by the slug people type
assert.deepEqual(ids('britain'), [1, 2])             // and by what they call it
assert.deepEqual(ids('marathi'), [3])                // a language
assert.deepEqual(ids('manchester'), [2])             // a university
assert.deepEqual(ids('data science'), [2])           // two words, both have to match
assert.deepEqual(ids('uk sop'), [1])                 // country and topic together narrow it
assert.deepEqual(ids('uk leeds manchester'), [])     // nobody is both
assert.deepEqual(ids('PRIYA'), [1])                  // case does not matter
assert.deepEqual(ids('uk,  visas'), [1])             // punctuation is not a word
assert.deepEqual(ids('united kingdom'), [1, 2])      // the best rated of an equal match first
console.log('mentor search: all checks passed')
