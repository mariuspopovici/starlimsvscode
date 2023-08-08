# Type: PowerShell Script
# Description: Creates the SCM_API.sdp file for the backend

# read the extension version from package.json
$jsonData = Get-Content -Raw -Path "..\..\package.json" | ConvertFrom-Json
$new_version = $jsonData.version

# patch the version endpoint script to return the same value
Write-Host "Patching Version.srvscr with version $new_version from package.json ..."
$version_script_file = "SCM_API\Server Scripts\SCM_API\Version.srvscr"
$content = Get-Content -Path "$version_script_file"
$content = $content -replace '(sVersion := ")[^"]*(")', "`${1}$new_version`$2"
Set-Content -Path $version_script_file -Value $content

Write-Host "Generating .sdp file ..."
# create the .sdp package, if exists, overwrite the old zip file
Compress-Archive -Force -Path .\SCM_API\* -DestinationPath .\SCM_API.zip

# if exists, delete the old sdp file
if (Test-Path .\SCM_API.sdp) {
    Remove-Item .\SCM_API.sdp
}

# rename the zip file to sdp
Rename-Item .\SCM_API.zip SCM_API.sdp 
Write-Host "Done."