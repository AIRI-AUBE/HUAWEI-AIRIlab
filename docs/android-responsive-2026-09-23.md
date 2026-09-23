# Android responsive layout correction — 2026-09-23

## Failure reproduced

The production stylesheet depends on `dvh`/`lvh` without an effective fallback for its workspace heights. A browser fixture that removes unsupported viewport-unit declarations reproduces the reported tall image-to-image form, non-scrolling sidebar, missing background and text-to-image action below the screen. The device's exact WebView version has not been obtained; this reproduces a compatibility failure rather than proving its installed version.

At a 1024 × 608 CSS viewport, before the fix the image generation button ended at y=1110 and the text generation button at y=665. After the fix they end at y=569 and y=592 respectively.

## Change

`src/viewport.ts` publishes the visible viewport height in pixels, refreshes on window/visual viewport resize (including keyboard changes), and does not reinterpret pinch magnification as a new layout size. The workspace, viewer and narrow-screen panel heights use this property with a standard `vh` fallback. The background retains its proportional cover crop and uses a separate layout-height value. APK version is 0.1.0-test.3 / code 3.

## Verification

- 29 existing contract tests and TypeScript checks pass.
- English: both pages at 1024×608, 1280×752, 960×540, 800×360, 640×360, 390×780, 800×1280 pass in normal and unsupported-viewport-unit modes.
- Chinese: both pages pass the same seven sizes in unsupported-viewport-unit mode.
- No horizontal document overflow; generation actions remain visible; desktop/tablet sidebar content scrolls internally. Narrow phone image-to-image keeps the existing stacked layout with its preview below.
- All browser fixture external network calls are blocked. No paid generation is performed.

Run `node tests/responsive-layout.cjs --legacy` after building. `PLAYWRIGHT_MODULE`, `CHROME_PATH`, `AIRI_QA_OUTPUT`, and `AIRI_QA_LANGUAGE` configure the locally installed browser test runtime, outputs and language. Omit `--legacy` for normal browser capability.

Physical HarmonyOS verification is still required. These browser checks do not certify all historical WebView features or Huawei system UI behavior.

## Packaged APK verification

- Android build and lint completed successfully; APK v2 signature verified.
- Installed test.3 successfully in Android 15 emulator and opened both actual packaged pages.
- At density 320: WebView 1280×744; image/text actions end at y=705/728.
- At density 400: WebView 1024×584; image/text actions end at y=545/568.
- Both densities have no horizontal overflow. Display density restored after checks. Emulator required a reboot to recover an Android system/storage startup failure before app testing.
- APK: Huawei-AIRI-20260923-112202-test.apk
- SHA256: 635BD9C62D9711A9FF989C80EF242F82CABD6CA38A4B259009CAFD1C34874AB4
