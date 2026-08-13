import { useEffect, useState } from 'react'

type AsyncState<T> = {
  data: T | null
  loading: boolean
  error: Error | null
}

/**
 * Runs an async read and tracks loading and error state.
 *
 * The `cancelled` flag matters once this points at Firestore: typing in the
 * search box fires a read per keystroke, and without it a slow early response
 * can land after a fast later one and overwrite fresher results with stale
 * ones.
 *
 * `deps` is the caller's dependency list, since the fetcher is usually an
 * inline closure that would be a new function on every render.
 */
export function useAsyncData<T>(fetcher: () => Promise<T>, deps: unknown[]): AsyncState<T> {
  const [state, setState] = useState<AsyncState<T>>({ data: null, loading: true, error: null })

  useEffect(() => {
    let cancelled = false
    setState((prev) => ({ ...prev, loading: true, error: null }))

    fetcher().then(
      (data) => {
        if (!cancelled) setState({ data, loading: false, error: null })
      },
      (cause: unknown) => {
        if (cancelled) return
        setState({
          data: null,
          loading: false,
          error: cause instanceof Error ? cause : new Error(String(cause)),
        })
      },
    )

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return state
}
