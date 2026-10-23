Set-Location "f:\跑团工具\TableChronicle\character\dnd_5r\upgrade"
$lines = Get-Content "upgrade.js" -Encoding UTF8
$before = $lines[0..366]
$after = $lines[1704..($lines.Count-1)]
$newContent = $before + $after
Set-Content "upgrade.js" -Value $newContent -Encoding UTF8
Write-Host "Done. New line count: $($newContent.Count)"