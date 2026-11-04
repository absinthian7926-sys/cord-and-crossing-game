import { expect, type Page } from '@playwright/test'

export type StartGameOptions = {
  readonly newGame?: boolean
  readonly url?: string
  readonly waitForDebugHook?: boolean
}

async function chooseStartAction(
  page: Page,
  options: StartGameOptions = {},
): Promise<void> {
  await expect(
    page.getByRole('heading', { name: 'Cord and Crossing' }),
  ).toBeVisible()

  const continueButton = page.getByRole('button', { name: 'Continue' })
  const hasContinue = await continueButton.isVisible()
  if (options.newGame || !hasContinue) {
    await page.getByRole('button', { name: 'New game' }).click()
    const restartButton = page.getByRole('button', { name: 'Restart' })
    if (await restartButton.isVisible()) await restartButton.click()
  } else {
    await continueButton.click()
  }

  await expect(page.locator('canvas')).toBeVisible()
  if (options.waitForDebugHook !== false)
    await page.waitForFunction(
      () => window.__CORD_AND_CROSSING_DEBUG__ !== undefined,
    )
}

export async function startGame(
  page: Page,
  options: StartGameOptions = {},
): Promise<void> {
  await page.goto(options.url ?? '/')
  await chooseStartAction(page, options)
}

export async function resumeGameAfterReload(
  page: Page,
  options: Omit<StartGameOptions, 'newGame' | 'url'> = {},
): Promise<void> {
  await page.reload()
  await chooseStartAction(page, options)
}
