# AIRI Lab Android build

This branch merges main (948d7f3) into codex/airi-simple while preserving AIRI's light visual identity and logo. It includes the responsive layouts, original-image viewer, native save/share, and disabled generation states.

- App name: AIRI Lab
- Application ID and Java namespace: com.airilab.display
- Version: 0.1.0-test.4 (code 4)
- Can be installed alongside com.airilab.huawei.display.
- Launcher and splash assets use the existing AIRI favicon artwork.
- Development preview: http://localhost:3002/__responsive
- The private .env was copied locally from the Huawei build. Neither credentials nor APKs are tracked by Git.
- Token's declared expiry: 2026-09-30 12:15:06 Asia/Shanghai (not a live authentication check).

Verification: 29 contract tests and TypeScript checks pass. English/Chinese home layouts pass seven sizes; prompt selector passes three sizes with both touch and mouse. Prompt list height is bounded on short screens. Visual QA includes home, both workflows and prompt menu.
