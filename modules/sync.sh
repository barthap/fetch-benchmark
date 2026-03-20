#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
EXPO_DIR="${HOME}/dev/expo/packages/expo"
MODULE_DIR="${SCRIPT_DIR}/expo-fetch-next"

echo "=== Syncing fetch sources from upstream expo ==="

# 1. Sync iOS fetch sources
echo "Syncing iOS sources..."
rsync -a --delete "${EXPO_DIR}/ios/Fetch/" "${MODULE_DIR}/ios/Fetch/"

# 2. Sync Android fetch sources (upstream .../fetch/ → local .../fetch/next/)
echo "Syncing Android sources..."
rsync -a --delete "${EXPO_DIR}/android/src/main/java/expo/modules/fetch/" "${MODULE_DIR}/android/src/main/java/expo/modules/fetch/next/"

# 3. Sync TS fetch sources
echo "Syncing TS sources..."
rsync -a --delete "${EXPO_DIR}/src/winter/fetch/" "${MODULE_DIR}/src/winter/fetch/"

# 4. Apply renames
echo "Applying renames..."

# iOS: rename class and file
mv "${MODULE_DIR}/ios/Fetch/ExpoFetchModule.swift" "${MODULE_DIR}/ios/Fetch/ExpoFetchNextModule.swift"
sed -i '' 's/ExpoFetchModule/ExpoFetchNextModule/g' "${MODULE_DIR}/ios/Fetch/ExpoFetchNextModule.swift"

# Android: rename class + module name, fix package declaration
sed -i '' 's/^package expo\.modules\.fetch$/package expo.modules.fetch.next/' "${MODULE_DIR}/android/src/main/java/expo/modules/fetch/next/"*.kt
sed -i '' 's/ExpoFetchModule/ExpoFetchNextModule/g' "${MODULE_DIR}/android/src/main/java/expo/modules/fetch/next/ExpoFetchModule.kt"
mv "${MODULE_DIR}/android/src/main/java/expo/modules/fetch/next/ExpoFetchModule.kt" "${MODULE_DIR}/android/src/main/java/expo/modules/fetch/next/ExpoFetchNextModule.kt"

# TS: rename native module reference
sed -i '' "s/'ExpoFetchModule'/'ExpoFetchNextModule'/g" "${MODULE_DIR}/src/winter/fetch/ExpoFetchModule.ts"

echo "Done! Rebuild the app to pick up changes."
