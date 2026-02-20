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

  const text = await resp.text()
  let data
  try {
    data = JSON.parse(text)
  } catch {
    data = { ok: false, error: text }
  }

  if (!resp.ok || data?.ok === false) {
    throw new Error(data?.error || `HTTP ${resp.status}`)
  }

  return data
}
