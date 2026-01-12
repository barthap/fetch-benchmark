# Fetch response implementations benchmark for React Native

Recreated benchmarks from [this tweet on X](https://x.com/ddunderfelt/status/1998484818196144291) to compare:

- RN built-in fetch
- [Expo fetch](https://docs.expo.dev/versions/latest/sdk/expo/#expofetch-api)
- [react-native-nitro-fetch](https://github.com/margelo/react-native-nitro-fetch?tab=readme-ov-file)

## Benchmarks

All benchmakrs are defined in [`benchmarks/index.ts`](./benchmarks/index.ts).

### Methodology

- **JSON payload:** Used 50MB json from [this page](https://sample.json-format.com/). It should be placed in the [`fixtures/`](./fixtures/) directory.
- **Localhost hosted** to mitigate networking impact _(some libraries do proecessing during the `await fetch()` call instead of `await response.<<desiredFormat>>()` so networking time could not be fully separated.)__
  - Used `cd fixtures && python3 -m http.server` (or `bun run serve`) for simulator/Localhost.
  - Used [PocketServer](https://apps.apple.com/us/app/pocketserver-folder-sharing/id6743850070) app on physical iOS.
  - The app is also [available on Android](https://play.google.com/store/apps/details?id=com.zdworks.pocketserver).

### Sample results

Some random results are available in the [`screenshots`](./screenshots/) directory.

<img width="300" src="./screenshots/Simulator Screenshot - iPhone 17 Pro - 2025-12-21 at 02.08.58.png" />

## Patched files

In the [`patches`](./patches/) there are two patches:

- `expo` - added zero-copy `arrayBuffer2()` to compare memory copying cost
- `expo-modules-core` - (needed for the above) implementations for native ArrayBuffers that have not been released yet.

---

_This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app). App UI was vibe-coded._
