# Speaks each scene of video_script.json into <OutDir>\<id>.wav with the Windows voice (Microsoft Zira).
param([Parameter(Mandatory)][string]$Script, [Parameter(Mandatory)][string]$OutDir)
Add-Type -AssemblyName System.Speech
$voice = New-Object System.Speech.Synthesis.SpeechSynthesizer
$voice.SelectVoice('Microsoft Zira Desktop')
$voice.Rate = 0
New-Item -ItemType Directory -Force $OutDir | Out-Null
foreach ($scene in (Get-Content $Script -Raw -Encoding utf8 | ConvertFrom-Json)) {
    $voice.SetOutputToWaveFile((Join-Path $OutDir "$($scene.id).wav"))
    $voice.Speak($scene.text)
}
$voice.SetOutputToNull()
$voice.Dispose()
