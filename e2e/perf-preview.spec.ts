import { expect, test, type Page } from '@playwright/test'

function isPerfChunk(url: string): boolean {
  return /\/assets\/PerfOverlay-[^/]+\.js(?:\?|$)/.test(url)
}

async function collectPerfChunkRequests(
  page: Page,
  path: string,
): Promise<string[]> {
  const requests: string[] = []
  page.on('request', (request) => {
    if (isPerfChunk(request.url())) requests.push(request.url())
  })
  await page.goto(path)
  return requests
}

test('production preview omits the perf readout without the query flag', async ({
  page,
}) => {
  const requests = await collectPerfChunkRequests(page, '/')

  await expect(
    page.getByRole('heading', { name: 'Cord and Crossing' }),
  ).toBeVisible()
  await expect(page.getByLabel('Performance statistics')).toHaveCount(0)
  expect(requests).toEqual([])
})

test('production preview loads and shows the perf readout with perf=1', async ({
  page,
}) => {
  const requests = await collectPerfChunkRequests(page, '/?perf=1')
  const overlay = page.getByLabel('Performance statistics')

  await expect(overlay).toBeVisible()
  await expect(overlay).toContainText('fps')
  await expect(overlay).toContainText('ms mean')
  await expect(overlay).toContainText('ms p95')
  await expect(overlay).toContainText('fps 1% low')
  await expect(overlay).toContainText('draws')
  await expect(overlay).toContainText('tris')
  await expect(overlay).toContainText('tier')
  await expect(overlay).toContainText('dpr')
  await expect(overlay).toContainText('scene')
  expect((await overlay.textContent())?.split('\n').at(-1)).toBeTruthy()
  expect(requests).toHaveLength(1)
})
