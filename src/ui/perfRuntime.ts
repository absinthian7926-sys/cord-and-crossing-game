export type PerfStats = {
  fps: number
  drawCalls: number
  triangles: number
}

export const perfRuntime: PerfStats = {
  fps: 0,
  drawCalls: 0,
  triangles: 0,
}

export function getPerfStats(): PerfStats {
  return {
    fps: perfRuntime.fps,
    drawCalls: perfRuntime.drawCalls,
    triangles: perfRuntime.triangles,
  }
}
