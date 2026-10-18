param(
  [string]$BaseUrl = 'http://127.0.0.1:4173',
  [string]$NftId = '1'
)

$ErrorActionPreference = 'Stop'
$root = (Get-Location).Path
$folder = Join-Path $root 'reports\lighthouse'
New-Item -ItemType Directory -Path $folder -Force | Out-Null

try {
  $response = Invoke-WebRequest -Uri $BaseUrl -Method Get -TimeoutSec 10 -UseBasicParsing
  if ($response.StatusCode -ne 200) { throw "Status HTTP $($response.StatusCode)" }
} catch {
  throw "Inicie o preview do Vite em outro terminal: npm.cmd run preview -- --host 127.0.0.1. Erro: $_"
}

$definitions = @(
  @{ Page='inicio'; Device='mobile'; Url="$BaseUrl/" },
  @{ Page='inicio'; Device='desktop'; Url="$BaseUrl/" },
  @{ Page='detalhe'; Device='mobile'; Url="$BaseUrl/nft/$NftId" },
  @{ Page='detalhe'; Device='desktop'; Url="$BaseUrl/nft/$NftId" }
)

$rows = @()
foreach ($item in $definitions) {
  for ($i=1; $i -le 3; $i++) {
    $base = Join-Path $folder "$($item.Page)-$($item.Device)-$i"
    $args = @(
      'lighthouse', $item.Url,
      '--quiet', '--chrome-flags=--headless=new',
      '--only-categories=performance,accessibility,best-practices,seo',
      '--output=json', '--output=html', "--output-path=$base"
    )
    if ($item.Device -eq 'desktop') { $args += '--preset=desktop' }
    Write-Host "Auditoria: $($item.Page) / $($item.Device) / $i de 3"
    & npx.cmd @args
    if ($LASTEXITCODE -ne 0) { throw "Lighthouse falhou em $($item.Page)/$($item.Device)/$i (código $LASTEXITCODE)" }
    $jsonPath = "$base.report.json"
    if (-not (Test-Path $jsonPath)) { throw "Relatório JSON não localizado: $jsonPath" }
    $report = Get-Content $jsonPath -Raw | ConvertFrom-Json
    $rows += [pscustomobject]@{
      Pagina = $item.Page
      Perfil = $item.Device
      Execucao = $i
      Performance = [math]::Round($report.categories.performance.score * 100)
      Acessibilidade = [math]::Round($report.categories.accessibility.score * 100)
      BoasPraticas = [math]::Round($report.categories.'best-practices'.score * 100)
      SEO = [math]::Round($report.categories.seo.score * 100)
      LCP_ms = [math]::Round($report.audits.'largest-contentful-paint'.numericValue)
      CLS = [math]::Round($report.audits.'cumulative-layout-shift'.numericValue, 4)
      TBT_ms = [math]::Round($report.audits.'total-blocking-time'.numericValue)
    }
  }
}

$rows | Export-Csv -Path (Join-Path $folder 'medicoes.csv') -NoTypeInformation -Encoding UTF8
function Median([double[]]$values) {
  $sorted = @($values | Sort-Object)
  $count = $sorted.Count
  if ($count % 2 -eq 1) { return $sorted[[int][math]::Floor($count / 2)] }
  return ($sorted[$count / 2 - 1] + $sorted[$count / 2]) / 2
}

$summary = @()
foreach ($item in $definitions) {
  $set = @($rows | Where-Object { $_.Pagina -eq $item.Page -and $_.Perfil -eq $item.Device })
  $summary += [pscustomobject]@{
    Pagina = $item.Page
    Perfil = $item.Device
    Performance = Median @($set | ForEach-Object { [double]$_.Performance })
    Acessibilidade = Median @($set | ForEach-Object { [double]$_.Acessibilidade })
    BoasPraticas = Median @($set | ForEach-Object { [double]$_.BoasPraticas })
    SEO = Median @($set | ForEach-Object { [double]$_.SEO })
    LCP_ms = Median @($set | ForEach-Object { [double]$_.LCP_ms })
    CLS = Median @($set | ForEach-Object { [double]$_.CLS })
    TBT_ms = Median @($set | ForEach-Object { [double]$_.TBT_ms })
  }
}
$summary | Export-Csv -Path (Join-Path $folder 'medianas.csv') -NoTypeInformation -Encoding UTF8
$summary | Format-Table -AutoSize
Write-Host "Relatórios HTML/JSON e CSV salvos em $folder"
