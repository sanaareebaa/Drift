import { useCallback, useEffect, useState } from 'react'
import { getIdeas } from '../services/ideaStore'

export function useIdeas() {
  const [ideas, setIdeas] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const refresh = useCallback(() => {
    setLoading(true)
    getIdeas().then(setIdeas).catch(setError).finally(() => setLoading(false))
  }, [])
  useEffect(refresh, [refresh])
  return { ideas, loading, error, refresh }
}
