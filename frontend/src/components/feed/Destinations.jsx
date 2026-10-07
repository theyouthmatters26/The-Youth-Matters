import { NavLink } from 'react-router-dom'
import { countries } from '../../data/sample'
import Photo from '../ui/Photo'
import './feed.css'

// Sibling communities as photo pills, so switching country is one tap from any country page.
export default function Destinations() {
  return (
    <nav className="dest-tabs" aria-label="Study abroad destinations">
      {countries.map((c) => (
        <NavLink key={c.slug} to={`/c/${c.slug}`}>
          <Photo src={`/images/city-${c.slug}.jpg`} width="30" height="30" sizes="30px" />
          {c.name}
        </NavLink>
      ))}
    </nav>
  )
}
