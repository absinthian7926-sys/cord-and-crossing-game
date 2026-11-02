import { useEffect, useState } from 'react'
import { MODEL_ASSETS, type ModelId } from '../../data/models'

export type ModelAvailability = 'checking' | 'ready' | 'failed'

const availabilityRequests = new Map<string, Promise<boolean>>()
const warnedPaths = new Set<string>()

function requestAvailability(path: string): Promise<boolean> {
  const existing = availabilityRequests.get(path)
  if (existing) return existing
  const request = fetch(path, { method: 'HEAD' })
    .then((response) => response.ok)
    .catch(() => false)
  availabilityRequests.set(path, request)
  return request
}

function warnOnce(path: string): void {
  if (warnedPaths.has(path)) return
  warnedPaths.add(path)
  console.warn(`Model unavailable, using primitive fallback: ${path}`)
}

export function useModelAvailability(model: ModelId): ModelAvailability {
  const definition = MODEL_ASSETS[model]
  const [availability, setAvailability] =
    useState<ModelAvailability>('checking')

  useEffect(() => {
    let current = true
    void requestAvailability(definition.path).then((available) => {
      if (!current) return
      if (!available) warnOnce(definition.path)
      setAvailability(available ? 'ready' : 'failed')
    })
    return () => {
      current = false
    }
  }, [definition.path])

  return availability
}
