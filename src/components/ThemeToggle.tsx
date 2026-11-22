import { useRef } from 'react'
import { useTheme } from '../context/ThemeContext'

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()
  const buttonRef = useRef<HTMLButtonElement>(null)

  return (
    <button
      ref={buttonRef}
      onClick={() => toggleTheme(buttonRef.current)}
      aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
      className="relative h-7 w-12 rounded-full border border-border bg-surface transition-colors"
    >
      <span
        className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-accent transition-transform duration-300 ${
          theme === 'dark' ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  )
}