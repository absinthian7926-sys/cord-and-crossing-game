let element: HTMLDivElement | null = null
let timeoutId: number | null = null

export function registerToastElement(next: HTMLDivElement | null): void {
  element = next
}

export function showToast(message: string, durationSeconds: number): void {
  if (timeoutId !== null) window.clearTimeout(timeoutId)
  if (element) {
    element.textContent = message
    element.style.display = 'block'
  }
  timeoutId = window.setTimeout(() => {
    if (element) element.style.display = 'none'
    timeoutId = null
  }, durationSeconds * 1_000)
}

export function clearToast(): void {
  if (timeoutId !== null) window.clearTimeout(timeoutId)
  timeoutId = null
  if (element) element.style.display = 'none'
}
