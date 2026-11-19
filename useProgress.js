// Progress is always computed from the to-dos, never stored.
export function useProgress(todos = []) {
  const total = todos.length
  const done = todos.filter((t) => t.done).length
  return { done, total, percent: total ? Math.round((done / total) * 100) : 0 }
}
