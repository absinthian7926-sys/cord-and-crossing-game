import { afterEach, describe, expect, it } from 'vitest'
import {
  beginPendingSceneLoad,
  getSceneRuntimeSnapshot,
  loadSceneImmediately,
  markSceneReady,
  requestSceneTransition,
} from '../game/scenes/sceneRuntime'

describe('scene load timing', () => {
  afterEach(() => loadSceneImmediately('zone'))

  it('measures loading after the crossing flash completes', () => {
    expect(requestSceneTransition('hollow', 0, 0, -3, 1_000)).toBe(true)
    expect(getSceneRuntimeSnapshot().transitionStartedMilliseconds).toBe(1_000)

    expect(beginPendingSceneLoad(2_000)).toBe(true)
    expect(getSceneRuntimeSnapshot().transitionStartedMilliseconds).toBe(2_000)

    markSceneReady(3_350)
    expect(getSceneRuntimeSnapshot().lastLoadMilliseconds).toBe(1_350)
  })
})
