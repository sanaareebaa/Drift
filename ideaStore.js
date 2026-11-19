import { supabase } from './supabaseClient'
import { mockIdeas } from './mockIdeas'

// Flip to false once Supabase is set up. Pages never need to change.
export const USE_MOCK = false
const DEAD_AFTER_DAYS = 10

let local = [...mockIdeas]
const wait = (v) => new Promise((r) => setTimeout(() => r(v), 80))

// Row <-> app shape
const fromRow = (r) => ({
  id: r.id, title: r.title, text: r.text, audioTranscript: r.audio_transcript, imagePaths: r.image_paths || [],
  status: r.status, createdAt: r.created_at, lastVisitedAt: r.last_visited_at,
  reminderAt: r.reminder_at, reminderSent: r.reminder_sent, reminderChannel: r.reminder_channel, reminderOffsetDays: r.reminder_offset_days, goal: r.goal,
  targetDate: r.target_date, aiPlan: r.ai_plan || { summary: '', todos: [] },
})
const toRow = (i) => {
  const m = { text: 'text', title: 'title', audioTranscript: 'audio_transcript', imagePaths: 'image_paths', status: 'status',
    lastVisitedAt: 'last_visited_at', reminderAt: 'reminder_at', reminderChannel: 'reminder_channel', reminderOffsetDays: 'reminder_offset_days', reminderSent: 'reminder_sent',
    goal: 'goal', targetDate: 'target_date', aiPlan: 'ai_plan' }
  return Object.fromEntries(Object.entries(i).filter(([k]) => m[k]).map(([k, v]) => [m[k], v]))
}

export const isDead = (idea) =>
  idea.status !== 'completed' && Date.now() - new Date(idea.lastVisitedAt) > DEAD_AFTER_DAYS * 86400000

export async function getIdeas() {
  if (USE_MOCK) return wait([...local])
  const { data, error } = await supabase.from('ideas').select('*').order('created_at', { ascending: false })
  if (error) throw error
  return data.map(fromRow)
}

export async function getIdea(id) {
  if (USE_MOCK) return wait(local.find((i) => i.id === id) || null)
  const { data, error } = await supabase.from('ideas').select('*').eq('id', id).single()
  if (error) throw error
  return fromRow(data)
}

export async function addIdea(idea) {
  if (USE_MOCK) {
    const created = { id: crypto.randomUUID(), status: 'active', createdAt: new Date().toISOString(),
      lastVisitedAt: new Date().toISOString(), aiPlan: { summary: '', todos: [] }, ...idea }
    local = [created, ...local]
    return wait(created)
  }
  const { data, error } = await supabase.from('ideas').insert(toRow(idea)).select().single()
  if (error) throw error
  return fromRow(data)
}

export async function updateIdea(id, changes) {
  if (USE_MOCK) {
    local = local.map((i) => (i.id === id ? { ...i, ...changes } : i))
    return wait(local.find((i) => i.id === id))
  }
  const { data, error } = await supabase.from('ideas').update(toRow(changes)).eq('id', id).select().single()
  if (error) throw error
  return fromRow(data)
}

export async function deleteIdea(id) {
  if (USE_MOCK) { local = local.filter((i) => i.id !== id); return wait(true) }
  const { error } = await supabase.from('ideas').delete().eq('id', id)
  if (error) throw error
  return true
}

export async function getCounts() {
  const ideas = await getIdeas()
  return {
    completed: ideas.filter((i) => i.status === 'completed').length,
    dead: ideas.filter(isDead).length,
    active: ideas.filter((i) => i.status === 'active' && !isDead(i)).length,
  }
}