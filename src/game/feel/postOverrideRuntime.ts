type Listener = () => void

const listeners = new Set<Listener>()
let enabledOverride: boolean | null = null

export function subscribePostOverride(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getPostOverride(): boolean | null {
  return enabledOverride
}

export function setPostEnabledOverride(value: boolean | null): void {
  if (enabledOverride === value) return
  enabledOverride = value
  for (const listener of listeners) listener()
}
