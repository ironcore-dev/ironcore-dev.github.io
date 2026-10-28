import { test } from 'node:test'
import assert from 'node:assert/strict'
import { normalizeEventUrl } from './analytics.ts'

test('normalizeEventUrl unifies page paths', () => {
  const cases: Array<[string, string]> = [
    ['https://ironcore.dev', 'https://ironcore.dev/'],
    ['https://ironcore.dev/index.html', 'https://ironcore.dev/'],
    ['https://ironcore.dev/overview', 'https://ironcore.dev/overview/'],
    ['https://ironcore.dev/overview/index.html', 'https://ironcore.dev/overview/'],
    ['https://ironcore.dev/iaas/getting-started.html', 'https://ironcore.dev/iaas/getting-started/'],
    ['https://ironcore.dev/iaas/getting-started.html#top', 'https://ironcore.dev/iaas/getting-started/#top'],
    ['https://ironcore.dev/og-ironcore.png', 'https://ironcore.dev/og-ironcore.png'],
    ['not a url', 'not a url'],
  ]
  for (const [input, want] of cases) assert.equal(normalizeEventUrl(input), want)
})
