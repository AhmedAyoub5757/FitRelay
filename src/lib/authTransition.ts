import type { NavigateFunction } from 'react-router-dom'

/**
 * Navigate with a View Transitions API cross-fade/slide if supported.
 * Falls back to plain navigate() when not supported or reduced-motion is set.
 * Used by LoginPage ↔ SignupPage to animate the panel swap.
 */
export function transitionNavigate(navigate: NavigateFunction, to: string) {
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (!('startViewTransition' in document) || prefersReducedMotion) {
    navigate(to)
    return
  }
  // @ts-expect-error — startViewTransition not yet in all TS lib.dom versions
  document.startViewTransition(() => navigate(to))
}
