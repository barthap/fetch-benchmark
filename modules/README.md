# expo-fetch-next Module Setup

This directory contains the "after" implementation for streaming benchmark comparisons — a renamed copy of expo-fetch from the local expo checkout.

## First-Time Setup

### 1. Copy source files

```bash
mkdir -p modules/expo-fetch-next/{ios,android,src}

# Copy the fetch-specific source files from your local expo checkout
rsync -a ~/dev/expo/packages/expo/ios/Fetch/ modules/expo-fetch-next/ios/Fetch/
rsync -a ~/dev/expo/packages/expo/android/src/main/java/expo/modules/fetch/ modules/expo-fetch-next/android/src/main/java/expo/modules/fetchnext/
# Copy JS/TS fetch source files as needed
```

### 2. Rename to avoid conflicts

Rename all public symbols to avoid clashing with the stock expo package:

- **Module name:** `ExpoFetch` -> `ExpoFetchNext`
- **Swift class:** `ExpoFetchModule` -> `ExpoFetchNextModule`
- **Kotlin class:** Same pattern
- **Package name** in `expo-module.config.json`

Create `modules/expo-fetch-next/expo-module.config.json`:
```json
{
  "platforms": ["ios", "android"],
  "ios": {
    "modules": ["ExpoFetchNextModule"]
  },
  "android": {
    "modules": ["expo.modules.fetchnext.ExpoFetchNextModule"]
  }
}
```

Create `modules/expo-fetch-next/index.ts`:
```typescript
// Re-export the patched fetch function
export { fetch } from "./src/fetch";
```

### 3. Generate the rename patch

Keep an unmodified copy for diffing:
```bash
rsync -a ~/dev/expo/packages/expo/ios/Fetch/ /tmp/expo-fetch-next-clean/ios/Fetch/
rsync -a ~/dev/expo/packages/expo/android/src/main/java/expo/modules/fetch/ /tmp/expo-fetch-next-clean/android/

diff -ruN /tmp/expo-fetch-next-clean/ modules/expo-fetch-next/ > modules/renames.patch
```

## Syncing from Upstream

When you want to pull in new changes from your local expo checkout:

```bash
./modules/sync.sh
```

### sync.sh

```bash
#!/bin/bash
set -e

EXPO_DIR="${HOME}/dev/expo/packages/expo"
MODULE_DIR="$(dirname "$0")/expo-fetch-next"

echo "Syncing from ${EXPO_DIR}..."
rsync -a --delete "${EXPO_DIR}/ios/Fetch/" "${MODULE_DIR}/ios/Fetch/"
rsync -a --delete "${EXPO_DIR}/android/src/main/java/expo/modules/fetch/" "${MODULE_DIR}/android/src/main/java/expo/modules/fetchnext/"

echo "Applying rename patches..."
cd "$(dirname "$0")"
patch -p1 < renames.patch

echo "Done! Rebuild the app to pick up changes."
```

Make it executable: `chmod +x modules/sync.sh`

## Usage in Benchmarks

The streaming benchmark screen auto-detects this module:

```typescript
import { fetch as expoFetchNext } from "expo-fetch-next";
```

If the module is not installed, the "After (patched)" toggle in the UI will be disabled.
