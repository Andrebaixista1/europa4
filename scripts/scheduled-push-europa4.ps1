$ErrorActionPreference = 'Stop'

$rootPath = 'D:\Projetos\europa4'
$repo2Path = Join-Path $rootPath 'repo2'
$logPath = Join-Path $rootPath 'scheduled-push.log'
$timestamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
$commitMessage = "chore: scheduled front publish $timestamp"

function Write-Log {
  param([string]$Message)

  $line = "[{0}] {1}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $Message
  Add-Content -Path $logPath -Value $line
}

function Invoke-Git {
  param(
    [string]$Path,
    [string[]]$Arguments
  )

  Write-Log ("git -C `"{0}`" {1}" -f $Path, ($Arguments -join ' '))
  & git -C $Path @Arguments 2>&1 | Tee-Object -FilePath $logPath -Append

  if ($LASTEXITCODE -ne 0) {
    throw "Falha ao executar git -C `"$Path`" $($Arguments -join ' ')"
  }
}

try {
  Write-Log 'Inicio do push agendado.'

  Invoke-Git -Path $repo2Path -Arguments @('checkout', 'main')
  $repo2Status = (& git -C $repo2Path status --porcelain).Trim()
  if ($repo2Status) {
    Invoke-Git -Path $repo2Path -Arguments @('add', '-A')
    Invoke-Git -Path $repo2Path -Arguments @('commit', '-m', $commitMessage)
    Invoke-Git -Path $repo2Path -Arguments @('push', 'origin', 'main')
  } else {
    Write-Log 'repo2 sem alteracoes locais.'
  }

  Invoke-Git -Path $rootPath -Arguments @('checkout', 'main')
  Invoke-Git -Path $rootPath -Arguments @('add', '-A')

  $rootStatus = (& git -C $rootPath diff --cached --name-only) -join "`n"
  if ([string]::IsNullOrWhiteSpace($rootStatus)) {
    Write-Log 'Projeto raiz sem alteracoes para commit.'
  } else {
    Invoke-Git -Path $rootPath -Arguments @('commit', '-m', $commitMessage)
    Invoke-Git -Path $rootPath -Arguments @('push', 'origin', 'main')
  }

  Write-Log 'Push agendado concluido com sucesso.'
} catch {
  Write-Log ("Erro: {0}" -f $_.Exception.Message)
  exit 1
}
