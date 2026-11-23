import { useEffect, useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
}

export function Modal({ open, onClose, title, children }: ModalProps) {
  const [visible, setVisible] = useState(open)
  const [closing, setClosing] = useState(false)
  const modalPanelRef = useRef<HTMLElement>(null)
  const triggerElementRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (open) {
      triggerElementRef.current = document.activeElement as HTMLElement | null
      setVisible(true)
      setClosing(false)
    } else if (visible) {
      setVisible(false)
    }
  }, [open])

  useEffect(() => {
    if (!visible) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        handleClose()
        return
      }

      if (e.key === 'Tab') {
        const focusable = modalPanelRef.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
        if (!focusable || focusable.length === 0) {
          e.preventDefault()
          return
        }

        const first = focusable[0]
        const last = focusable[focusable.length - 1]

        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault()
            last.focus()
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault()
            first.focus()
          }
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    // Focus first interactive element inside modal after mount
    const timer = window.setTimeout(() => {
      const focusable = modalPanelRef.current?.querySelectorAll<HTMLElement>(
        'input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )
      focusable?.[0]?.focus()
    }, 50)

    return () => {
      window.clearTimeout(timer)
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleKeyDown)
      triggerElementRef.current?.focus()
    }
  }, [visible, closing])

  function handleClose() {
    if (closing) return
    setClosing(true)
    window.setTimeout(() => {
      setVisible(false)
      setClosing(false)
      onClose()
    }, 200)
  }

  if (!visible) return null

  const isRegistration = title === 'Add member'

  // Special wide split-panel layout for Member Registration
  if (isRegistration) {
    return createPortal(
      <div
        className={`member-overlay ${closing ? 'member-overlay--closing' : ''}`}
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) handleClose()
        }}
      >
        <div className="member-overlay__backdrop" />

        <section
          ref={modalPanelRef}
          role="dialog"
          aria-modal="true"
          aria-label={title}
          className="member-overlay__panel"
        >
          <header className="member-overlay__header">
            <div className="member-overlay__brand">
              <span className="member-overlay__brand-mark">F</span>
              <span>FITRELAY</span>
            </div>

            <button
              type="button"
              onClick={handleClose}
              aria-label="Close registration"
              className="member-overlay__close"
            >
              <X size={18} aria-hidden="true" />
            </button>
          </header>

          <div className="member-overlay__body">
            <div className="member-overlay__side">
              <div className="member-overlay__asset">
                <img
                  src="/images/member-registration.jpg"
                  alt="Athlete training in gym"
                />
                <div className="member-overlay__asset-overlay" />
              </div>

              <div className="member-overlay__side-content">
                <span className="member-overlay__eyebrow">
                  MEMBERSHIP MANAGEMENT / 01
                </span>
                <h1>
                  Build their
                  <br />
                  <span>fitness journey.</span>
                </h1>
                <p>
                  Every great transformation starts with showing up.
                  Add a new member and get their journey started today.
                </p>
              </div>

              <div className="member-overlay__side-footer">
                <span>FITRELAY MANAGEMENT SYSTEM</span>
                <span>01 — NEW MEMBER</span>
              </div>
            </div>

            <div className="member-overlay__form-panel">
              <div className="member-overlay__form-scroll">
                <div className="member-overlay__form-heading">
                  <span className="member-overlay__eyebrow">GET STARTED</span>
                  <h2>Add new member</h2>
                  <p>Enter their details to create a member profile.</p>
                </div>

                {children}
              </div>
            </div>
          </div>
        </section>
      </div>,
      document.body
    )
  }

  // Standard dialog for all operational modals (Payment, Freeze, Unfreeze, Renew, Plan)
  return createPortal(
    <div
      className={`fr-modal-overlay ${closing ? 'fr-modal-overlay--closing' : ''}`}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) handleClose()
      }}
    >
      <div className="fr-modal-backdrop" />

      <div
        ref={modalPanelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="fr-modal-panel"
      >
        <header className="fr-modal-header">
          <h2 className="fr-modal-title">{title}</h2>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close modal"
            className="fr-modal-close"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </header>

        <div className="fr-modal-body">
          {children}
        </div>
      </div>
    </div>,
    document.body
  )
}
