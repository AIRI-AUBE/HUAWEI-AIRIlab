# Android test build

Requires Node 22+, JDK 21, Android SDK platform 36/build-tools 36.0.0/platform-tools. Capacitor core, Android and CLI are pinned together in package.json. Build tools and Gradle caches stay outside Git.

Run from a mapped drive checkout on Windows (npm.cmd cannot use a UNC working directory):

```powershell
npm install
powershell -ExecutionPolicy Bypass -File scripts/package-android.ps1 -JavaHome C:/path/to/jdk-21 -SdkRoot C:/path/to/android-sdk -AllowEmbeddedCredentials
```

The script builds/tests the web app, syncs Android assets, compiles a fresh local copy, then writes a timestamped debug APK and SHA-256 file under the ignored AIRI-Android-YYYY-MM-DD-TEST directory. `-SkipWebBuild` may be used only when dist is already freshly built. Use PowerShell 7 or Windows PowerShell; no administrator privileges are required once the toolchain is installed.

Both Capacitor synchronization and Gradle compilation run locally: synchronization on the SMB checkout produced ENOTEMPTY errors. Optional `-GradleHome C:/path/to/gradle-8.14.3` uses an existing Gradle installation. The wrapper pins the official distribution SHA-256. The first test build used the Huawei Cloud Gradle mirror, verified against that official checksum.

The WebView origin is `http://localhost:3000` because the current API preflight explicitly allows that origin and does not allow Capacitor's default `https://localhost`. Capacitor intercepts the origin and serves bundled assets; no HTTP listener or development server is used on the tablet. Only localhost permits cleartext; remote API traffic remains HTTPS. Do not set `server.url` to the developer PC.

On 2026-09-21, upload, generation and job-status OPTIONS checks returned 204 with this origin allowed. This checks CORS configuration, not token validity or a completed generation. The Back-handler JavaScript closed each template panel in the desktop browser; native navigation still requires device testing.

Huawei branding uses the existing favicon SVG rendered to Android launcher PNGs. The app requests sensorLandscape, uses a native file picker through Capacitor, and handles Back by closing an expanded template, navigating web history, or moving the task to the background. No Google services are required.

Validate with apksigner and aapt, inspect the packaged capacitor.config.json, and complete the physical-device checklist in android-install-zh.md. Debug signatures are for testing; preserve the signing key for upgrades and configure a separate private release key before production distribution. Never commit a signing key, local.properties, copied assets, APKs, or environment files.
