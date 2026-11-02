import { useEffect, useRef } from 'react'
import { registerToastElement, showToast } from './toastRuntime'

export type ToastProps = {
  readonly message?: string | null
}

export function Toast({ message = null }: ToastProps) {
  const element = useRef<HTMLDivElement>(null)
  useEffect(() => {
    registerToastElement(element.current)
    return () => registerToastElement(null)
  }, [])
  useEffect(() => {
    if (message !== null) showToast(message, 4)
  }, [message])
  return (
    <div
      ref={element}
      className="game-toast"
      role="status"
      aria-live="polite"
      style={{ display: message === null ? 'none' : 'block' }}
    />
  )
}
