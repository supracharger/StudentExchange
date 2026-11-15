# Backend account integration — October 25, 2026

This package adds account integration to the **mobile web prototype**. Open it
in Chrome on Android or Safari on iPhone. The separate `mobile/` Expo starter
still has demo authentication; it has not been connected or built as an APK/IPA.

## What the uploaded backend actually supports

The source ZIP contains ASP.NET Core (.NET 9) controllers and SQLite access in
`code/Backend/StudentExchangeBck/`. The bridge follows those controllers rather
than guessing routes from the website or relying on the README alone.

| Browser bridge | Actual backend request | Result |
| --- | --- | --- |
| `GET /api/status` | None | Whether server configuration is present; does not prove connectivity |
| `GET /api/schools` | `GET /Schools/` | `{ "Schools": [...] }` becomes `{ "schools": [...] }` |
| `POST /api/login` | `POST /LogIn/` with email, password, app_access; then profile GET | Creates server-side session and returns profile |
| `POST /api/register` | `POST /Register/` with email, first_name, last_name, password, school, app_access | Creates backend user; user then logs in |
| `GET /api/profile` | `GET /Register/` with app_access and access_token in JSON body | Returns email, first_name, last_name, school |
| `PATCH /api/profile` | `PATCH /Register/` with changed fields plus app_access and access_token | Updates backend account |
| `POST /api/logout` | `DELETE /LogIn/` with app_access and access_token | Backend revokes ALL tokens for that user |

The UI edits name, email, and school. The bridge also supports the backend's
password field for PATCH, but a password-change UI is not included. Recovery
emails are not implemented by these controllers.

There are **no listing, save, photo, or messaging controllers in this ZIP**.
Those features remain explicitly local demo interactions. The connected account
card is separate from the local demo profile, and account login does not upload
or associate existing local listings with a real user.

## Why a server bridge is required

Authenticated controllers require `app_access`, a shared application password.
Putting it in web JavaScript or an Expo bundle would expose it to users. Also,
the profile GET action expects a JSON request body; browser fetch forbids GET
bodies. Node's HTTP client can send this existing contract without modifying
the group's backend. The browser talks only to its same-origin `/api/` routes,
so backend CORS changes are unnecessary for this arrangement.

The bridge keeps app_access and upstream access tokens on the server. The
browser receives an opaque HttpOnly, SameSite=Strict session cookie. Sessions
expire after eight hours, are held in process memory, and disappear on restart.
Backend expiry is checked when loading the profile. This is a single-process
demo bridge; shared session storage, abuse controls and operational hardening
are needed before a public production service. No passwords are persisted by
the bridge. The existing backend handles its own account/password storage.

## Run on your computer

1. Install Node.js 20.19 or newer. No npm packages are needed for the web app.
2. Copy `.env.example` to `.env` in the package root.
3. Ask the backend owner privately for the deployed `_appAccess` value and put
   it in `STUDENT_EXCHANGE_APP_ACCESS`. This is NOT an email/password, database
   encryption salt, or a value to paste into chat or commit to GitHub.
4. Confirm `STUDENT_EXCHANGE_BACKEND_URL` points at the intended deployment.
   The Azure address is prefilled from the project's supplied reference.
5. Run:

   ```bash
   npm run web:backend
   ```

6. Open `http://127.0.0.1:8080/`, go to the login page and choose **Use backend
   account**. Create a disposable test account or use a team-provided account.
   The school dropdown comes from `/Schools/`. Account settings are accessible
   from **Account → Backend account settings** after login.

The `.env` here is ordinary Node environment configuration. It is DIFFERENT
from the backend's encrypted `bin_/.env` file. Do not copy that encrypted file
into the prototype. An unset application password leaves the bridge disabled;
the ordinary local demo continues to work.

## Test on Android or iPhone

With the phone and computer on the same Wi-Fi, run:

```bash
npm run web:backend -- --host 0.0.0.0
```

Open `http://YOUR_COMPUTER_WIFI_IP:8080/` on the phone. Use the computer's actual
LAN IP, not `0.0.0.0` or `localhost`; allow the port through its firewall if
needed. Keep the terminal running. Plain HTTP LAN testing is for disposable
test accounts on a trusted network. Use HTTPS when handling real credentials.

## Hosting

The existing public hosted prototype has NOT been changed. Static hosting
(including GitHub Pages) cannot run this bridge. To share the connected version
outside your Wi-Fi, host the Node server and web assets together on a Node
service, configure its secret environment variables, and start
`node scripts/serve-web.mjs --host 0.0.0.0`. The server honors `PORT` and `HOST`.
Use HTTPS. Set `STUDENT_EXCHANGE_PUBLIC_ORIGIN` to the exact public origin
(for example `https://your-demo.example`) and
`STUDENT_EXCHANGE_SECURE_COOKIES=true` behind the HTTPS reverse proxy. The
bridge verifies browser write-request origins; do not configure permissive CORS.
Use one server instance for this in-memory session prototype.

## Validation and limitations

Run `npm test` and `npm run check`. Nineteen tests pass: the original nine
model/auth tests and ten HTTP integration tests against a simulated backend.
The latter exercise the actual bridge over HTTP and verify GET bodies,
credential injection, response redaction, registration, profile updates,
logout, session rotation/expiry, and request-origin checks. A web server smoke
check also verifies the new modules and configuration status are served.

This environment has no .NET SDK and could not reach the Azure deployment.
The uploaded source contains neither the deployed app password nor the runtime
encrypted environment configuration. No real user login/registration was
attempted. New account forms have not been tested in a physical phone browser.
Passing simulated tests is NOT evidence of a successful Azure connection.

The supplied backend README describes a configurable data directory and a
backend regression-test project that are absent from this ZIP's implementation.
Its `Env.cs` instead reads `bin_/.env` in Debug or `/home/bin_/.env` in Release.
Ask the backend owner to confirm which revision is deployed before local API
setup; do not assume the README initializer applies to these exact files.

## Group pull request

Add this package under `code/mobile-app-prototype/` on a feature branch. Do not
overwrite the existing `code/Backend/` or website. Commit the source files and
`.env.example`; never commit `.env`. A suggested title is
**Add mobile web account integration with server-side backend bridge**.

The original Word technical guide describes the earlier demo-only version.
This document supersedes its account/backend status. No original backend
database or runtime configuration is redistributed in this package.
