# Android test APK verification — 2026-09-21

- APK: Huawei-AIRI-20260921-183800-test.apk; 80,643,384 bytes.
- SHA-256: 4591f0bce4ff6e7d02e516eed25cf3338cfe5db65491818d9a5bf8bed882e5d0
- Web TypeScript checks and 27 contract tests passed; Vite production build passed.
- Android assembleDebug passed; app lintDebug passed after correcting local SDK property escaping. 32 non-blocking warnings remain (scaffold resources/icons, newer tooling recommendations, backup policy and Android 16 orientation behavior).
- apksigner verified APK Signature Scheme v2, Android Debug signer.
- Package com.airilab.huawei.display, version 0.1.0-test.1, minimum API 24, target API 36.
- Manifest confirmed sensorLandscape, adjustResize, allowBackup=false; debug build.
- All 101 dist files found in APK with matching sizes. Bundled config has no server.url; local origin http://localhost:3000.
- Upload/generation/status CORS preflight passed for the packaged origin. No paid generation was triggered by packaging verification.
- Both template close callbacks verified in desktop browser.
- ADB reports no connected device. Actual HarmonyOS 4.2 installation, Huawei WebView rendering, image selection, keyboard and full generation remain pending on the target MatePad.
