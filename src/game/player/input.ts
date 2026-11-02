export type KeyName =
  | 'forward'
  | 'backward'
  | 'left'
  | 'right'
  | 'run'
  | 'jump'
  | 'dodge'
  | 'recall'
  | 'closeStrike'
  | 'aim'
  | 'interact'
  | 'questLog'

const pressed = new Set<string>()
const consumed = new Set<KeyName>()
const released = new Set<KeyName>()
let gameplayInputLocked = false
const bindings: Record<KeyName, readonly string[]> = {
  forward: ['KeyW'],
  backward: ['KeyS'],
  left: ['KeyA'],
  right: ['KeyD'],
  run: ['ShiftLeft', 'ShiftRight'],
  jump: ['Space'],
  dodge: ['ControlLeft', 'ControlRight', 'KeyC'],
  recall: ['KeyQ'],
  closeStrike: ['Mouse0'],
  aim: ['Mouse2'],
  interact: ['KeyE'],
  questLog: ['Tab'],
}
const boundCodes = new Set(Object.values(bindings).flat())

const held = (name: KeyName) => bindings[name].some((code) => pressed.has(code))

function pressCode(code: string): void {
  if (boundCodes.has(code)) pressed.add(code)
}

function releaseCode(code: string): void {
  pressed.delete(code)
  for (const [name, codes] of Object.entries(bindings)) {
    if (codes.includes(code)) {
      const keyName = name as KeyName
      consumed.delete(keyName)
      released.add(keyName)
    }
  }
}

function keyDown(event: KeyboardEvent) {
  if (!boundCodes.has(event.code)) return
  event.preventDefault()
  pressCode(event.code)
}

function keyUp(event: KeyboardEvent) {
  releaseCode(event.code)
}

function mouseDown(event: MouseEvent) {
  const code = `Mouse${event.button}`
  if (!boundCodes.has(code)) return
  event.preventDefault()
  pressCode(code)
}

function mouseUp(event: MouseEvent) {
  releaseCode(`Mouse${event.button}`)
}

function preventContextMenu(event: MouseEvent) {
  event.preventDefault()
}

export function clearInput() {
  pressed.clear()
  consumed.clear()
  released.clear()
}

export function setGameplayInputLocked(locked: boolean): void {
  if (gameplayInputLocked === locked) return
  gameplayInputLocked = locked
  clearInput()
}

export function isGameplayInputLocked(): boolean {
  return gameplayInputLocked
}

export function attachInput() {
  window.addEventListener('keydown', keyDown)
  window.addEventListener('keyup', keyUp)
  window.addEventListener('mousedown', mouseDown)
  window.addEventListener('mouseup', mouseUp)
  window.addEventListener('contextmenu', preventContextMenu)
  window.addEventListener('blur', clearInput)
}

export function detachInput() {
  window.removeEventListener('keydown', keyDown)
  window.removeEventListener('keyup', keyUp)
  window.removeEventListener('mousedown', mouseDown)
  window.removeEventListener('mouseup', mouseUp)
  window.removeEventListener('contextmenu', preventContextMenu)
  window.removeEventListener('blur', clearInput)
  clearInput()
}

export function inputHeld(name: KeyName) {
  return !gameplayInputLocked && held(name)
}

export function consumeInput(name: KeyName) {
  if (gameplayInputLocked || !held(name) || consumed.has(name)) return false
  consumed.add(name)
  return true
}

export function consumeReleased(name: KeyName) {
  if (gameplayInputLocked || !released.has(name)) return false
  released.delete(name)
  return true
}

export function isDoubleTap(
  previousTapSeconds: number,
  currentTapSeconds: number,
  windowSeconds: number,
): boolean {
  const elapsed = currentTapSeconds - previousTapSeconds
  return (
    Number.isFinite(previousTapSeconds) &&
    elapsed >= 0 &&
    elapsed <= windowSeconds + Number.EPSILON
  )
}
