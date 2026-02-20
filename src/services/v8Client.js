const parseJsonResponse = async (resp) => {
  const text = await resp.text()
  let data
  try {
    data = text ? JSON.parse(text) : {}
  } catch {
    data = { ok: false, error: text }
  }
  return { text, data }
}

const extractJobId = (payload) => {
  if (!payload || typeof payload !== 'object') return ''
  const direct = payload?.jobId ?? payload?.job_id ?? payload?.id ?? ''
  const nested = payload?.data && typeof payload.data === 'object'
    ? (payload.data?.jobId ?? payload.data?.job_id ?? payload.data?.id ?? '')
    : ''
  const value = direct || nested
  return String(value ?? '').trim()
}

const normalizeStatusToken = (value) => {
  return String(value ?? '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

export async function importarCsvV8({
  csv,
  nomeArquivo,
  empresa,
  tokenUsado,
  idTokenUsado,
  idUser,
}) {
  const resp = await fetch('/api/clientes-v8/import-csv', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      nomeArquivo,
      empresa,
      token_usado: tokenUsado,
      id_token_usado: idTokenUsado,
      id_user: idUser,
      csv,
    }),
  })

  const { data } = await parseJsonResponse(resp)
  if (![200, 201, 202].includes(resp.status) || data?.ok === false) {
    throw new Error(data?.error || `HTTP ${resp.status}`)
  }

  const jobId = extractJobId(data)
  return {
    ok: true,
    statusCode: resp.status,
    accepted: resp.status === 202,
    jobId,
    data,
  }
}

export async function consultarImportacaoCsvV8Status({ jobId }) {
  const id = String(jobId ?? '').trim()
  if (!id) throw new Error('jobId obrigatório para consultar status.')

  const params = new URLSearchParams()
  params.set('jobId', id)
  const resp = await fetch(`/api/clientes-v8/import-status?${params.toString()}`, { method: 'GET' })
  const { data } = await parseJsonResponse(resp)
  if (!resp.ok || data?.ok === false) {
    throw new Error(data?.error || `HTTP ${resp.status}`)
  }

  const statusToken = normalizeStatusToken(
    data?.status ??
    data?.state ??
    data?.situacao ??
    data?.jobStatus ??
    data?.data?.status ??
    ''
  )
  const done = ['done', 'completed', 'concluido', 'concluido_com_sucesso', 'success', 'sucesso'].some((k) => statusToken.includes(k))
  const failed = ['error', 'erro', 'failed', 'falha'].some((k) => statusToken.includes(k))
  const pending = !done && !failed

  return {
    ok: true,
    statusCode: resp.status,
    jobId: extractJobId(data) || id,
    pending,
    done,
    failed,
    statusToken,
    data,
  }
}
