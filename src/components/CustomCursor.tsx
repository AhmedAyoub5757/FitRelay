import { useEffect, useRef, useState } from 'react'

export const ENABLE_CUSTOM_CURSOR = true

export function CustomCursor() {
  const cursorRef = useRef<HTMLDivElement>(null)
  const [isPointerFine, setIsPointerFine] = useState(false)
  const [isHovering, setIsHovering] = useState(false)
  const [isClicking, setIsClicking] = useState(false)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    if (!ENABLE_CUSTOM_CURSOR) return

    // Detect fine pointer device once at mount (never on touch / mobile devices)
    const fineMatch = window.matchMedia('(pointer: fine)').matches
    const reducedMotionMatch = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    if (!fineMatch || reducedMotionMatch) return
    setIsPointerFine(true)

    let mouseX = -100
    let mouseY = -100

    function onMouseMove(e: MouseEvent) {
      mouseX = e.clientX
      mouseY = e.clientY
      if (!isVisible) setIsVisible(true)

      if (cursorRef.current) {
        cursorRef.current.style.transform = `translate3d(${mouseX}px, ${mouseY}px, 0)`
      }

      const target = e.target as HTMLElement | null
      if (target) {
        const interactive = !!target.closest(
          'a, button, input, select, textarea, [role="button"], [role="menuitem"], .nav-item, .table-link, .pagination__btn, .cursor-pointer'
        )
        setIsHovering(interactive)
      }
    }

    function onMouseDown() {
      setIsClicking(true)
    }

    function onMouseUp() {
      setIsClicking(false)
    }

    function onMouseLeave() {
      setIsVisible(false)
    }

    function onMouseEnter() {
      setIsVisible(true)
    }

    window.addEventListener('mousemove', onMouseMove, { passive: true })
    window.addEventListener('mousedown', onMouseDown, { passive: true })
    window.addEventListener('mouseup', onMouseUp, { passive: true })
    document.addEventListener('mouseleave', onMouseLeave)
    document.addEventListener('mouseenter', onMouseEnter)

    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('mouseup', onMouseUp)
      document.removeEventListener('mouseleave', onMouseLeave)
      document.removeEventListener('mouseenter', onMouseEnter)
    }
  }, [isVisible])

  if (!ENABLE_CUSTOM_CURSOR || !isPointerFine) return null

  return (
    <div
      ref={cursorRef}
      className={`fr-cursor ${isVisible ? 'fr-cursor--visible' : ''} ${
        isHovering ? 'fr-cursor--hover' : ''
      } ${isClicking ? 'fr-cursor--clicking' : ''}`}
      aria-hidden="true"
    >
      <div className="fr-cursor__core" />
      <div className="fr-cursor__aura" />
    </div>
  )
}
