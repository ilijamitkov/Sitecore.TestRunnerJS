param($installPath, $toolsPath, $package, $project)

$projectPath = Split-Path $project.FileName

if (Test-Path "$projectPath\App_Config") {
	Write-Host "TestRunnerJS files location: $toolsPath"
	Write-Host "Installation location: $projectPath"

	Copy-Item -Path "$toolsPath\*" -Destination "$projectPath" -Exclude "*.ps1" -recurse -Force
}