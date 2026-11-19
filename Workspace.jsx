import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Button, Card, Chip, ProgressBar } from '../../components/ui'
import { useIdeas } from '../../hooks/useIdeas'
import { useProgress } from '../../hooks/useProgress'
import { isDead, updateIdea } from '../../services/ideaStore'
import { suggestIdea } from '../../services/ai'
import './Workspace.css'

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'completed', label: 'Completed' },
  { key: 'dead', label: 'Dead' },
]

const statusOf = (i) => (i.status === 'completed' ? 'completed' : isDead(i) ? 'dead' : 'active')
const COLORS = { active: 'var(--active)', completed: 'var(--completed)', dead: 'var(--dead)' }
const LABELS = { active: 'Active', completed: 'Completed', dead: 'Dead' }

function visited(iso) {
  const days = Math.floor((Date.now() - new Date(iso)) / 86400000)
  return days <= 0 ? 'Visited today' : days === 1 ? 'Visited yesterday' : `Visited ${days} days ago`
}

function IdeaCard({ idea, onOpen }) {
  const { done, total, percent } = useProgress(idea.aiPlan?.todos)
  const status = statusOf(idea)
  return (
    <button className="card idea-card" onClick={() => onOpen(idea.id)}>
      <span className="idea-card-top">
        <span className="idea-card-title">{idea.title || idea.text}</span>
        <span className="idea-tag" style={{ background: COLORS[status] }}>{LABELS[status]}</span>
      </span>
      {total > 0 && <><ProgressBar percent={percent} /><span className="idea-meta">{percent}% · {done} of {total} done</span></>}
      <span className="idea-meta">{visited(idea.lastVisitedAt)}</span>
    </button>
  )
}

export default function Workspace() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const filter = FILTERS.some((f) => f.key === params.get('filter')) ? params.get('filter') : 'all'
  const { ideas, loading, error } = useIdeas()

  const [suggestion, setSuggestion] = useState(null)
  const [suggesting, setSuggesting] = useState(false)
  const [suggestError, setSuggestError] = useState(false)
  const [showTop3, setShowTop3] = useState(false)
  const [actionError, setActionError] = useState('')

  const loadSuggestion = () => {
    setSuggesting(true)
    setSuggestError(false)
    suggestIdea(ideas)
      .then(setSuggestion)
      .catch(() => setSuggestError(true))
      .finally(() => setSuggesting(false))
  }
  useEffect(() => { if (!loading && ideas.length) loadSuggestion() }, [loading]) // eslint-disable-line react-hooks/exhaustive-deps

  // C4: choose an idea to work on
  const workOn = async (id) => {
    setActionError('')
    try {
      await updateIdea(id, { status: 'active', lastVisitedAt: new Date().toISOString() })
      navigate(`/workspace/${id}`)
    } catch {
      setActionError("Couldn't open that idea. Try again.")
    }
  }

  const byId = (id) => ideas.find((i) => i.id === id)
  const visible = ideas.filter((i) => filter === 'all' || statusOf(i) === filter)
  const pick = suggestion?.pickId ? byId(suggestion.pickId) : null

  return (
    <main className="page workspace">
      <header className="ws-top">
        <h1 className="ws-title">{filter === 'all' ? 'Your ideas' : `${LABELS[filter]} ideas (${visible.length})`}</h1>
      </header>

      {error && <p className="ws-error" role="alert">Couldn't load your ideas. Refresh to try again.</p>}
      {actionError && <p className="ws-error" role="alert">{actionError}</p>}

      {!loading && ideas.length > 0 && (
        <Card className="ws-suggest">
          <h2>AI suggests</h2>
          {suggesting && <p className="ws-reason">Looking through your ideas…</p>}
          {suggestError && <p className="ws-reason">Couldn't get a suggestion right now. Your ideas below still work.</p>}
          {!suggesting && !suggestError && !pick && <p className="ws-reason">Nothing open to suggest. Enter a new idea to get started.</p>}
          {!suggesting && pick && (
            <>
              <p className="ws-pick">{pick.title || pick.text}</p>
              <p className="ws-reason">{suggestion.reason}</p>
              <div className="ws-suggest-actions">
                <Button onClick={() => workOn(pick.id)}>Work on this</Button>
                <Button variant="outline" onClick={() => setShowTop3((s) => !s)}>{showTop3 ? 'Hide top 3' : 'See top 3'}</Button>
              </div>
              {showTop3 && (
                <ul className="ws-top3">
                  {suggestion.ranking.map((r) => byId(r.id) && (
                    <li key={r.id}><button onClick={() => workOn(r.id)}>{byId(r.id).title || byId(r.id).text}<small>{r.reason}</small></button></li>
                  ))}
                </ul>
              )}
            </>
          )}
          {!suggesting && <button className="ws-link" onClick={loadSuggestion}>Suggest again</button>}
        </Card>
      )}

      <div className="ws-filters" role="group" aria-label="Filter ideas">
        {FILTERS.map((f) => (
          <Chip key={f.key} active={filter === f.key} onClick={() => setParams(f.key === 'all' ? {} : { filter: f.key })}>{f.label}</Chip>
        ))}
      </div>

      {loading && <p className="ws-reason">Loading your ideas…</p>}

      {!loading && !error && ideas.length === 0 && (
        <div className="ws-empty">
          <span>No ideas yet. Your first one is a minute away.</span>
          <Button onClick={() => navigate('/enter')}>Enter idea</Button>
        </div>
      )}

      {!loading && ideas.length > 0 && visible.length === 0 && <div className="ws-empty">No {filter} ideas right now.</div>}

      <div className="ws-list">
        {visible.map((idea) => <IdeaCard key={idea.id} idea={idea} onOpen={(id) => navigate(`/workspace/${id}`)} />)}
      </div>
    </main>
  )
}