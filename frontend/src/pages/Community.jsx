import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Check, ChevronRight, MessagesSquare, Plus } from 'lucide-react'
import Destinations from '../components/feed/Destinations'
import Composer from '../components/feed/Composer'
import PostList from '../components/feed/PostList'
import SideRail from '../components/home/SideRail'
import Avatar from '../components/ui/Avatar'
import SortTabs from '../components/ui/SortTabs'
import { categories, countryBySlug, users } from '../data/sample'
import { api, useApi } from '../lib/api'
import { formatCount } from '../lib/format'
import { useAuth, useMemberGuard } from '../lib/auth'
import NotFound from './NotFound'


// Faces of members heading here first, then other members, so every country shows real people
function membersFor(slug) {
  const withPhoto = Object.values(users).filter((u) => u.avatar && u.role !== 'mentor')
  return [...withPhoto.filter((u) => u.targetCountry === slug), ...withPhoto.filter((u) => u.targetCountry !== slug)].slice(0, 4)
}

// One community: Study Abroad -> {country}.
export default function Community() {
  const { slug } = useParams()
  const { user } = useAuth()
  const guard = useMemberGuard()
  const country = countryBySlug[slug]
  const mentors = useApi(country ? `/mentors?country=${slug}` : null)
  const community = useApi(country ? `/subjects/study-abroad/communities/${slug}` : null)
  const rooms = useApi('/chat/rooms')
  const [following, setFollowing] = useState(false)
  const [sort, setSort] = useState('hot')
  const [category, setCategory] = useState(null)
  const [fresh, setFresh] = useState([])

  useEffect(() => { setFollowing(Boolean(community.data?.following)) }, [community.data])
  useEffect(() => { setFresh([]); setCategory(null) }, [slug])

  if (!country) return <NotFound />

  const query = [`country=${slug}`, sort === 'unanswered' ? 'sort=new&unanswered=1' : `sort=${sort}`, category && `category=${category}`]
    .filter(Boolean).join('&')
  const room = rooms.data?.find((r) => r.slug === slug)
  const members = (community.data?.members ?? 0) + (following ? 1 : 0) - (community.data?.following ? 1 : 0)
  const faces = membersFor(slug)
  const join = async () => {
    if (!guard() || !community.data) return
    setFollowing(!following)
    try {
      await api(`/communities/${community.data.id}/follow`, { method: following ? 'DELETE' : 'POST' })
    } catch {
      setFollowing(following)
    }
  }

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
              <div><dt>{members === 1 ? 'member' : 'members'}</dt><dd>{formatCount(members)}</dd></div>
              {room?.activeToday > 0 && <div><dt>talking in the chatroom today</dt><dd>{room.activeToday}</dd></div>}
              {mentors.data && <div><dt>{mentors.data.length === 1 ? 'mentor' : 'mentors'} who studied here</dt><dd>{mentors.data.length}</dd></div>}
            </dl>
          </div>
          <div className="country-side">
            <div className="country-people">
              <span className="faces" aria-hidden>{faces.map((u) => <Avatar key={u.username} user={u} size={34} />)}</span>
              <span>{members > 2 ? `${faces[0].displayName.split(' ')[0]}, ${faces[1].displayName.split(' ')[0]} and ${formatCount(members - 2)} others are here` : 'Students heading here ask and answer every day'}</span>
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
          </div>
          <Composer country={slug} onPosted={(p) => setFresh([p, ...fresh])} />
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
          <PostList query={query} fresh={fresh.filter((p) => p.community.country.slug === slug)}
            gateTitle={`Read every discussion in ${country.name}`}
            gateText="Create a free account to read them all, ask your own question and join this community."
            empty={
              <div className="card empty">
                <h2 className="display">{sort === 'unanswered' ? 'Every question here has an answer' : category ? 'Nothing on this topic yet' : 'Be the first to ask'}</h2>
                <p className="muted">
                  {sort === 'unanswered'
                    ? 'Nice work, community. Check back later or ask something new.'
                    : `Ask anything about ${category ? `${categories.find((c) => c.slug === category)?.name.toLowerCase()} in ` : 'studying in '}${country.name}. Students who went usually answer within a few hours.`}
                </p>
              </div>
            } />
        </section>
        <SideRail country={slug} />
      </div>
    </div>
  )
}
