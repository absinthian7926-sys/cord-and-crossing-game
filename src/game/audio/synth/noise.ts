export function nextSeededUnit(state: Uint32Array): number {
  let value = state[0]
  value ^= value << 13
  value ^= value >>> 17
  value ^= value << 5
  state[0] = value >>> 0
  return state[0] / 4_294_967_296
}

export function createNoiseBuffer(
  context: BaseAudioContext,
  durationSeconds: number,
  seed: number,
): AudioBuffer {
  const length = Math.max(1, Math.ceil(context.sampleRate * durationSeconds))
  const buffer = context.createBuffer(1, length, context.sampleRate)
  const samples = buffer.getChannelData(0)
  const state = new Uint32Array([seed === 0 ? 0x9e3779b9 : seed >>> 0])
  for (let index = 0; index < samples.length; index += 1)
    samples[index] = nextSeededUnit(state) * 2 - 1
  return buffer
}
