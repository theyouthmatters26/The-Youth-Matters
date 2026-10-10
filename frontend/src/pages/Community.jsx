import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Check, ChevronRight, MessagesSquare, Plus } from 'lucide-react'
import Destinations from '../components/feed/Destinations'
import Composer from '../components/feed/Composer'
import PostList from '../components/feed/PostList'
import SideRail from '../components/home/SideRail'
import SortTabs from '../components/ui/SortTabs'
import { Spinner } from '../components/auth/fields'
import { categories, countryBySlug } from '../data/sample'
import { api, useApi } from '../lib/api'
import { formatCount } from '../lib/format'
import { useAuth, useMemberGuard } from '../lib/auth'
import NotFound from './NotFound'
import Photo, { cityPhoto } from '../components/ui/Photo'
import { useMeta } from '../lib/meta'


// One community: Study Abroad -> {country}.
export default function Community() {
  const { slug } = useParams()
  const { user } = useAuth()
  const guard = useMemberGuard()
  // The site's own notes on the countries it launched with (the official visa page, the airport).
  // A country the team added later has none of that, so everything else comes from the API.
  const known = countryBySlug[slug]
  const mentors = useApi(`/mentors?country=${slug}`)
  const community = useApi(`/subjects/study-abroad/communities/${slug}`)
  const rooms = useApi('/chat/rooms')
  const topics = useApi('/categories').data || categories // the admin's topics; ours until they load
  const [following, setFollowing] = useState(false)
  const [joinError, setJoinError] = useState('')
  const [sort, setSort] = useState('hot')
  const [category, setCategory] = useState(null)
  const [fresh, setFresh] = useState([])

  const country = community.data
    ? { ...known, ...community.data.country, description: community.data.description || known?.description }
    : known
  useMeta({ title: country && `Study in ${country.name}`, description: country && `Questions, answers and a live chat room for students heading to ${country.name}. ${community.data?.description || country.description || ''}`, path: `/c/${slug}` })
  useEffect(() => { setFollowing(Boolean(community.data?.following)) }, [community.data])
  useEffect(() => { setFresh([]); setCategory(null); setJoinError('') }, [slug])

  // 404 from the API: no such country, or it has been hidden in the admin panel
  if (community.error?.status === 404) return <NotFound />
  if (!country) return <div className="container page post-loading"><Spinner /> Loading</div>

  const query = [`country=${slug}`, sort === 'unanswered' ? 'sort=new&unanswered=1' : `sort=${sort}`, category && `category=${category}`]
    .filter(Boolean).join('&')
  const room = rooms.data?.find((r) => r.slug === slug)
  const members = (community.data?.members ?? 0) + (following ? 1 : 0) - (community.data?.following ? 1 : 0)
  const join = async () => {
    if (!guard() || !community.data) return
    setFollowing(!following)
    setJoinError('')
    try {
      await api(`/communities/${community.data.id}/follow`, { method: following ? 'DELETE' : 'POST' })
    } catch (err) {
      setFollowing(following)
      setJoinError(err.message)
    }
  }

  return (
    <div className="container page">
      <p className="crumbs" aria-label="Where you are">
        <Link to="/community">Study Abroad</Link> <ChevronRight size={14} /> <span>{country.name}</span>
      </p>
      <Destinations />

      <header className="country-hero">
        <Photo src={cityPhoto(country)} sizes="100vw" priority />
        <div className="country-hero-body">
          <div className="country-intro">
            <p className="country-eyebrow">Study Abroad community</p>
            <h1>{country.name}</h1>
            <p className="country-lede">{community.data?.description || country.description}</p>
            <dl className="country-stats">
              <div><dt>{members === 1 ? 'member' : 'members'}</dt><dd>{formatCount(members)}</dd></div>
              {room?.activeToday > 0 && <div><dt>talking in the chatroom today</dt><dd>{room.activeToday}</dd></div>}
              {mentors.data && <div><dt>{mentors.data.length === 1 ? 'mentor' : 'mentors'} who studied here</dt><dd>{mentors.data.length}</dd></div>}
            </dl>
          </div>
          <div className="country-side">
            <div className="country-people">
              {joinError ? <span role="alert">{joinError}</span> : <span>Students heading here ask and answer every day</span>}
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
              {topics.map((c) => (
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
                    : `Ask anything about ${category ? `${topics.find((c) => c.slug === category)?.name.toLowerCase()} in ` : 'studying in '}${country.name}. Students who went usually answer within a few hours.`}
                </p>
              </div>
            } />
        </section>
        <SideRail country={slug} />
      </div>
    </div>
  )
}
