// Plausible analytics wiring for the IronCore docs.
// Ported from gardener/documentation (.vitepress/theme/utils/analytics.ts).
// Cookieless: no per-user session chaining, no persistent identifiers, no PII.
import type { Router } from 'vitepress'
import type { track as trackFn } from '@plausible-analytics/tracker'

type Track = typeof trackFn

/** Report client-side 404s so broken links surface in the dashboard. */
function trackNotFound(router: Router, track: Track): void {
  const prev = router.onAfterRouteChanged
  router.onAfterRouteChanged = (to) => {
    if (router.route.data.isNotFound) {
      // Same path form as pageviews, without query or hash, so one missing page is reported once.
      track('404', { props: { path: new URL(normalizeEventUrl(location.href)).pathname }, interactive: false })
    }
    return prev?.(to)
  }
}

/**
 * Report each page under the URL the site itself links to (no cleanUrls): pages as `/foo.html`,
 * folders as `/foo/`, so `/foo`, `/foo.html` and `/foo/index.html` do not split metrics and every
 * dashboard path opens a real page. GitHub Pages redirects `/folder` to `/folder/` before any JS runs,
 * so an extensionless path without a trailing slash is always a page.
 */
function normalizeEventUrl(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl)
    if (parsed.pathname.endsWith('/index.html')) {
      parsed.pathname = parsed.pathname.slice(0, -'index.html'.length)
    } else if (!parsed.pathname.endsWith('/') && !/\.[a-z0-9]+$/i.test(parsed.pathname)) {
      parsed.pathname += '.html'
    }
    return parsed.toString()
  } catch {
    return rawUrl
  }
}

export function initAnalytics(router: Router): Promise<void> {
  // Return the promise so enhanceApp can await it before VitePress runs the
  // initial navigation; otherwise the 404 hook can be installed too late to
  // catch a direct hit on a non-existent route.
  return import('@plausible-analytics/tracker').then(({ init, track }) => {
    init({
      domain: 'ironcore.dev',
      // GitHub Pages has no proxy, so events go to the default https://plausible.io/api/event
      outboundLinks: true,
      transformRequest: (payload) => ({
        ...payload,
        u: normalizeEventUrl(payload.u),
      }),
    })
    trackNotFound(router, track)
  })
}
