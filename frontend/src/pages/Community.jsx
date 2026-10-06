import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Check, ChevronRight, MessagesSquare, PenLine, Plus } from 'lucide-react'
import Destinations from '../components/feed/Destinations'
import PostCard from '../components/feed/PostCard'
import SideRail from '../components/home/SideRail'
import Avatar from '../components/ui/Avatar'
import Gate from '../components/ui/Gate'
import SortTabs from '../components/ui/SortTabs'
import { categories, countryBySlug, posts, rooms, users } from '../data/sample'
import { useApi } from '../lib/api'
import { formatCount } from '../lib/format'
import { useAuth } from '../lib/auth'
import NotFound from './NotFound'

const PREVIEW = 2

// Faces of members heading here first, then other members, so every country shows real people
function membersFor(slug) {
  const withPhoto = Object.values(users).filter((u) => u.avatar && u.role !== 'mentor')
  return [...withPhoto.filter((u) => u.targetCountry === slug), ...withPhoto.filter((u) => u.targetCountry !== slug)].slice(0, 4)
}

// One community: Study Abroad -> {country}.
export default function Community() {
  const { slug } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const country = countryBySlug[slug]
  const mentors = useApi(country ? `/mentors?country=${slug}` : null)
  const [following, setFollowing] = useState(false)
  const [sort, setSort] = useState('hot')
  const [category, setCategory] = useState(null)

  if (!country) return <NotFound />

  const list = posts
    .filter((p) => p.country === slug && (!category || p.category === category))
    .sort(sort === 'new' ? (a, b) => new Date(b.createdAt) - new Date(a.createdAt) : (a, b) => b.score - a.score)
  const room = rooms.find((r) => r.slug === slug)
  const faces = membersFor(slug)
  const join = () => (user ? setFollowing(!following) : navigate('/register', { state: { from: `/c/${slug}` } }))

  return (
    <div className="container page">
      <p className="crumbs" aria-label="Where you are">
        <Link to="/community">Study Abroad</Link> <ChevronRight size={14} /> <span>{country.name}</span>
      </p>
      <Destinations />

      <header className="country-hero">
        <img src={`/images/city-${slug}.jpg`} alt="" width="1200" height="800" />
        <div className="country-hero-body">
          <div className="country-intro">
            <p className="country-eyebrow">Study Abroad community</p>
            <h1>{country.name}</h1>
            <p className="country-lede">{country.description}</p>
            <dl className="country-stats">
              <div><dt>members</dt><dd>{formatCount(country.members)}</dd></div>
              {room && <div><dt>in the chatroom now</dt><dd>{room.online}</dd></div>}
              {mentors.data && <div><dt>{mentors.data.length === 1 ? 'mentor' : 'mentors'} who studied here</dt><dd>{mentors.data.length}</dd></div>}
            </dl>
          </div>
          <div className="country-side">
            <div className="country-people">
              <span className="faces" aria-hidden>{faces.map((u) => <Avatar key={u.username} user={u} size={34} />)}</span>
              <span>{faces[0].displayName.split(' ')[0]}, {faces[1].displayName.split(' ')[0]} and {formatCount(country.members - 2)} others</span>
            </div>
            <div className="country-actions">
              <button className={`btn ${following ? 'btn-glass' : 'btn-light'}`} aria-pressed={following} onClick={join}>
                {following ? <><Check size={16} /> Joined</> : <><Plus size={16} /> Join community</>}
              </button>
              <Link to={`/chat/${room ? slug : 'study-abroad'}`} className="btn btn-glass"><MessagesSquare size={16} /> Open chatroom</Link>
            </div>
          </div>
        </div>
      </header>

      <div className="layout-2 country-layout">
        <section aria-labelledby="discussions-title">
          <div className="country-feed-top">
            <h2 id="discussions-title" className="display">Discussions</h2>
            <Link to="/ask" state={{ country: slug }} className="btn btn-primary btn-sm"><PenLine size={15} /> Ask a question</Link>
          </div>
          <div className="feed-head">
            <div className="chip-row" role="group" aria-label="Filter by topic">
              <button className={`chip ${!category ? 'is-on' : ''}`} aria-pressed={!category} onClick={() => setCategory(null)}>All topics</button>
              {categories.map((c) => (
                <button key={c.slug} className={`chip ${category === c.slug ? 'is-on' : ''}`} aria-pressed={category === c.slug}
                  onClick={() => setCategory(c.slug)}>{c.name}</button>
              ))}
            </div>
            <SortTabs value={sort} onChange={setSort} />
          </div>
          {list.length ? (
            <>
              <div className="feed-list">{(user ? list : list.slice(0, PREVIEW)).map((p) => <PostCard key={p.id} post={p} />)}</div>
              {!user && list.length > PREVIEW && (
                <Gate title={`${list.length - PREVIEW} more ${list.length - PREVIEW === 1 ? 'discussion' : 'discussions'} in ${country.name}`}
                  text="Create a free account to read them all, ask your own question and join this community.">
                  <div className="feed-list">{list.slice(PREVIEW, PREVIEW + 2).map((p) => <PostCard key={p.id} post={p} />)}</div>
                </Gate>
              )}
            </>
          ) : (
            <div className="card empty">
              <h2 className="display">{category ? 'Nothing on this topic yet' : 'Be the first to ask'}</h2>
              <p className="muted">
                {category
                  ? `No one has asked about ${categories.find((c) => c.slug === category)?.name.toLowerCase()} in ${country.name} yet. Students who went usually answer within a few hours.`
                  : `Ask anything about studying in ${country.name}. Students who went usually answer within a few hours.`}
              </p>
              <Link to="/ask" state={{ country: slug }} className="btn btn-primary btn-sm">Ask a question</Link>
            </div>
          )}
        </section>
        <SideRail country={slug} />
      </div>
    </div>
  )
}
