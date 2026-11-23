/** Returns a stable debounced version of `value`, delayed by `delay` ms */
import { useState, useEffect } from 'react'

export function useDebounce<T>(value: T, delay = 280): T {
  const [debounced, setDebounced] = useState<T>(value)
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(id)
  }, [value, delay])
  return debounced
}
