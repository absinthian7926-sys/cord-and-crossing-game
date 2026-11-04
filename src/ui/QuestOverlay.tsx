import { useCallback, useEffect, useSyncExternalStore } from 'react'
import { FRAME_SHELTER_KEY, QUEST } from '../data/quests'
import { currentDialogueNode } from '../game/quest/dialogue'
import {
  chooseHollenDialogue,
  closeHollenDialogue,
  getQuestRuntimeSnapshot,
  isHollenNearby,
  isKeyNearby,
  lootFrameShelterKey,
  openHollenDialogue,
  setQuestLogOpen,
  subscribeQuestRuntime,
  toggleQuestLog,
} from '../game/quest/questRuntime'
import {
  isGameplayInputLocked,
  setGameplayInputLock,
} from '../game/player/input'
import {
  canUsePorticoKey,
  tryUsePorticoKey,
} from '../game/portico/porticoGameplay'
import {
  getPorticoRuntimeSnapshot,
  subscribePorticoRuntime,
} from '../game/portico/porticoRuntime'
import { Dialogue } from './Dialogue'
import { Hud } from './Hud'
import { QuestLog } from './QuestLog'

export function QuestOverlay() {
  const snapshot = useSyncExternalStore(
    subscribeQuestRuntime,
    getQuestRuntimeSnapshot,
    getQuestRuntimeSnapshot,
  )
  const portico = useSyncExternalStore(
    subscribePorticoRuntime,
    getPorticoRuntimeSnapshot,
    getPorticoRuntimeSnapshot,
  )
  const dialogueNode = currentDialogueNode(snapshot.dialogue)
  const dialogueOpen = dialogueNode !== null

  useEffect(() => {
    setGameplayInputLock('dialogue', dialogueOpen)
    if (dialogueOpen && document.pointerLockElement) document.exitPointerLock()
    return () => setGameplayInputLock('dialogue', false)
  }, [dialogueOpen])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return
      if (isGameplayInputLocked()) return
      if (event.code === 'Tab' && !dialogueOpen) {
        event.preventDefault()
        toggleQuestLog()
        return
      }
      if (event.code !== 'KeyE' || dialogueOpen) return
      if (isHollenNearby()) {
        event.preventDefault()
        openHollenDialogue()
      } else if (isKeyNearby()) {
        event.preventDefault()
        lootFrameShelterKey()
      } else if (canUsePorticoKey()) {
        event.preventDefault()
        tryUsePorticoKey()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [dialogueOpen])

  const closeDialogue = useCallback(() => closeHollenDialogue(), [])
  const chooseDialogue = useCallback(
    (choiceId: string) => chooseHollenDialogue(choiceId),
    [],
  )
  const closeQuestLog = useCallback(() => setQuestLogOpen(false), [])
  const currentStep = QUEST.steps[snapshot.quest.currentStep - 1]
  const completed = new Set(snapshot.quest.completedSteps)
  const logSteps = QUEST.steps.map((step) => ({
    id: step.id,
    order: step.order,
    text: step.trackerText,
    completed: completed.has(step.order),
    current:
      !snapshot.quest.complete && step.order === snapshot.quest.currentStep,
  }))

  return (
    <>
      <Hud
        questTracker={{
          text: snapshot.quest.complete ? QUEST.name : currentStep.trackerText,
          hint:
            !snapshot.quest.complete && 'trackerHint' in currentStep
              ? currentStep.trackerHint
              : undefined,
          revision: snapshot.questRevision,
        }}
      />
      <Dialogue
        open={dialogueOpen}
        speaker={dialogueNode?.speaker ?? ''}
        line={dialogueNode?.text ?? ''}
        choices={dialogueNode?.choices ?? []}
        onChoose={chooseDialogue}
        onClose={closeDialogue}
      />
      <QuestLog
        open={snapshot.questLogOpen}
        title={QUEST.name}
        steps={logSteps}
        keyName={FRAME_SHELTER_KEY.name}
        hasKey={snapshot.quest.keyLooted}
        keyUsed={portico.phase !== 'locked'}
        onClose={closeQuestLog}
      />
    </>
  )
}
