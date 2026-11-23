import { useEffect, useState, useRef } from 'react'

interface CountUpProps {
  value: number
  decimals?: number
  duration?: number
  prefix?: string
  suffix?: string
}

export function CountUp({
  value,
  decimals = 0,
  duration = 600,
  prefix = '',
  suffix = '',
}: CountUpProps) {
  const [displayValue, setDisplayValue] = useState<number>(0)
  const hasAnimatedRef = useRef(false)
  const startValRef = useRef(0)

  useEffect(() => {
    // If reduced motion is preferred, jump straight to target value
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersReducedMotion) {
      setDisplayValue(value)
      hasAnimatedRef.current = true
      return
    }

    // Only count-up on first resolution from initial load to avoid repetitive jank
    if (hasAnimatedRef.current) {
      setDisplayValue(value)
      return
    }

    let startTime: number | null = null
    let animFrame: number
    const startVal = startValRef.current
    const diff = value - startVal

    function step(timestamp: number) {
      if (!startTime) startTime = timestamp
      const progress = Math.min((timestamp - startTime) / duration, 1)

      // Ease-out expo: 1 - Math.pow(2, -10 * progress)
      const ease = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress)
      const current = startVal + diff * ease

      setDisplayValue(current)

      if (progress < 1) {
        animFrame = requestAnimationFrame(step)
      } else {
        hasAnimatedRef.current = true
      }
    }

    animFrame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(animFrame)
  }, [value, duration])

  const formatted = decimals > 0 ? displayValue.toFixed(decimals) : Math.round(displayValue).toString()

  return (
    <span>
      {prefix}
      {formatted}
      {suffix}
    </span>
  )
}
