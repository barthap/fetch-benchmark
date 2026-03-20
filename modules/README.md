# expo-fetch-next Module Setup

This directory contains the "after" implementation for streaming benchmark comparisons — a renamed copy of the `expo` package from the local expo checkout.

## First-Time Setup

### 1. Copy the entire expo package

```bash
cp -r ~/dev/expo/packages/expo ./modules/expo-fetch-next
```

### 2. Rename to avoid conflicts

Delete files that conflict with the stock `expo` package (keep only what's needed for fetch). Then rename all public symbols:

- **Module name:** `ExpoFetch` → `ExpoFetchNext`
- **Swift class/module:** `ExpoFetchModule` → `ExpoFetchNextModule`
- **Kotlin package:** `expo.modules.fetch` → `expo.modules.fetch.next`
- **Kotlin class:** `ExpoFetchModule` → `ExpoFetchNextModule`
- **Podspec:** renamed to `ExpoNext.podspec`

Update `modules/expo-fetch-next/expo-module.config.json`:
```json
{
  "platforms": ["apple", "android"],
  "apple": {
    "modules": ["ExpoFetchNextModule"],
    "podspecPath": "ExpoNext.podspec"
  },
  "android": {
    "modules": ["expo.modules.fetch.next.ExpoFetchNextModule"]
  }
}
```

### 3. Add tsconfig path mapping

In the project root `tsconfig.json`, add:
```json
{
  "compilerOptions": {
    "paths": {
      "expo-fetch-next": ["./modules/expo-fetch-next"],
      "expo-fetch-next/*": ["./modules/expo-fetch-next/*"]
    }
  }
}
```

### 4. Generate the rename patch

Diff against the original expo package to capture all renames:
```bash
diff -ruN ~/dev/expo/packages/expo/ modules/expo-fetch-next/ > modules/renames.patch
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
rsync -a --delete "${EXPO_DIR}/" "${MODULE_DIR}/"

echo "Applying rename patches..."
cd "$(dirname "$0")"
patch -p0 < renames.patch

echo "Done! Rebuild the app to pick up changes."
```

Make it executable: `chmod +x modules/sync.sh`

This uses `rsync --delete` to mirror the upstream expo package (adding new files, updating changed ones, removing deleted ones), then re-applies the rename patch on top.

## Usage in Benchmarks

```typescript
// "After" (patched) implementation
import { fetch as expoFetchNext } from "expo-fetch-next/fetch";

// "Before" (stock) implementation
import { fetch as expoFetch } from "expo/fetch";
```

The streaming benchmark screen auto-detects this module. If not installed, the "After (patched)" toggle is disabled.
