import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button, Card, Checkbox, Input, ProgressBar } from '../../components/ui'
import { useProgress } from '../../hooks/useProgress'
import { getIdea, updateIdea, deleteIdea, isDead } from '../../services/ideaStore'
import { makePlan } from '../../services/ai'
import { getImageUrls, deleteImages } from '../../services/storage'
import './IdeaDetail.css'

// ISO time -> the "2026-10-04T11:50" format a datetime-local field needs (in the viewer's timezone)
const toLocalInput = (iso) => {
  if (!iso) return ''
  const d = new Date(iso)
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}

const OFFSETS = [
  { value: '0', label: 'On the day' },
  { value: '1', label: '1 day before' },
  { value: '3', label: '3 days before' },
  { value: '7', label: '1 week before' },
]
// Target date + time of day, moved back by N days (all in the viewer's own timezone)
function reminderTime(targetDate, time, offsetDays) {
  const d = new Date(`${targetDate}T${time || '09:00'}:00`)
  d.setDate(d.getDate() - Number(offsetDays))
  return d
}
const timeOfDay = (iso) => (iso ? toLocalInput(iso).slice(11) : '09:00')
const prettyWhen = (d) => d.toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })

export default function IdeaDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [idea, setIdea] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [newTodo, setNewTodo] = useState('')
  const [generating, setGenerating] = useState(false)
  const [imageNote, setImageNote] = useState('')
  const [pending, setPending] = useState(null) // AI plan waiting for the user's choice
  const [rem, setRem] = useState({ mode: 'none', at: '', time: '09:00', channel: 'notification' })
  const [remMsg, setRemMsg] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    getIdea(id)
      .then((found) => {
        setIdea(found)
        if (found) updateIdea(id, { lastVisitedAt: new Date().toISOString() })
      })
      .catch(() => setError("Couldn't load this idea. Go back and try again."))
      .finally(() => setLoading(false))
  }, [id])

  const plan = idea?.aiPlan || { summary: '', todos: [] }
  const { done, total, percent } = useProgress(plan.todos)

  // Images are private, so we ask for short-lived signed links
  const [images, setImages] = useState([])
  const [imagesFailed, setImagesFailed] = useState(false)
  const imageKey = (idea?.imagePaths || []).join('|')
  useEffect(() => {
    let cancelled = false
    setImagesFailed(false)
    getImageUrls(idea?.imagePaths || [])
      .then((list) => { if (!cancelled) setImages(list) })
      .catch(() => { if (!cancelled) { setImages([]); setImagesFailed(true) } })
    return () => { cancelled = true }
  }, [imageKey]) // eslint-disable-line react-hooks/exhaustive-deps

  // Keep the reminder form in step with the saved idea
  useEffect(() => {
    setRem({
      mode: !idea?.reminderAt ? 'none' : idea.reminderOffsetDays != null ? String(idea.reminderOffsetDays) : 'custom',
      at: toLocalInput(idea?.reminderAt),
      time: timeOfDay(idea?.reminderAt),
      channel: idea?.reminderChannel || 'notification',
    })
  }, [idea?.reminderAt, idea?.reminderChannel, idea?.reminderOffsetDays])

  // Every change saves immediately and counts as a visit. Returns true when it saved.
  const save = async (changes) => {
    setIdea((prev) => ({ ...prev, ...changes }))
    setError('')
    try {
      await updateIdea(id, { ...changes, lastVisitedAt: new Date().toISOString() })
      return true
    } catch {
      setError("Couldn't save that change. Check your connection and try again.")
      return false
    }
  }
  const saveTodos = (todos) => save({ aiPlan: { ...plan, todos } })

  const toggle = (tid) => saveTodos(plan.todos.map((t) => (t.id === tid ? { ...t, done: !t.done } : t)))
  const remove = (tid) => saveTodos(plan.todos.filter((t) => t.id !== tid))
  const rename = (tid, text) => {
    const clean = text.trim()
    if (!clean) return remove(tid)
    saveTodos(plan.todos.map((t) => (t.id === tid ? { ...t, text: clean } : t)))
  }
  const add = () => {
    const clean = newTodo.trim()
    if (!clean) return
    saveTodos([...plan.todos, { id: `t${Date.now()}`, text: clean, done: false }])
    setNewTodo('')
  }

  // D5: AI plan generation. Existing steps are never overwritten without asking.
  // The AI title only fills an empty title, so it never overwrites one you wrote
  const newTitle = (r) => (idea.title || !r.title ? {} : { title: r.title })
  const generate = async () => {
    setGenerating(true)
    setError('')
    try {
      const result = await makePlan(idea)
      const stored = (idea.imagePaths || []).filter((p) => !/^(blob:|https?:)/.test(p)).length
      if (stored === 0) setImageNote('')
      else if (result.imagesUsed == null) setImageNote("The AI function didn't report on images. Redeploy make-plan to enable image reading.")
      else if (result.imagesUsed > 0) setImageNote(`The AI looked at ${result.imagesUsed} image${result.imagesUsed > 1 ? 's' : ''}.`)
      else setImageNote("The AI couldn't read this idea's images, so the plan uses the text only.")
      if (plan.todos.length === 0) save({ ...newTitle(result), aiPlan: { summary: result.summary || plan.summary, todos: result.todos } })
      else setPending(result)
    } catch {
      setError("Couldn't generate a plan right now. Your steps are unchanged. Try again in a moment.")
    } finally {
      setGenerating(false)
    }
  }
  const applyPending = (mode) => {
    if (mode === 'replace') save({ ...newTitle(pending), aiPlan: { summary: pending.summary || plan.summary, todos: pending.todos } })
    if (mode === 'add') save({ ...newTitle(pending), aiPlan: { ...plan, todos: [...plan.todos, ...pending.todos] } })
    setPending(null)
  }

  // Reminder: saving re-arms it, so one that already went off can be set again.
  // "N days before" is worked out from the target date and remembered, so it follows the date if you move it.
  const clearReminder = async () => {
    setRemMsg('')
    const ok = await save({ reminderAt: null, reminderChannel: null, reminderOffsetDays: null, reminderSent: false })
    if (ok) { setRem({ mode: 'none', at: '', time: '09:00', channel: 'notification' }); setRemMsg('Reminder removed.') }
  }
  const saveReminder = async () => {
    setRemMsg('')
    if (rem.mode === 'none') {
      if (!idea.reminderAt) return setRemMsg('Choose when you want to be reminded.')
      return clearReminder()
    }
    let when
    let offset = null
    if (rem.mode === 'custom') {
      if (!rem.at) return setRemMsg('Pick a date and time first.')
      when = new Date(rem.at)
    } else {
      if (!idea.targetDate) return setRemMsg('Set a target date first.')
      offset = Number(rem.mode)
      when = reminderTime(idea.targetDate, rem.time, offset)
    }
    if (when <= new Date()) {
      return setRemMsg(rem.mode === 'custom' ? 'Pick a time in the future.' : 'That time has already passed. Try a shorter lead time or a later target date.')
    }
    const ok = await save({ reminderAt: when.toISOString(), reminderChannel: rem.channel, reminderOffsetDays: offset, reminderSent: false })
    if (ok) setRemMsg(`Reminder set for ${prettyWhen(when)}.`)
  }
  // Moving the target date moves a "N days before" reminder with it
  const changeTargetDate = async (value) => {
    const targetDate = value || null
    const offset = idea.reminderOffsetDays
    if (offset == null || !idea.reminderAt) return save({ targetDate })
    if (!targetDate) {
      setRemMsg('Target date removed, so your reminder is now a fixed time.')
      return save({ targetDate, reminderOffsetDays: null })
    }
    const when = reminderTime(targetDate, timeOfDay(idea.reminderAt), offset)
    if (when <= new Date()) {
      setRemMsg('Reminder removed: the new target date is too close for that lead time. Set another reminder.')
      return save({ targetDate, reminderAt: null, reminderChannel: null, reminderOffsetDays: null, reminderSent: false })
    }
    setRemMsg(`Reminder moved to ${prettyWhen(when)}.`)
    return save({ targetDate, reminderAt: when.toISOString(), reminderSent: false })
  }

  // Delete: the idea goes first, then its images (best effort, so a storage hiccup can't block the delete)
  const removeIdea = async () => {
    setDeleting(true)
    setError('')
    try {
      await deleteIdea(id)
    } catch {
      setError("Couldn't delete this idea. Check your connection and try again.")
      setDeleting(false)
      setConfirmDelete(false)
      return
    }
    deleteImages(idea.imagePaths || []).catch(() => {})
    navigate('/workspace', { replace: true })
  }

  if (loading) return <main className="page"><p>Loading…</p></main>
  if (!idea) {
    return (
      <main className="page">
        <p className="detail-error">{error || "We couldn't find that idea."}</p>
        <Button variant="outline" onClick={() => navigate('/workspace')}>Back to ideas</Button>
      </main>
    )
  }

  const completed = idea.status === 'completed'
  const statusLabel = completed ? 'Completed' : isDead(idea) ? 'Dead' : 'Active'
  const statusColor = completed ? 'var(--completed)' : isDead(idea) ? 'var(--dead)' : 'var(--active)'
  const relWhen = rem.mode !== 'none' && rem.mode !== 'custom' && idea.targetDate ? reminderTime(idea.targetDate, rem.time, rem.mode) : null

  return (
    <main className="page detail">
      <header className="detail-top">
        <button className="detail-back" onClick={() => navigate('/workspace')} aria-label="Back to ideas">←</button>
        <span className="detail-status" style={{ background: statusColor }}>{statusLabel}</span>
      </header>

      <textarea
        className="detail-title"
        rows={2}
        key={idea.title}
        defaultValue={idea.title || idea.text}
        aria-label="Idea title"
        onBlur={(e) => e.target.value.trim() && e.target.value !== (idea.title || idea.text) && save({ title: e.target.value.trim() })}
      />

      {images.length > 0 && (
        <section className="detail-images" aria-label="Attached images">
          {images.map((img, i) => (
            <a key={img.path} href={img.url} target="_blank" rel="noreferrer" aria-label={`Open image ${i + 1} full size`}>
              <img src={img.url} alt={`Attachment ${i + 1}`} loading="lazy" />
            </a>
          ))}
        </section>
      )}
      {imagesFailed && <p className="detail-error" role="alert">Couldn't load the images. Refresh to try again.</p>}

      <Card className="detail-field">
        <label htmlFor="notes">Your notes</label>
        <textarea id="notes" className="input" rows={4} defaultValue={idea.text}
          onBlur={(e) => e.target.value.trim() && e.target.value !== idea.text && save({ text: e.target.value.trim() })} />
      </Card>

      <Card className="detail-field">
        <label htmlFor="summary">Summary</label>
        <Input id="summary" defaultValue={plan.summary || ''} key={plan.summary} placeholder="A short description of the idea"
          onBlur={(e) => e.target.value !== (plan.summary || '') && save({ aiPlan: { ...plan, summary: e.target.value.trim() } })} />
        <label htmlFor="goal">Goal: what does done look like?</label>
        <Input id="goal" defaultValue={idea.goal || ''} placeholder="Describe the finished result"
          onBlur={(e) => e.target.value !== (idea.goal || '') && save({ goal: e.target.value.trim() })} />
        <label htmlFor="target">Target date (optional)</label>
        <Input id="target" type="date" value={idea.targetDate || ''} onChange={(e) => changeTargetDate(e.target.value)} />
      </Card>

      <Card className="detail-field">
        <label htmlFor="remind-mode">Remind me</label>
        <select id="remind-mode" className="input" value={rem.mode}
          onChange={(e) => { setRem({ ...rem, mode: e.target.value }); setRemMsg('') }}>
          <option value="none">No reminder</option>
          <optgroup label={idea.targetDate ? 'Before the target date' : 'Before the target date (set one first)'}>
            {OFFSETS.map((o) => <option key={o.value} value={o.value} disabled={!idea.targetDate}>{o.label}</option>)}
          </optgroup>
          <option value="custom">At a specific time</option>
        </select>

        {rem.mode === 'custom' && (
          <Input type="datetime-local" aria-label="Reminder date and time" min={toLocalInput(new Date().toISOString())} value={rem.at}
            onChange={(e) => { setRem({ ...rem, at: e.target.value }); setRemMsg('') }} />
        )}
        {relWhen && (
          <>
            <label htmlFor="remind-time">At what time</label>
            <Input id="remind-time" type="time" value={rem.time} onChange={(e) => { setRem({ ...rem, time: e.target.value || '09:00' }); setRemMsg('') }} />
            <small className="detail-hint">{prettyWhen(relWhen)}{relWhen <= new Date() ? ' (already passed)' : ''}</small>
          </>
        )}

        {rem.mode !== 'none' && (
          <div className="detail-radios" role="radiogroup" aria-label="Reminder channel">
            {['notification', 'email'].map((c) => (
              <label key={c}>
                <input type="radio" name="remind-channel" value={c} checked={rem.channel === c}
                  onChange={() => { setRem({ ...rem, channel: c }); setRemMsg('') }} />
                {c === 'notification' ? 'Notification' : 'Email'}
              </label>
            ))}
          </div>
        )}
        {idea.reminderAt && idea.reminderSent && (
          <small className="detail-hint">This reminder has already gone off. Save a new time to be reminded again.</small>
        )}
        <div className="detail-row-buttons">
          <Button onClick={saveReminder}>Save reminder</Button>
          {idea.reminderAt && <Button variant="outline" onClick={clearReminder}>Remove</Button>}
        </div>
        {remMsg && <small className="detail-hint" role="status">{remMsg}</small>}
      </Card>

      <section className="detail-progress" aria-label="Progress">
        <div className="detail-progress-row"><b>Progress</b><span>{total ? `${percent}% · ${done} of ${total} done` : 'No steps yet'}</span></div>
        <ProgressBar percent={percent} />
      </section>

      {total > 0 && percent === 100 && !completed && (
        <div className="detail-banner" role="status">
          All steps are done. Mark this idea as completed?
          <Button onClick={() => save({ status: 'completed' })}>Mark as completed</Button>
        </div>
      )}

      {pending && (
        <div className="detail-banner" role="status">
          The AI wrote {pending.todos.length} steps. What should happen to them?
          <Button onClick={() => applyPending('add')}>Add to my steps</Button>
          <Button variant="outline" onClick={() => applyPending('replace')}>Replace my steps</Button>
          <Button variant="outline" onClick={() => setPending(null)}>Discard</Button>
        </div>
      )}
      <Button variant={plan.todos.length ? 'outline' : 'filled'} onClick={generate} disabled={generating || !!pending}>
        {generating ? 'Writing your plan…' : plan.todos.length ? 'Regenerate with AI' : 'Generate plan with AI'}
      </Button>
      {imageNote && <p className="detail-note" role="status">{imageNote}</p>}

      <Card>
        <div className="todo-list">
          {plan.todos.length === 0 && <p style={{ margin: 0, color: 'var(--muted)', fontSize: 14 }}>Add your first step below.</p>}
          {plan.todos.map((t) => (
            <div className={`todo ${t.done ? 'done' : ''}`} key={t.id}>
              <Checkbox checked={t.done} onChange={() => toggle(t.id)} aria-label={`Mark "${t.text}" as done`} />
              <input className="todo-text" defaultValue={t.text} aria-label="Step" onBlur={(e) => e.target.value !== t.text && rename(t.id, e.target.value)} />
              <button className="todo-del" onClick={() => remove(t.id)} aria-label={`Delete "${t.text}"`}>×</button>
            </div>
          ))}
          <div className="todo-add">
            <Input value={newTodo} onChange={(e) => setNewTodo(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} placeholder="Add a step" aria-label="New step" />
            <Button onClick={add}>Add</Button>
          </div>
        </div>
      </Card>

      {error && <p className="detail-error" role="alert">{error}</p>}

      <div className="detail-actions">
        {completed
          ? <Button variant="outline" onClick={() => save({ status: 'active' })}>Reopen idea</Button>
          : <Button onClick={() => save({ status: 'completed' })}>Mark as completed</Button>}

        {confirmDelete ? (
          <div className="detail-confirm" role="alertdialog" aria-label="Confirm delete">
            <span>Delete this idea? Its steps and images are removed too. This can't be undone.</span>
            <div className="detail-row-buttons">
              <Button className="danger-fill" onClick={removeIdea} disabled={deleting}>{deleting ? 'Deleting…' : 'Yes, delete'}</Button>
              <Button variant="outline" onClick={() => setConfirmDelete(false)} disabled={deleting}>Cancel</Button>
            </div>
          </div>
        ) : (
          <Button variant="outline" className="danger" onClick={() => setConfirmDelete(true)}>Delete idea</Button>
        )}
      </div>
    </main>
  )
}