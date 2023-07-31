#!/usr/bin/env bash

# Get the new version from package.json
new_version=$(grep -E '"version":' ../../package.json | awk -F '"' '{print $4}' | sed 's/^v//')

# Use sed to replace the sVersion value in the Version endpoint script
printf  "Patching Version.srvscr with version $new_version from package.json\n"
version_script_file="./SCM_API/Server Scripts/SCM_API/Version.srvscr"
sed -i -r "s/(sVersion := \")([^\"]*)(\")/\1$new_version\3/" "$version_script_file"

printf "Generating SCM_API.sdp\n"

# Package the backend scripts into a .sdp file
[ -e SCM_API.zip ] && rm SCM_API.zip
cd SCM_API/
zip -r SCM_API.zip . -r
mv SCM_API.zip ../SCM_API.sdp
cd ..