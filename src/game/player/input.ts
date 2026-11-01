type KeyName =
  'forward' | 'backward' | 'left' | 'right' | 'run' | 'jump' | 'dodge'
const pressed = new Set<string>()
const consumed = new Set<KeyName>()
const bindings: Record<KeyName, string[]> = {
  forward: ['KeyW'],
  backward: ['KeyS'],
  left: ['KeyA'],
  right: ['KeyD'],
  run: ['ShiftLeft', 'ShiftRight'],
  jump: ['Space'],
  dodge: ['ControlLeft', 'ControlRight', 'KeyC'],
}
const held = (name: KeyName) => bindings[name].some((code) => pressed.has(code))
function keyDown(event: KeyboardEvent) {
  if (Object.values(bindings).flat().includes(event.code)) {
    event.preventDefault()
    pressed.add(event.code)
  }
}
function keyUp(event: KeyboardEvent) {
  pressed.delete(event.code)
  for (const [name, codes] of Object.entries(bindings))
    if (codes.includes(event.code)) consumed.delete(name as KeyName)
}
export function clearInput() {
  pressed.clear()
  consumed.clear()
}
export function attachInput() {
  window.addEventListener('keydown', keyDown)
  window.addEventListener('keyup', keyUp)
  window.addEventListener('blur', clearInput)
}
export function detachInput() {
  window.removeEventListener('keydown', keyDown)
  window.removeEventListener('keyup', keyUp)
  window.removeEventListener('blur', clearInput)
  clearInput()
}
export function inputHeld(name: KeyName) {
  return held(name)
}
export function consumeInput(name: KeyName) {
  if (!held(name) || consumed.has(name)) return false
  consumed.add(name)
  return true
}
