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
