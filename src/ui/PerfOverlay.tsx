import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { ZONE } from '../data/zone'
import { getSceneRuntimeSnapshot } from '../game/scenes/sceneRuntime'
import {
  createPerfFrameBuffer,
  createPerfSummary,
  pushFrameTime,
  samplePerfStats,
} from './perfStats'
import { perfRuntime } from './perfRuntime'

function queryRequestsPerf(): boolean {
  return new URLSearchParams(window.location.search).get('perf') === '1'
}

function readRenderer(
  gl: WebGLRenderingContext | WebGL2RenderingContext,
): string {
  const extension = gl.getExtension('WEBGL_debug_renderer_info')
  if (!extension) return 'unknown'
  const renderer = gl.getParameter(extension.UNMASKED_RENDERER_WEBGL)
  return typeof renderer === 'string' && renderer.length > 0
    ? renderer
    : 'unknown'
}

export function PerfSampler() {
  const { gl } = useThree()
  const buffer = useRef(createPerfFrameBuffer())
  const summary = useRef(createPerfSummary())
  const sampleElapsedSeconds = useRef(0)
  const renderer = useMemo(() => readRenderer(gl.getContext()), [gl])

  useFrame((state, deltaSeconds) => {
    const nowSeconds = state.clock.elapsedTime
    pushFrameTime(buffer.current, deltaSeconds * 1_000, nowSeconds)
    sampleElapsedSeconds.current += deltaSeconds
    if (sampleElapsedSeconds.current < ZONE.perfOverlay.sampleIntervalSeconds)
      return

    samplePerfStats(buffer.current, nowSeconds, summary.current)
    perfRuntime.fps = summary.current.fps
    perfRuntime.frameTimeMeanMs = summary.current.frameTimeMeanMs
    perfRuntime.frameTimeP95Ms = summary.current.frameTimeP95Ms
    perfRuntime.onePercentLowFps = summary.current.onePercentLowFps
    perfRuntime.drawCalls = gl.info.render.calls
    perfRuntime.triangles = gl.info.render.triangles
    perfRuntime.devicePixelRatio = gl.getPixelRatio()
    perfRuntime.scene = getSceneRuntimeSnapshot().currentScene
    perfRuntime.renderer = renderer
    sampleElapsedSeconds.current = 0
  })

  return null
}

export function PerfOverlay() {
  const element = useRef<HTMLDivElement>(null)
  const initiallyVisible = queryRequestsPerf()
  const visible = useRef(initiallyVisible)

  useEffect(() => {
    const update = () => {
      if (!element.current || !visible.current) return
      element.current.textContent = `${perfRuntime.fps.toFixed(1)} fps\n${perfRuntime.frameTimeMeanMs.toFixed(2)} ms mean\n${perfRuntime.frameTimeP95Ms.toFixed(2)} ms p95\n${perfRuntime.onePercentLowFps.toFixed(1)} fps 1% low\n${perfRuntime.drawCalls} draws\n${perfRuntime.triangles.toLocaleString()} tris\n${perfRuntime.qualityTier} tier\n${perfRuntime.devicePixelRatio.toFixed(2)} dpr\n${perfRuntime.scene} scene\n${perfRuntime.renderer}`
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
    update()
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
        display: initiallyVisible ? 'block' : 'none',
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
