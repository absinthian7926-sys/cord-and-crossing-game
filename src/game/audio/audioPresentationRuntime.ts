let creditsOpen = false

export function setAudioCreditsOpen(open: boolean): void {
  creditsOpen = open
}

export function isAudioCreditsOpen(): boolean {
  return creditsOpen
}
