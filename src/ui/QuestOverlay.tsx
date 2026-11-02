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
import { setGameplayInputLocked } from '../game/player/input'
import { Dialogue } from './Dialogue'
import { Hud } from './Hud'
import { QuestLog } from './QuestLog'

export function QuestOverlay() {
  const snapshot = useSyncExternalStore(
    subscribeQuestRuntime,
    getQuestRuntimeSnapshot,
    getQuestRuntimeSnapshot,
  )
  const dialogueNode = currentDialogueNode(snapshot.dialogue)
  const dialogueOpen = dialogueNode !== null

  useEffect(() => {
    setGameplayInputLocked(dialogueOpen)
    if (dialogueOpen && document.pointerLockElement) document.exitPointerLock()
    return () => setGameplayInputLocked(false)
  }, [dialogueOpen])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return
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
        onClose={closeQuestLog}
      />
    </>
  )
}
