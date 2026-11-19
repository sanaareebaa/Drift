import { supabase } from './supabaseClient'

// Both plan generation and suggestions use the real Gemini functions (make-plan and suggest).
// Set USE_MOCK_SUGGEST back to true to work offline with the rule-based mock.
export const USE_MOCK_PLAN = false
export const USE_MOCK_SUGGEST = false

const DAY = 86400000
const pct = (idea) => {
  const todos = idea.aiPlan?.todos || []
  return todos.length ? Math.round((todos.filter((t) => t.done).length / todos.length) * 100) : 0
}
const daysSince = (iso) => Math.floor((Date.now() - new Date(iso)) / DAY)

// Mock: ranks open ideas by deadline, progress and how recently they were touched.
function mockSuggest(ideas) {
  const ranked = ideas
    .filter((i) => i.status !== 'completed')
    .map((i) => {
      const reasons = []
      let score = 0
      const progress = pct(i)
      if (i.targetDate) {
        const left = Math.ceil((new Date(i.targetDate) - Date.now()) / DAY)
        if (left >= 0 && left <= 30) { score += 40 - left; reasons.push(left === 0 ? 'due today' : `due in ${left} days`) }
      }
      if (progress > 0) { score += progress / 2; reasons.push(`already ${progress}% done`) }
      const idle = daysSince(i.lastVisitedAt)
      if (idle <= 3) { score += 10; reasons.push('you worked on it recently') }
      else if (idle > 10) { score -= 10; reasons.push(`untouched for ${idle} days`) }
      const reason = reasons.length ? reasons[0][0].toUpperCase() + reasons.join(', ').slice(1) + '.' : 'A fresh idea with room to grow.'
      return { id: i.id, score, reason }
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(({ id, reason }) => ({ id, reason }))

  return { pickId: ranked[0]?.id ?? null, reason: ranked[0]?.reason ?? '', ranking: ranked }
}

// Returns { pickId, reason, ranking: [{ id, reason }] }
export async function suggestIdea(ideas) {
  if (USE_MOCK_SUGGEST) return new Promise((r) => setTimeout(() => r(mockSuggest(ideas)), 400))

  const payload = ideas.filter((i) => i.status !== 'completed').map((i) => ({
    id: i.id, title: i.title || i.text, targetDate: i.targetDate || null, progress: pct(i),
    daysSinceVisit: daysSince(i.lastVisitedAt), todoCount: (i.aiPlan?.todos || []).length,
  }))
  const { data, error } = await supabase.functions.invoke('suggest', { body: { ideas: payload, today: new Date().toISOString().slice(0, 10) } })
  if (error) throw error
  return data
}

// ---- Plan generation (Idea detail D5) ----
// Returns { summary, todos: [{ id, text, done: false }] }
const withIds = (steps) =>
  steps.map((s, i) => ({ id: `t${Date.now()}${i}`, text: String(typeof s === 'string' ? s : s.text).trim(), done: false })).filter((t) => t.text)

function mockPlan(idea) {
  const topic = idea.text.length > 60 ? `${idea.text.slice(0, 57)}…` : idea.text
  return {
    title: idea.text.split(/\s+/).slice(0, 5).join(' '),
    summary: `A starting plan for: ${topic}`,
    todos: withIds([
      'Write down what "done" looks like',
      'List what you need to get started',
      'Break the idea into 3 small parts',
      'Finish the first small part',
      'Review what you have and adjust',
    ]),
  }
}

export async function makePlan(idea) {
  if (USE_MOCK_PLAN) return new Promise((r) => setTimeout(() => r(mockPlan(idea)), 700))

  const { data, error } = await supabase.functions.invoke('make-plan', {
    body: {
      text: idea.text, goal: idea.goal || null, audioTranscript: idea.audioTranscript || null, targetDate: idea.targetDate || null,
      // Only stored images can be read by the function (not temporary browser links). It uses at most 3.
      imagePaths: (idea.imagePaths || []).filter((p) => !/^(blob:|https?:)/.test(p)).slice(0, 3),
    },
  })
  if (error || !data?.todos?.length) throw error || new Error('Empty plan')
  return {
    title: data.title || '', summary: data.summary || '', todos: withIds(data.todos),
    imagesRequested: data.imagesRequested ?? null, imagesUsed: data.imagesUsed ?? null,
  }
}