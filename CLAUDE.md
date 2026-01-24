# Bun Patch System

## How Bun Patches Work

Unlike yarn, bun's patch system works differently:

### Creating a Patch

1. **Edit files directly** in `node_modules/package-name/`
2. **Commit the patch** with:
   ```bash
   bun patch --commit package-name@version
   ```
   This will:
   - Generate a patch file in the `patches/` directory
   - Update `package.json` to reference the patch in `patchedDependencies`

### Custom Patch Directory

You can specify a custom patches directory:
```bash
bun patch --commit --patches-dir 'my-patches' 'node_modules/package-name'
```

### Important Notes

- Running `bun patch package-name` **without `--commit` clears the patch**
- Always use `--commit` to save your changes
- Patch files are automatically applied during `bun install`

## Usage Examples

```bash
# 1. Edit files in node_modules/expo/ios/...
# 2. Commit the changes:
bun patch --commit expo@55.0.0-preview.5

# Or with custom directory:
bun patch --commit --patches-dir 'patches' expo@55.0.0-preview.5
```

## Current Patches

### expo@55.0.0-preview.5

**Purpose**: Enable zero-copy ArrayBuffer on iOS for better performance

**Changes**:
- iOS: Modified `ExpoFetchModule.swift` to use `ArrayBuffer.wrap(dataWithoutCopy:)` in the `arrayBuffer()` method
- Android: No patch needed - SDK 55 already uses `directBuffer = true` by default

**Files modified**:
- `ios/Fetch/ExpoFetchModule.swift`

## Expo Doctor Configuration

The project includes custom native modules that may show warnings in `expo-doctor`. To suppress these warnings, add them to the exclusion list in `package.json`:

```json
{
  "expo": {
    "doctor": {
      "reactNativeDirectoryCheck": {
        "exclude": ["react-native-nitro-fetch"]
      }
    }
  }
}
```
