const BLOCK_MESSAGE = 'API desabilitada neste ambiente. Apenas login/reset e backups estao ativos.'

const isAllowedPath = (path) => {
  if (!path) return false

  if (path === '/webhook/login45') return true
  if (path === '/webhook/api/reset') return true
  if (path.startsWith('/api/health-consult')) return true

  return false
}

const normalizeInputToUrl = (input) => {
  if (typeof input === 'string') return input
  if (input instanceof URL) return input.toString()
  if (input && typeof input.url === 'string') return input.url
  return ''
}

const buildBlockedResponse = () =>
  new Response(
    JSON.stringify({
      success: false,
      message: BLOCK_MESSAGE,
    }),
    {
      status: 503,
      headers: {
        'Content-Type': 'application/json',
      },
    }
  )

export const installFetchPolicy = () => {
  if (typeof window === 'undefined') return
  if (window.__neFetchPolicyInstalled) return

  const nativeFetch = window.fetch.bind(window)

  window.fetch = async (input, init) => {
    const rawUrl = normalizeInputToUrl(input)
    if (!rawUrl) return nativeFetch(input, init)

    let pathname = ''
    try {
      const absolute = new URL(rawUrl, window.location.origin)
      pathname = absolute.pathname
    } catch {
      return nativeFetch(input, init)
    }

    if (!isAllowedPath(pathname)) {
      return buildBlockedResponse()
    }

    return nativeFetch(input, init)
  }

  window.__neFetchPolicyInstalled = true
}

