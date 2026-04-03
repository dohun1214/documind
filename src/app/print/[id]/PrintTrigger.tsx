'use client'

import { useEffect } from 'react'

export function PrintTrigger() {
  useEffect(() => {
    // Short delay to ensure styles and content are fully painted
    const t = setTimeout(() => window.print(), 300)
    return () => clearTimeout(t)
  }, [])
  return null
}
