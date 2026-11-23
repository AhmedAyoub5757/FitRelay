import { useEffect, useState } from 'react'

let hasResolvedColdLoadOnce = false

export function AppPreloader({ isLoading }: { isLoading: boolean }) {
  const [show, setShow] = useState(!hasResolvedColdLoadOnce && isLoading)
  const [fading, setFading] = useState(false)

  useEffect(() => {
    if (hasResolvedColdLoadOnce) return

    if (!isLoading && show && !fading) {
      setFading(true)
      const timer = window.setTimeout(() => {
        hasResolvedColdLoadOnce = true
        setShow(false)
        setFading(false)
      }, 250)
      return () => clearTimeout(timer)
    }
  }, [isLoading, show, fading])

  if (!show || hasResolvedColdLoadOnce) return null

  return (
    <div
      className={`app-preloader ${fading ? 'app-preloader--fading' : ''}`}
      aria-hidden="true"
    >
      <div className="app-preloader__content">
        <div className="app-preloader__mark">F</div>
        <div className="app-preloader__brand">FitRelay</div>
        <div className="app-preloader__bar">
          <div className="app-preloader__bar-inner" />
        </div>
      </div>
    </div>
  )
}
