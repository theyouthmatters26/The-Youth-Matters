import { NavLink } from 'react-router-dom'
import { countries } from '../../data/sample'
import './feed.css'

// Sibling communities as photo pills, so switching country is one tap from any country page.
export default function Destinations() {
  return (
    <nav className="dest-tabs" aria-label="Study abroad destinations">
      {countries.map((c) => (
        <NavLink key={c.slug} to={`/c/${c.slug}`}>
          <img src={`/images/city-${c.slug}.jpg`} alt="" width="30" height="30" loading="lazy" />
          {c.name}
        </NavLink>
      ))}
    </nav>
  )
}
