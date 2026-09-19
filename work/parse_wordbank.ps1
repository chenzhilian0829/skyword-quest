param(
  [Parameter(Mandatory = $false)]
  [string]$SourcePath
)

$ErrorActionPreference = 'Stop'

if (-not $SourcePath) {
  $preferred = 'C:\Users\Administrator\Desktop\单词库.doc'
  if (Test-Path -LiteralPath $preferred) {
    $SourcePath = $preferred
  } else {
    $SourcePath = Get-ChildItem -LiteralPath 'C:\Users\Administrator\Desktop' -File |
      Where-Object Extension -in '.doc', '.docx' |
      Sort-Object LastWriteTime -Descending |
      Select-Object -First 1 -ExpandProperty FullName
  }
}

if (-not $SourcePath -or -not (Test-Path -LiteralPath $SourcePath)) {
  throw '找不到 Word 题库。请使用 -SourcePath 指定 .doc 或 .docx 文件。'
}

$source = (Resolve-Path -LiteralPath $SourcePath).Path
$output = Join-Path $PSScriptRoot '..\src\data\questions.js'

function Test-Chinese([string]$value) {
  return $value -match '[\u4e00-\u9fff]'
}

function Test-English([string]$value) {
  return $value -match '[A-Za-z]' -and -not (Test-Chinese $value)
}

$extracted = Join-Path $PSScriptRoot 'paragraphs.txt'
$word = $null
$document = $null

try {
  $word = New-Object -ComObject Word.Application
  $word.Visible = $false
  $document = $word.Documents.Open($source, $false, $true)
  $lines = @(
    $document.Paragraphs | ForEach-Object {
      ($_.Range.Text -replace '[\r\a]+$', '').Trim()
    }
  )
  [System.IO.File]::WriteAllLines($extracted, $lines, [System.Text.UTF8Encoding]::new($false))
} catch {
  if (-not (Test-Path -LiteralPath $extracted)) { throw }
  $lines = @(Get-Content -LiteralPath $extracted -Encoding UTF8 | ForEach-Object { [string]$_ })
  Write-Warning 'Word automation was unavailable; using the last extraction of the same source document.'
} finally {
  try { if ($document) { $document.Close($false) } } catch {}
  try { if ($word) { $word.Quit() } } catch {}
}

$ignored = @(
  'Story time', 'Fun time', 'Ask and answer', 'Draw and say', 'Stick and say',
  'Picture dictionary', 'Word lists (I)', 'Word lists (II)'
)

$seen = @{}
$pairs = [System.Collections.Generic.List[object]]::new()

for ($i = 0; $i -lt ($lines.Count - 1); $i++) {
  $english = [string]$lines[$i]
  $chinese = [string]$lines[$i + 1]

  if (-not $english -or -not $chinese) { continue }
  if ($english -match '^Unit\s+\d+' -or $english -in $ignored) { continue }
  if (-not (Test-English $english) -or -not (Test-Chinese $chinese)) { continue }

  $key = ($english.ToLowerInvariant() -replace '\s+', ' ').Trim()
  if ($seen.ContainsKey($key)) { continue }
  $seen[$key] = $true

  $pairs.Add([ordered]@{
    id = $pairs.Count + 1
    word = $english
    meaning = $chinese
  })
}

# Every playable level is exactly 20 questions. A short tail is intentionally
# omitted rather than repeating questions, which keeps the user's rule intact.
$playableCount = [Math]::Floor($pairs.Count / 20) * 20
$playable = @($pairs | Select-Object -First $playableCount)
$json = $playable | ConvertTo-Json -Depth 4
$sourceHash = (Get-FileHash -LiteralPath $source -Algorithm SHA256).Hash
$generated = @"
// Generated from the supplied Word document. Do not edit by hand.
export const WORD_BANK_META = {
  source: "Word document",
  sourceSha256: "$sourceHash",
  parsedPairs: $($pairs.Count),
  playableQuestions: $playableCount,
  questionsPerLevel: 20,
  levelCount: $($playableCount / 20)
};

export const QUESTIONS = $json;
"@

$directory = Split-Path -Parent $output
New-Item -ItemType Directory -Force -Path $directory | Out-Null
[System.IO.File]::WriteAllText($output, $generated, [System.Text.UTF8Encoding]::new($false))
Write-Output "Parsed $($pairs.Count) unique pairs; exported $playableCount questions across $($playableCount / 20) levels."
