#/bin/bash

# Deploy to QA

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

#--------------------------------------------------------------------------------------------
# Main branch (QA) Deploy
#--------------------------------------------------------------------------------------------

  echo -en "${GREEN}QA Release...${NC}\n"

  echo -en "${GREEN}make release ...${NC}\n"
  make release

  echo -en "${GREEN}Pushing to builds ...${NC}\n"
  aws s3 cp --content-type="text/javascript" --content-encoding="gzip" dist/build.min.js.gz s3://apparition-builds/web-sdk/apparition-latest.min.js
  aws s3 cp --content-type="text/javascript" dist/build.js s3://apparition-builds/web-sdk/apparition.js

  ./deployment/build-example-html.sh "key_live_qgNPe4TZTuZSoLjPBZdw8w" "https://stg.apparition.link/api" "https://cdn.apparition.link/apparition-staging-latest.min.js"
  # aws s3 cp example.html s3://apparition-cdn/example-staging.html


# Exit prompts
echo -en "${GREEN}Done deploy QA script ...${NC}\n"
