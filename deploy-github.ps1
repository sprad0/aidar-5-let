$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Net.Http

$token = $env:GH_TOKEN
$repoName = 'aidar-5-let'
$base = 'https://api.github.com'
$siteDir = $env:SITE_DIR

$handler = New-Object System.Net.Http.HttpClientHandler
$handler.UseProxy = $false
$client = New-Object System.Net.Http.HttpClient($handler)
$client.Timeout = [TimeSpan]::FromSeconds(180)
$client.DefaultRequestHeaders.Add('User-Agent', 'dsh-deploy')
$client.DefaultRequestHeaders.Add('Authorization', "token $token")
$client.DefaultRequestHeaders.Add('Accept', 'application/vnd.github+json')

function Invoke-GitHub([string]$method, [string]$url, $payload) {
  $req = New-Object System.Net.Http.HttpRequestMessage
  $req.Method = New-Object System.Net.Http.HttpMethod($method)
  $req.RequestUri = [Uri]$url
  if ($null -ne $payload) {
    $json = $payload | ConvertTo-Json -Compress -Depth 12
    $req.Content = New-Object System.Net.Http.StringContent($json, [System.Text.Encoding]::UTF8, 'application/json')
  }
  $resp = $client.SendAsync($req).Result
  $body = $resp.Content.ReadAsStringAsync().Result
  $ok = $resp.IsSuccessStatusCode
  $scopes = $null
  if ($resp.Headers.Contains('X-OAuth-Scopes')) { $scopes = $resp.Headers.GetValues('X-OAuth-Scopes') -join ',' }
  return [pscustomobject]@{ ok = $ok; status = [int]$resp.StatusCode; body = $body; scopes = $scopes }
}

# 1. Verify token + get login
$r = Invoke-GitHub 'GET' "$base/user" $null
if (-not $r.ok) { Write-Output ("AUTH FAIL: " + $r.status + " " + $r.body); exit 1 }
$user = $r.body | ConvertFrom-Json
$login = $user.login
Write-Output ("LOGIN: " + $login)
Write-Output ("SCOPES: " + $r.scopes)

# 2. Create repo (ignore already-exists)
$r = Invoke-GitHub 'POST' "$base/user/repos" @{ name = $repoName; description = 'Aydar 5 - birthday invitation'; public = $true; auto_init = $true }
if ($r.ok) { Write-Output "REPO CREATED" } else { Write-Output ("REPO CREATE STATUS " + $r.status + " (continue)") }

# 3. Upload files (skip preview/)
$files = Get-ChildItem -Path $siteDir -Recurse -File | Where-Object { $_.FullName -notlike '*\preview\*' } | ForEach-Object { $_.FullName.Substring($siteDir.Length + 1).Replace('\', '/') } | Sort-Object
foreach ($f in $files) {
  $abs = Join-Path $siteDir ($f.Replace('/', '\'))
  $bytes = [IO.File]::ReadAllBytes($abs)
  $b64 = [Convert]::ToBase64String($bytes)
  $url = "$base/repos/$login/$repoName/contents/$f"
  $r = Invoke-GitHub 'PUT' $url @{ message = "Add $f"; content = $b64; branch = 'main' }
  if ($r.ok) { Write-Output ("OK   " + $f) } else { Write-Output ("FAIL " + $f + " -> " + $r.status + " " + $r.body.Substring(0, [Math]::Min(200, $r.body.Length))) }
}

# 4. Enable GitHub Pages
$r = Invoke-GitHub 'POST' "$base/repos/$login/$repoName/pages" @{ source = @{ branch = 'main'; path = '/' } }
if ($r.ok) { Write-Output "PAGES ENABLED" } else { Write-Output ("PAGES STATUS " + $r.status + " " + $r.body.Substring(0, [Math]::Min(300, $r.body.Length))) }

Write-Output ("SITE_URL=https://" + $login + ".github.io/" + $repoName + "/")
