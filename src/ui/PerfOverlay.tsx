import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import { ZONE } from '../data/zone'
import { perfRuntime } from './perfRuntime'

export function PerfSampler() {
  const { gl } = useThree()
  const elapsed = useRef(0)
  const frames = useRef(0)

  useFrame((_, deltaSeconds) => {
    elapsed.current += deltaSeconds
    frames.current += 1
    if (elapsed.current < ZONE.perfOverlay.sampleIntervalSeconds) return

    perfRuntime.fps = frames.current / elapsed.current
    perfRuntime.drawCalls = gl.info.render.calls
    perfRuntime.triangles = gl.info.render.triangles
    elapsed.current = 0
    frames.current = 0
  })

  return null
}

export function PerfOverlay() {
  const element = useRef<HTMLDivElement>(null)
  const visible = useRef(false)

  useEffect(() => {
    const update = () => {
      if (!element.current || !visible.current) return
      element.current.textContent = `${Math.round(perfRuntime.fps)} fps\n${perfRuntime.drawCalls} draws\n${perfRuntime.triangles.toLocaleString()} tris`
    }
    const toggle = (event: KeyboardEvent) => {
      if (event.code !== ZONE.perfOverlay.toggleCode) return
      visible.current = !visible.current
      if (element.current)
        element.current.style.display = visible.current ? 'block' : 'none'
      update()
    }
    window.addEventListener('keydown', toggle)
    const interval = window.setInterval(
      update,
      ZONE.perfOverlay.sampleIntervalSeconds * 1_000,
    )
    return () => {
      window.removeEventListener('keydown', toggle)
      window.clearInterval(interval)
    }
  }, [])

  return (
    <div
      ref={element}
      aria-label="Performance statistics"
      style={{
        position: 'fixed',
        top: 12,
        left: 12,
        zIndex: 20,
        display: 'none',
        whiteSpace: 'pre',
        padding: '8px 10px',
        color: '#f4ead7',
        background: 'rgba(25, 31, 32, 0.78)',
        border: '1px solid rgba(244, 234, 215, 0.35)',
        font: '12px/1.45 ui-monospace, monospace',
        pointerEvents: 'none',
      }}
    />
  )
}
