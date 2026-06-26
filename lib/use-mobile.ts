'use client'

import { useEffect, useState } from 'react'

/** True when the viewport matches the given media query (default: < lg). */
export function useMediaQuery(query = '(max-width: 1023px)'): boolean {
  const [matches, setMatches] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia(query)
    const onChange = () => setMatches(mq.matches)
    onChange()
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [query])
  return matches
}
