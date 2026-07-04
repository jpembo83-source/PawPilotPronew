#!/bin/sh
# Xcode Cloud bootstrap: runs on Apple's build machines right after the
# repo is cloned, before the iOS project is built. Installs Node, builds
# the web bundle, and syncs it into the iOS project — the same steps a
# developer runs locally before archiving. Client config comes from the
# committed .env.production (public values only).
set -e

export HOMEBREW_NO_AUTO_UPDATE=1
export HOMEBREW_NO_INSTALL_CLEANUP=1
brew install node@22 || brew install node
export PATH="/opt/homebrew/opt/node@22/bin:/usr/local/opt/node@22/bin:$PATH"
node --version
npm --version

cd "$CI_PRIMARY_REPOSITORY_PATH/PawPilotPro/portal"
npm ci
npm run build
npx cap sync ios
