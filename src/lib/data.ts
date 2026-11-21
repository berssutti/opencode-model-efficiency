import { useEffect, useState } from 'react'

interface JsonState<T> {
  data: T | null
  error: string | null
  loading: boolean
}

export function useJson<T>(file: string): JsonState<T> {
  const [state, setState] = useState<JsonState<T>>({ data: null, error: null, loading: true })

  useEffect(() => {
    let cancelled = false
    setState({ data: null, error: null, loading: true })

    fetch(`${import.meta.env.BASE_URL}data/${file}`)
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status} ao carregar ${file}`)
        return response.json() as Promise<T>
      })
      .then((data) => {
        if (!cancelled) setState({ data, error: null, loading: false })
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setState({
            data: null,
            error: error instanceof Error ? error.message : String(error),
            loading: false,
          })
        }
      })

    return () => {
      cancelled = true
    }
  }, [file])

  return state
}
