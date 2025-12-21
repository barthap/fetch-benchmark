There's a problem with patches:
https://github.com/oven-sh/bun/issues/13330

Manual way:

- bun install --force
- `rm -rf ios` or `bunx expo prebuild -p ios --clean`

```
cd node_modules/expo-modules-core
patch -p1 < ../../patches/expo-modules-core@3.0.29.patch
```

In patch I made vim substitution:
```
%s/node_modules\/expo-modules-core\//
```
 
