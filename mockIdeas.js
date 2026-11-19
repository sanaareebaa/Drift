const day = 86400000
const ago = (d) => new Date(Date.now() - d * day).toISOString()
const todos = (...items) => items.map(([text, done], i) => ({ id: `t${i}`, text, done }))

export const mockIdeas = [
  { id: '1', text: 'Study planner for exams', status: 'active', createdAt: ago(12), lastVisitedAt: ago(1), goal: 'Have a full weekly exam schedule ready', targetDate: '2026-10-15',
    aiPlan: { summary: 'A weekly planner built around exam dates.', todos: todos(['List subjects and dates', true], ['Sketch weekly layout', true], ['Pick tools', true], ['Build basic prototype', false], ['Test with a friend', false]) } },
  { id: '2', text: 'Weekly meal prep tracker', status: 'active', createdAt: ago(20), lastVisitedAt: ago(14), aiPlan: { summary: '', todos: [] } },
  { id: '3', text: 'Poster for campus event', status: 'completed', createdAt: ago(30), lastVisitedAt: ago(5), aiPlan: { summary: 'Done.', todos: todos(['Draft', true], ['Print', true]) } },
  { id: '4', text: 'Podcast about study habits', status: 'active', createdAt: ago(6), lastVisitedAt: ago(2), reminderAt: ago(-2), aiPlan: { summary: '', todos: [] } },
  { id: '5', text: 'Reading list app', status: 'active', createdAt: ago(40), lastVisitedAt: ago(25), aiPlan: { summary: '', todos: [] } },
  { id: '6', text: 'Short story outline', status: 'active', createdAt: ago(9), lastVisitedAt: ago(3), aiPlan: { summary: '', todos: todos(['Characters', true], ['Plot beats', false]) } },
  { id: '7', text: 'Plant watering reminder', status: 'completed', createdAt: ago(50), lastVisitedAt: ago(20), aiPlan: { summary: '', todos: [] } },
  { id: '8', text: 'Gift ideas notebook', status: 'active', createdAt: ago(18), lastVisitedAt: ago(11), aiPlan: { summary: '', todos: [] } },
]
