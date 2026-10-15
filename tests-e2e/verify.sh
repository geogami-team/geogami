#!/usr/bin/env bash
# One command to check the app: production build, unit tests, browser smoke tests.
# Run it from anywhere:  bash tests-e2e/verify.sh      (or `yarn verify` in geogami-ui)
# Use it before and after every dependency/framework upgrade step.
#
# Node versions: the build and unit tests run on the version in .nvmrc — the one Netlify
# builds with — and the browser tests on Node 18+ (Playwright's minimum). Both are picked
# through nvm when it is installed; otherwise the current `node` is used for everything.
set -euo pipefail
cd "$(dirname "$0")/.."

APP_NODE="$(tr -d '[:space:]' < .nvmrc)"
E2E_NODE="18"

NVM_SH="${NVM_DIR:-$HOME/.nvm}/nvm.sh"
use_node() {
  if [ -s "$NVM_SH" ]; then
    set +u # nvm.sh is not written for `set -u`
    # shellcheck disable=SC1090
    . "$NVM_SH" --no-use
    if ! nvm use --silent "$1" >/dev/null; then
      echo "Node $1 is not installed: run \`nvm install $1\` and try again." >&2
      exit 1
    fi
    set -u
  else
    echo "nvm not found, using $(node -v) instead of Node $1" >&2
  fi
  echo "    (Node $(node -v))"
}

if [ -z "${CHROME_BIN:-}" ] && [ -x "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" ]; then
  export CHROME_BIN="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
fi

use_node "$APP_NODE"
export NODE_OPTIONS="${NODE_OPTIONS:-} --max-old-space-size=6144"
# Only needed when the app is built on Node >= 17 (no nvm); Node 16 rejects the flag.
if node -e 'process.exit(Number(process.versions.node.split(".")[0]) >= 17 ? 0 : 1)'; then
  export NODE_OPTIONS="$NODE_OPTIONS --openssl-legacy-provider"
fi

echo "==> 1/3 production build"
npx ng build --configuration production

echo "==> 2/3 unit tests"
npx ng test --watch=false --browsers=ChromeHeadless --progress=false

echo "==> 3/3 browser smoke tests"
use_node "$E2E_NODE"
unset NODE_OPTIONS
cd tests-e2e
yarn install --frozen-lockfile --silent
npx playwright test
