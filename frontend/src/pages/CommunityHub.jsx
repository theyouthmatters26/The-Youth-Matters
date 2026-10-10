import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight, Bot, Check, MessagesSquare, PenLine, Plus } from 'lucide-react'
import Composer from '../components/feed/Composer'
import PostList from '../components/feed/PostList'
import RoomCard from '../components/feed/RoomCard'
import SortTabs from '../components/ui/SortTabs'
import { subjects } from '../data/sample'
import { api, useApi } from '../lib/api'
import { useAuth, useMemberGuard } from '../lib/auth'
import { plural } from '../lib/format'
import { useMeta } from '../lib/meta'
import Photo, { cityPhoto } from '../components/ui/Photo'
import '../components/feed/feed.css'

// One country community in the strip: tap to open it, join without leaving the page.
function CommunityTile({ c }) {
  const guard = useMemberGuard()
  const [following, setFollowing] = useState(c.following)
  const [members, setMembers] = useState(c.members)
  useEffect(() => { setFollowing(c.following); setMembers(c.members) }, [c])

  const toggle = async () => {
    if (!guard()) return
    const next = !following
    setFollowing(next)
    setMembers((m) => m + (next ? 1 : -1))
    try {
      await api(`/communities/${c.id}/follow`, { method: next ? 'POST' : 'DELETE' })
    } catch {
      setFollowing(!next)
      setMembers((m) => m + (next ? -1 : 1))
    }
  }

  return (
    <li className="hub-tile">
      <Link to={`/c/${c.country.slug}`} className="hub-tile-link">
        <Photo src={cityPhoto(c.country)} sizes="(max-width: 640px) 46vw, 300px" />
        <span className="hub-tile-text">
          <strong>{c.country.name}</strong>
          <span>{plural(c.questions, 'question')} · {plural(members, 'member')}</span>
        </span>
      </Link>
      <button className={`hub-join${following ? ' is-on' : ''}`} aria-pressed={following} onClick={toggle}
        aria-label={following ? `Leave ${c.country.name}` : `Join ${c.country.name}`}>
        {following ? <><Check size={13} /> Joined</> : <><Plus size={13} /> Join</>}
      </button>
    </li>
  )
}

// Community ChatRoom: every country's questions in one feed, live rooms on the side.
export default function CommunityHub() {
  const { user } = useAuth()
  useMeta({ title: 'Community ChatRoom', description: 'Ask questions, answer others and chat live with students heading to the UK, US, Canada, Australia, Ireland and Germany.', path: '/community' })
  const communities = useApi('/subjects/study-abroad/communities')
  const rooms = useApi('/chat/rooms')
  const [sort, setSort] = useState('hot')
  const [fresh, setFresh] = useState([])
  const soon = subjects.filter((s) => !s.isActive)
  const query = sort === 'unanswered' ? 'sort=new&unanswered=1' : `sort=${sort}`

  return (
    <div className="container page hub">
      <header className="dash-head">
        <div>
          <p className="eyebrow">Study Abroad</p>
          <h1>Community ChatRoom</h1>
          <p className="muted">Ask anything, answer what you know, and talk live with students heading where you are.</p>
        </div>
        <Link to="/ask" className="btn btn-primary"><PenLine size={15} /> Ask a question</Link>
      </header>

      <ul className="hub-strip" aria-label="Country communities">
        {communities.data ? communities.data.map((c) => <CommunityTile key={c.id} c={c} />)
          : communities.error ? <li className="muted">We could not load the communities just now. Reload the page to try again.</li>
            : Array.from({ length: 6 }, (_, i) => <li key={i} className="hub-tile is-loading" aria-hidden />)}
      </ul>

      <div className="layout-2 dash-grid hub-grid">
        <section aria-labelledby="feed-title">
          {user && <Composer onPosted={(post) => setFresh([post, ...fresh])} />}
          <div className="feed-head">
            <h2 id="feed-title" className="col-title dash-feed-title">Latest from every country</h2>
            <SortTabs value={sort} onChange={setSort} />
          </div>
          <PostList query={query} fresh={fresh} gateText="Free members can read, ask and answer in every community."
            empty={<div className="card empty"><h2 className="display">Nothing here yet</h2><p className="muted">Every question has an answer. Try another tab.</p></div>} />
        </section>

        <aside className="stack sticky dash-rail hub-rail">
          <div className="card card-pad">
            <h3 className="section-title"><MessagesSquare size={16} aria-hidden /> Live chat rooms</h3>
            <div className="room-list">
              {(rooms.data || []).map((r) => <RoomCard key={r.slug} room={r} />)}
              {rooms.loading && <p className="muted dash-small">Loading rooms...</p>}
            </div>
            {!user && <Link to="/register" className="btn btn-ghost btn-sm btn-block hub-rail-cta">Sign up free to chat</Link>}
          </div>

          <Link to="/ai" className="card card-pad hub-ai">
            <Bot size={20} aria-hidden />
            <span><strong>Ask TYM AI</strong><span>Private answers on SOPs, visas and shortlists, any time.</span></span>
            <ArrowUpRight size={16} aria-hidden />
          </Link>

          <div className="card card-pad hub-soon">
            <h3 className="section-title">More subjects soon</h3>
            <p className="muted dash-small">{soon.map((s) => s.name).join(', ')}. Same community, new topics.</p>
          </div>
        </aside>
      </div>
    </div>
  )
}
