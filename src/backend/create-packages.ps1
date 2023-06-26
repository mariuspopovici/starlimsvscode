# Type: PowerShell Script
# Description: Creates the SCM_API.sdp file for the backend

# if exists, delete the old zip file
Compress-Archive -Path .\SCM_API\* -DestinationPath .\SCM_API.zip

# if exists, delete the old sdp file
if (Test-Path .\SCM_API.sdp) {
    Remove-Item .\SCM_API.sdp
}

# rename the zip file to sdp
Rename-Item .\SCM_API.zip SCM_API.sdp 
