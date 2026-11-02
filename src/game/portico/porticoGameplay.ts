import { ZONE } from '../../data/zone'
import { grantStrengthFromCrossing } from '../effects/effectRuntime'
import { setGameplayInputLock } from '../player/input'
import { emitQuestEvent, getQuestRuntimeSnapshot } from '../quest/questRuntime'
import { requestSceneTransition, type GameScene } from '../scenes/sceneRuntime'
import { heightAt } from '../world/terrain'
import {
  activatePortico,
  canCrossPorticoDirection,
  getPorticoRuntimeSnapshot,
  isKeyUseNearby,
  shouldShowUseKeyPrompt,
  unlockPortico,
  type PorticoDirection,
} from './porticoRuntime'

export function canUsePorticoKey(): boolean {
  const quest = getQuestRuntimeSnapshot().quest
  return shouldShowUseKeyPrompt({
    nearby: isKeyUseNearby(),
    questStep: quest.currentStep,
    keyLooted: quest.keyLooted,
    phase: getPorticoRuntimeSnapshot().phase,
  })
}

export function tryUsePorticoKey(): boolean {
  if (!canUsePorticoKey() || !unlockPortico()) return false
  activatePortico()
  return true
}

export function handlePorticoCrossing(direction: PorticoDirection): boolean {
  if (!canCrossPorticoDirection(direction, getPorticoRuntimeSnapshot().phase))
    return false
  setGameplayInputLock('portico-transition-request', true)
  if (direction === 'zoneToHollow') {
    const started = requestSceneTransition(
      'hollow',
      ZONE.hollow.arrival[0],
      ZONE.hollow.arrival[1],
      ZONE.hollow.arrival[2],
    )
    if (!started) {
      setGameplayInputLock('portico-transition-request', false)
      return false
    }
    setGameplayInputLock('scene-transition', true)
    setGameplayInputLock('portico-transition-request', false)
    grantStrengthFromCrossing(false)
    if (getQuestRuntimeSnapshot().quest.currentStep === 4)
      emitQuestEvent('crossedPortico')
    return true
  }

  const zoneX = ZONE.portico.center[0] - ZONE.portico.zoneReturnArrivalOffset
  const zoneZ = ZONE.portico.center[1]
  const started = requestSceneTransition(
    'zone',
    zoneX,
    heightAt(zoneX, zoneZ),
    zoneZ,
  )
  if (!started) {
    setGameplayInputLock('portico-transition-request', false)
    return false
  }
  setGameplayInputLock('scene-transition', true)
  setGameplayInputLock('portico-transition-request', false)
  grantStrengthFromCrossing(true)
  return true
}

export function forcePorticoCrossing(direction: PorticoDirection): boolean {
  return handlePorticoCrossing(direction)
}

export function sceneForPorticoDirection(
  direction: PorticoDirection,
): GameScene {
  return direction === 'zoneToHollow' ? 'hollow' : 'zone'
}
