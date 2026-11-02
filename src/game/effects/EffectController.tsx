import { useBeforePhysicsStep } from '@react-three/rapier'
import { useRef } from 'react'
import { consumeInput } from '../player/input'
import { playerStore } from '../player/playerStore'
import {
  interruptHeelstonePassByHit,
  startHeelstonePass,
  tickEffectRuntime,
} from './effectRuntime'

export function EffectController() {
  const lastHealth = useRef(playerStore.getState().vitals.health)

  useBeforePhysicsStep(() => {
    const health = playerStore.getState().vitals.health
    if (health < lastHealth.current) interruptHeelstonePassByHit()
    lastHealth.current = health
    if (consumeInput('heelstonePass')) startHeelstonePass()
    tickEffectRuntime(1 / 60)
  })

  return null
}
