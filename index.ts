// supabase/functions/suggest/index.ts
import { createClient } from 'npm:@supabase/supabase-js@2'

// Looks at a person's open ideas and picks which one to work on next, using the Gemini API.

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

const SYSTEM = `You help a student decide which of their ideas to work on next.
You get a list of open ideas. Each has: id, title, targetDate (or null), progress (percent of steps done), daysSinceVisit, todoCount.
Pick the best idea to work on now and rank the top 3 (fewer if there are fewer ideas).
Weigh these, roughly in this order:
1. A close target date (soon, but not already long past).
2. Momentum: partly done ideas that are worth finishing, and ideas touched recently.
3. Ideas with no steps yet are lower priority than ideas that are ready to work on.
4. Ideas untouched for many days are lower priority, unless a deadline is close.
For each ranked idea write a reason: ONE short sentence (under 15 words) that names the concrete facts, for example "Due in 3 days and already 60% done."
Never invent facts. Only use the numbers given. Use the idea ids exactly as given.`

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function callGemini(apiKey: string, model: string, body: unknown) {
  let res: Response
  for (let attempt = 0; attempt < 3; attempt++) {
    res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify(body),
    })
    if (res.status !== 503 && res.status !== 429) return res
    await sleep(1000 * (attempt + 1))
  }
  return res!
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Use POST' }, 405)

  // Only signed-in users may call this function
  const token = (req.headers.get('Authorization') || '').replace('Bearer ', '')
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!)
  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return json({ error: 'Sign in required' }, 401)

  let input: { ideas?: Record<string, unknown>[]; today?: string }
  try { input = await req.json() } catch { return json({ error: 'Invalid JSON' }, 400) }

  const ideas = (Array.isArray(input.ideas) ? input.ideas : []).slice(0, 40).map((i) => ({
    id: String(i.id),
    title: String(i.title || '').slice(0, 120),
    targetDate: i.targetDate ? String(i.targetDate) : null,
    progress: Number(i.progress) || 0,
    daysSinceVisit: Number(i.daysSinceVisit) || 0,
    todoCount: Number(i.todoCount) || 0,
  }))
  if (!ideas.length) return json({ pickId: null, reason: '', ranking: [] })
  if (ideas.length === 1) {
    return json({ pickId: ideas[0].id, reason: 'It is your only open idea.', ranking: [{ id: ideas[0].id, reason: 'It is your only open idea.' }] })
  }

  const apiKey = Deno.env.get('GEMINI_API_KEY')
  if (!apiKey) return json({ error: 'Server is missing its AI key' }, 500)

  const today = String(input.today || new Date().toISOString().slice(0, 10)).slice(0, 10)
  const body = {
    systemInstruction: { parts: [{ text: SYSTEM }] },
    contents: [{ role: 'user', parts: [{ text: `Today is ${today}.\nOpen ideas:\n${JSON.stringify(ideas)}` }] }],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'OBJECT',
        properties: {
          pickId: { type: 'STRING' },
          ranking: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: { id: { type: 'STRING' }, reason: { type: 'STRING' } },
              required: ['id', 'reason'],
            },
          },
        },
        required: ['pickId', 'ranking'],
      },
      maxOutputTokens: 1024,
      temperature: 0.3,
    },
  }

  const models = [Deno.env.get('GEMINI_MODEL') || 'gemini-3.8-flash', Deno.env.get('GEMINI_FALLBACK_MODEL')].filter(Boolean) as string[]
  let res!: Response
  for (const model of models) {
    res = await callGemini(apiKey, model, body)
    if (res.ok || (res.status !== 503 && res.status !== 429)) break
  }

  if (!res.ok) {
    const detail = await res.text()
    console.error('Gemini error', res.status, detail)
    return json({ error: 'AI request failed', geminiStatus: res.status, detail: detail.slice(0, 300) }, 502)
  }

  const data = await res.json()
  const raw = data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text || '').join('') || ''

  try {
    const out = JSON.parse(raw.replace(/```json|```/g, '').trim())
    // Keep only ids that really exist, no repeats, at most 3
    const valid = new Set(ideas.map((i) => i.id))
    const seen = new Set<string>()
    const ranking = (Array.isArray(out.ranking) ? out.ranking : [])
      .map((r: { id?: unknown; reason?: unknown }) => ({ id: String(r.id), reason: String(r.reason || '').trim().slice(0, 160) }))
      .filter((r: { id: string }) => valid.has(r.id) && !seen.has(r.id) && seen.add(r.id))
      .slice(0, 3)
    if (!ranking.length) throw new Error('no valid ranking')
    // The pick is always the first in the ranking, so the two never disagree
    return json({ pickId: ranking[0].id, reason: ranking[0].reason, ranking })
  } catch {
    console.error('Unreadable Gemini reply:', raw.slice(0, 500))
    return json({ error: 'AI returned an unreadable suggestion', raw: raw.slice(0, 300) }, 502)
  }
})