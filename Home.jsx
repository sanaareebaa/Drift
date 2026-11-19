import { useNavigate } from 'react-router-dom'
import { Button, Circle } from '../../components/ui'
import { useAuth } from '../../context/AuthContext'
import { useGreeting } from '../../hooks/useGreeting'
import { useIdeas } from '../../hooks/useIdeas'
import { isDead } from '../../services/ideaStore'
import './Home.css'

const STATUSES = [
  { key: 'active', label: 'Active', color: 'var(--active)' },
  { key: 'completed', label: 'Completed', color: 'var(--completed)' },
  { key: 'dead', label: 'Dead', color: 'var(--dead)' },
]
const statusOf = (i) => (i.status === 'completed' ? 'completed' : isDead(i) ? 'dead' : 'active')
const LABELS = { active: 'Active', completed: 'Completed', dead: 'Dead' }
const COLORS = { active: 'var(--active)', completed: 'var(--completed)', dead: 'var(--dead)' }

export default function Home() {
  const navigate = useNavigate()
  const greeting = useGreeting()
  const { user } = useAuth()
  const name = user?.firstName || 'friend'
  const day = new Date().toLocaleDateString(undefined, { weekday: 'long' })
  const { ideas, loading, error } = useIdeas()

  const counts = { active: 0, completed: 0, dead: 0 }
  ideas.forEach((i) => { counts[statusOf(i)] += 1 })
  const recent = [...ideas].sort((a, b) => new Date(b.lastVisitedAt) - new Date(a.lastVisitedAt)).slice(0, 4)
  const isEmpty = !loading && !error && ideas.length === 0

  // "Still up?" reads best with the name inside the question
  const title = greeting.endsWith('?') ? `${greeting.slice(0, -1)}, ${name}?` : `${greeting}, ${name}`

  return (
    <main className="page home">
      <header className="home-head">
        <span className="home-day">{day}</span>
        <h1 className="home-title">{title}</h1>
      </header>

      <section className="status-row" aria-label="Idea status">
        {STATUSES.map(({ key, label, color }) => (
          <button
            key={key}
            className="status-card"
            onClick={() => navigate(`/workspace?filter=${key}`)}
            aria-label={`${loading ? 0 : counts[key]} ${label.toLowerCase()} ideas`}
          >
            <Circle size={44} color={color}>{loading ? '–' : counts[key]}</Circle>
            <span className="status-label">{label}</span>
            <span className="status-chev" aria-hidden="true">›</span>
          </button>
        ))}
      </section>

      {error && <p className="home-note" role="alert">Couldn't load your ideas. Refresh to try again.</p>}

      <section className="home-recent" aria-label="Recent ideas">
        <div className="home-recent-head">
          <h2>Recent ideas</h2>
          {ideas.length > 0 && <button className="home-link" onClick={() => navigate('/workspace')}>View all →</button>}
        </div>

        {isEmpty && <p className="home-note">No ideas yet. Enter your first one to get started.</p>}

        <div className="recent-grid">
          {recent.map((idea) => {
            const status = statusOf(idea)
            const blurb = idea.aiPlan?.summary || (idea.title ? idea.text : '')
            return (
              <button key={idea.id} className="recent-card" onClick={() => navigate(`/workspace/${idea.id}`)}>
                <span className="recent-title">{idea.title || idea.text}</span>
                {blurb && <span className="recent-blurb">{blurb}</span>}
                <span className="recent-tag" style={{ background: COLORS[status] }}>{LABELS[status]}</span>
              </button>
            )
          })}
        </div>
      </section>

      <nav className="home-actions">
        <Button onClick={() => navigate('/enter')}>+ Enter idea</Button>
        <Button variant="outline" onClick={() => navigate('/workspace')}>View ideas</Button>
      </nav>

    </main>
  )
}