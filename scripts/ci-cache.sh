#!/bin/bash
# these switches turn some bugs into errors
set -o errexit -o pipefail -o noclobber -o nounset

if [[ `git status --porcelain` ]]; then
  echo "Abort: uncommitted changes"
  echo `git status --porcelain`
  echo `git diff`
  exit 1
fi

node ./scripts/fetch-test-info.js

if [[ ! `git status cache --porcelain` ]]; then
  echo "Abort: ran cache script but nothing changed"
fi

# Travis deploy takes care of generating the commit remotely.
# Otherwise we could do something like:
# echo "Adding and committing"
# git add cache/
# git add m4/timeline/index.html
# git commit -m 'Cache artifacts'
