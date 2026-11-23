import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react'

export type ToastType = 'success' | 'error' | 'info'

export interface ToastItem {
  id: string
  type: ToastType
  message: string
}

interface ToastContextValue {
  toast: {
    success: (message: string) => void
    error: (message: string) => void
    info: (message: string) => void
  }
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const addToast = useCallback((type: ToastType, message: string) => {
    const id = Math.random().toString(36).substring(2, 9)
    setToasts((prev) => [...prev, { id, type, message }])

    // Auto dismiss after 3.5s
    window.setTimeout(() => {
      removeToast(id)
    }, 3500)
  }, [removeToast])

  const toast = {
    success: (msg: string) => addToast('success', msg),
    error: (msg: string) => addToast('error', msg),
    info: (msg: string) => addToast('info', msg),
  }

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {typeof document !== 'undefined' &&
        createPortal(
          <div
            className="toast-container"
            aria-live="polite"
            role="region"
            aria-label="Notifications"
          >
            {toasts.map((t) => (
              <div
                key={t.id}
                className={`toast-item toast-item--${t.type}`}
                role="status"
              >
                <span className="toast-item__icon" aria-hidden="true">
                  {t.type === 'success' && <CheckCircle2 size={16} />}
                  {t.type === 'error' && <AlertCircle size={16} />}
                  {t.type === 'info' && <Info size={16} />}
                </span>
                <span className="toast-item__msg">{t.message}</span>
                <button
                  type="button"
                  onClick={() => removeToast(t.id)}
                  className="toast-item__close"
                  aria-label="Close notification"
                >
                  <X size={14} aria-hidden="true" />
                </button>
              </div>
            ))}
          </div>,
          document.body
        )}
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx.toast
}
