$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Speech

$outputDirectory = Join-Path $PSScriptRoot '..\public'
$outputPath = Join-Path $outputDirectory 'tts-fixture.wav'
$synthesizer = [System.Speech.Synthesis.SpeechSynthesizer]::new()
try {
  $synthesizer.SetOutputToWaveFile($outputPath)
  $synthesizer.Speak('Test participant. Begin the next interval.')
}
finally {
  $synthesizer.Dispose()
}

Write-Output "Generated $outputPath"
