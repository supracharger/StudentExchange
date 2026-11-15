# Student Exchange — Mobile contribution report

**Contributor:** Thomas Phommarath  
**Course:** CSCI 3508 — Introduction to Software Engineering  
**Branch, commit, and PR:** Add the links to this report or the PR description after pushing.

## Work completed

- Built an Expo/React Native starter for Student Exchange with startup, welcome, and demo login screens.
- Set up the starter on Windows and verified that it opened in Expo Go on a physical iPhone.
- Separately built a Node.js account bridge for the mobile web prototype. It maps school loading, registration, login, profile operations, and logout to the team's API while keeping the shared application secret on the server. The integration package passed 19 automated tests, including 10 HTTP bridge tests against a simulated backend. This bridge is a separate deliverable from the Expo starter.

## Files to review in the Expo commit

| Path within the Expo project | Purpose |
| --- | --- |
| `App.js`, `index.js`, `app.json` | App screens, entry point, and Expo configuration |
| `package.json`, `package-lock.json` | Dependencies and exact versions from the local Expo project |
| `src/auth.cjs`, `tests/auth.test.cjs` | Demo account validation and its automated tests |
| `.gitignore`, `README.md` | Exclusions and setup instructions |
| `scripts/`, `preview/` | Source and output for the separate browser preview referenced by the package script |
| `MOBILE_CONTRIBUTION_REPORT.md` | Scope, evidence, and review instructions |

## How to review

From the Expo project folder, run `npm.cmd ci`, `npm.cmd test`, then `npx.cmd expo start` on Windows. Scan the new QR code with a compatible Expo Go version and verify the welcome and demo login screens. On macOS or Linux, use `npm` and `npx` without the `.cmd` suffix.

Optional evidence: add a screenshot of the working app on the iPhone to the PR. Record the Expo SDK used for the successful run in the PR description.

## Scope and handoff

- **Verified on iPhone:** Expo starter opened for a demo. Login uses a sample account.
- **Verified with simulated data:** The separate web account bridge passed automated HTTP tests. Live staging integration has not been verified.
- **Outside this commit:** The team's separate native Android app, its mock marketplace adapter, and any live Android or Expo account integration.
- **Next step:** Confirm with Andrew which staging endpoints are available, then verify school loading and, once the chosen client supports it, login → profile → logout with a disposable staging account.
