const toErrorMessage = (response, payloadText = '') => {
  const trimmed = String(payloadText || '').trim()
  if (trimmed) return trimmed
  return `HTTP ${response.status}`
}

export const safeParseJson = (value) => {
  if (typeof value !== 'string') return null
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

export const unwrapSqlEnvelope = (payload) => {
  if (!Array.isArray(payload) || payload.length !== 1) return payload
  const first = payload[0]
  if (!first || typeof first !== 'object') return payload
  const jsonKey = Object.keys(first).find((key) => key.toUpperCase().startsWith('JSON_'))
  if (!jsonKey || typeof first[jsonKey] !== 'string') return payload
  const parsed = safeParseJson(first[jsonKey])
  return parsed ?? payload
}

export async function fetchText(url, options = {}) {
  const response = await fetch(url, options)
  const text = await response.text()
  if (!response.ok) {
    throw new Error(toErrorMessage(response, text))
  }
  return text
}

export async function fetchJson(url, options = {}) {
  const text = await fetchText(url, options)
  if (!String(text || '').trim()) return null
  const parsed = safeParseJson(text)
  if (parsed === null) {
    throw new Error('Resposta invalida (JSON esperado).')
  }
  return parsed
}

