# Huawei tablet test APK implementation plan

Goal: produce a signed debug APK for the user's MatePad DBR-W10 running HarmonyOS 4.2, based on the approved Huawei main-branch UI.

Architecture: package the existing React/Vite dist in Capacitor Android, without a remote development server. Retain existing HTTPS upload/generation requests and embedded internal-display configuration. No dependency on Google services or Node.js on the tablet.

Approved design: the preceding conversation approved a landscape test APK, bundled web assets, native file selection, Android back navigation and device verification before release.

- [x] Provision local JDK and Android SDK command-line build tools; keep caches outside the repository.
- [x] Add pinned matching Capacitor core/CLI/Android dependencies and config with webDir dist; generate Android scaffold.
- [x] Configure Huawei display identity, landscape orientation and local assets. Keep existing UI and red branding.
- [x] Add reproducible build instructions/scripts, ignore native build products, local SDK paths, credentials and APK artifacts.
- [x] Run existing tests/build, synchronize web assets and assemble a debug APK from a local build copy.
- [x] Verify APK signature, manifest, bundled assets and absence of development-server configuration; deliver APK plus Chinese install/test instructions.

Checks: image file selection/multiple selection, HTTPS API origin/CORS, older Huawei WebView CSS/JS support, system back navigation and keyboard layout. Physical-device checks remain explicitly pending unless a device is connected. Preserve the internal-package credential authorization; never print token values. Do not claim device compatibility from compilation alone.
