import { useEffect, useMemo, useState } from 'react'

export function useLoadingMessages(intervalMs = 1200) {
  const steps = useMemo(
    () => [
      'Lendo dados',
      'Conectando ao N8N',
      'Verificando IN100',
      'Consultando DataPrev',
      'Sincronizando dashboards',
      'Preparando ambiente'
    ],
    []
  )
  const [index, setIndex] = useState(0)

  useEffect(() => {
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % steps.length)
    }, intervalMs)
    return () => clearInterval(id)
  }, [steps.length, intervalMs])

  return steps[index]
}
