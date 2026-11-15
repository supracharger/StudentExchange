# Student Exchange — mobile demo

A first-pass Expo / React Native project for Android and iOS, with startup, welcome, and login screens. Includes a dependency-free browser preview of the same proposed flow.

## Try it immediately

Open `preview/index.html` in a browser, or open the separately supplied `student-exchange-preview.html`. No installation, server, or internet connection is needed. If a mobile file viewer displays source code instead of running HTML, open the file in a desktop browser.

Follow Continue through the three welcome screens, or select Login screen. Choose **Fill demo account**, then **Log in**. **Explore the demo** bypasses the form. Both lead to a sample success screen; the marketplace itself is not implemented.

Public sample credentials:

- Email: `demo@studentexchange.test`
- Password: `CampusDemo!23`

These credentials are only for this local demo and do not access the existing website. Do not enter real credentials. No account is created, no emails are sent, and no backend calls are made.

## Run the native project

Install Node.js 20.19 or later, then in this folder:

```bash
npm install
npx expo install --fix
npm test
npm start
```

Use an Expo Go version compatible with the project's SDK, or a development build. The source is pinned to **Expo SDK 54 / React Native 0.81 / React 19.1**, following the SDK compatibility matrix at https://docs.expo.dev/versions/v54.0.0/. It is a reproducible demo baseline, not a claim that SDK 54 is the newest release. `expo install --fix` aligns package patches; it does not upgrade the SDK major version.

The iOS App Store version of Expo Go may support a newer SDK. If it rejects this project, upgrade the project using Expo's SDK upgrade guide (https://docs.expo.dev/workflow/upgrading-expo-sdk-walkthrough/), or use an SDK-compatible development build. After upgrading, rerun `npx expo install --fix` and test both platforms.

- **Android phone:** open the project in compatible Expo Go, or use a development build.
- **iPhone/iPad:** open it in compatible Expo Go, or use a signed development build.
- **Android emulator:** start the emulator, then `npm run android`.
- **iOS simulator:** requires macOS and Xcode; run `npm run ios`.
- **Web:** `npm run web` after installing dependencies.

App identifiers in `app.json` are demo placeholders. Replace them before signing or distribution. This package contains source code, not an APK, IPA, or App Store release. First install will create a package lock; commit it in your project once installation and Expo compatibility checks succeed.

## Screens and behavior

1. Startup splash with brand and brief loading state.
2. Three welcome screens with Continue, page selectors, and Skip.
3. Login with email/password inputs, visibility toggle, inline validation, pending state, and public sample account.
4. Sample success screen with logout and welcome replay.
5. Informational dialogs for password recovery, registration, and privacy. These explain what is not yet connected; they do not pretend to complete those operations.

Native layout uses safe areas, keyboard avoidance, a scrollable form, labeled controls, and Android back-button handling. State stays in memory; logout clears credentials. Prototype branding and marketplace copy are proposed design choices, not verified representations of the current service.

## Project layout

- `App.js`: native UI and screen state.
- `index.js`: Expo entry point.
- `app.json`: app/platform configuration.
- `src/auth.cjs`: shared, intentionally local demo sign-in logic.
- `tests/auth.test.cjs`: input and demo-credential tests.
- `preview/template.html`: editable browser preview source.
- `preview/index.html`: standalone generated browser preview.
- `scripts/build-preview.cjs`: embeds the shared auth logic into the preview.

After editing shared auth or the preview template:

```bash
npm run build:preview
```

The browser preview mirrors the native design but is a separate HTML implementation, not a native simulator. Native UI changes must also be reflected in the template if parity is desired.

## Backend integration next

All four supplied sources were inaccessible from the creation environment (HTTP 403 or retrieval failure):

- https://studentexchange.onrender.com/
- https://github.com/University-of-Colorado-Anschutz-Denver/CSCI-3508-Group-9/tree/main/documentation/Frontend/Website
- https://github.com/triscroa/CSCI-3508-Group-9-Clone/blob/main/documentation/Backend/readme.md
- https://studentexchangebck-fpdnfpcqe4bje2eh.westus-01.azurewebsites.net/Schools/

No existing CSS, logo, API schema, Schools response, or authentication behavior was verified or copied. No login route or request fields have been guessed. The supplied Schools URL alone does not establish an authentication contract.

To connect real login, first obtain the backend README/OpenAPI specification and verify the sign-in route, request fields, response/session format, error codes, and campus/school schema. Replace local `demoSignIn` with an API adapter, remove public demo credentials from production authentication, implement actual recovery and registration endpoints, and add secure session handling. Never store passwords; if tokens are issued, use platform-appropriate secure storage and implement expiry and logout. Keep the base URL configurable rather than hardcoding guessed routes.

## Verification and limits

Passed in this environment:

- Three Node test cases covering malformed/empty inputs, sample-account success, rejection of other credentials, email normalization, and exact password matching.
- JavaScript syntax checks for both embedded browser scripts.
- Static preview HTML ID uniqueness and JSON configuration parsing.

Not verified here:

- Native installation, Metro bundling, or Android/iOS execution: package registry access was blocked.
- Browser-rendered appearance, responsive layout, and actual UI interactions: local Chromium was unavailable and cloud-browser access to localhost was rejected by browser security.
- Existing service design or backend integration: supplied sources were inaccessible.

Before presenting this as a device-tested app, run the project on Android and iOS and check small screens, keyboard behavior, enlarged text, recovery dialogs, back navigation, and logout. The desktop/mobile HTML preview is intended for immediate review, with the native source ready for local setup.
