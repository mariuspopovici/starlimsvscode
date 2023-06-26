#!/usr/bin/env bash
[ -e SCM_API.zip ] && rm SCM_API.zip
cd SCM_API/
zip -r SCM_API.zip . -r
mv SCM_API.zip ../SCM_API.sdp
cd ..