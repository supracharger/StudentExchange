# Student Exchange

A React and TypeScript website built with Vite and a same-origin Node account adapter, ready for local development in Visual Studio Code and deployment as a Render Web Service. Student Exchange helps students buy and sell textbooks, school supplies, and campus essentials. Sellers and buyers will connect by email and arrange payment directly; the product does not include payments or messaging.

The website includes a responsive homepage based on `img/WebsiteDesign.png`, searchable sample listings, and account registration, login, profile editing, session restoration, and logout using the documented ASP.NET API. Schools come from the backend. Marketplace listings remain illustrative because no listing endpoints are documented; live listings and seller contact details are future work.

## Run locally in VS Code

Install **Node.js 24 LTS** (24.15 or newer; `.nvmrc` pins 24.19.0), npm, and Visual Studio Code. Open this repository's root folder in VS Code, then use its terminal:

```sh
# If using nvm:
nvm install
nvm use

npm ci
npm run dev
```

Open the local address printed by Vite (port 5173). Edits in `src/` update automatically.

Before starting, supply these **server-only** settings in your process environment:

| Variable      | Purpose                                                                                                |
| ------------- | ------------------------------------------------------------------------------------------------------ |
| `backend`     | `https://studentexchangebck-fpdnfpcqe4bje2eh.westus-01.azurewebsites.net`                              |
| `app_access`  | The shared application credential, entered securely; never commit it or put it in a `VITE_*` variable. |
| `admin_token` | The IP forwarding credential, entered securely on the server; never expose it to the browser.          |

`.env.example` lists the settings and contains no credential value. If you choose to manage your own local settings in an ignored `.env.local`, both Vite and `npm start` read that file. Setup does not create it or store a credential. Restart the server after changing settings. School lookup needs only `backend`; account requests need all three settings. Missing configuration leaves browsing available and returns a clear account-unavailable message.

For breakpoints, install Google Chrome and press **F5**, selecting **Debug Student Exchange in Chrome**. The included launch configuration starts Vite through a background task. If Vite is already running in another terminal, stop that instance first; the port is intentionally fixed. Stop the server using Ctrl+C or VS Code's **Tasks: Terminate Task** command when finished.

To debug server-side requests, select **Debug Student Exchange Node server**. It builds the frontend and starts the Node server on port 3000 using the same server settings.

VS Code also has build and test tasks. From the terminal:

```sh
npm test              # Run the UI tests once
npm run test:watch    # Rerun tests while editing
npm run typecheck     # Check TypeScript
npm run build         # Type-check and build into dist/
npm run preview       # Serve the production build on port 4173
npm start             # Serve dist/ and the account API on port 3000
```

Run `npm run build` before `npm run preview` or `npm start`. Vite development and preview include the same API adapter as the production Node server. `PORT` overrides the Node server's port. Local HTTP development uses a non-Secure cookie; production must use HTTPS with `NODE_ENV=production`, which enables Secure cookies.

## Deploy on Render

Commit and push the application files to GitHub. In Render, create a **Blueprint** from this repository to use `render.yaml`, or create a **Web Service** with:

| Setting               | Value                                                                                                                                 |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Branch                | `main` (or the branch containing these changes)                                                                                       |
| Root directory        | Leave blank                                                                                                                           |
| Build command         | `npm ci && npm run build`                                                                                                             |
| Start command         | `npm start`                                                                                                                           |
| Health check path     | `/healthz`                                                                                                                            |
| Environment variables | `NODE_VERSION=24.19.0`, `NODE_ENV=production`, `backend` as above, and both `app_access` and `admin_token` entered securely in Render |
| Instances             | `1` (sessions are stored in the Node process)                                                                                         |

The Node server serves `dist/`, handles `/api/*`, and falls back to `index.html` for extensionless client-side page routes. Missing assets and unknown API routes return 404. A Static Site alone cannot run the account adapter. The Blueprint includes the backend URL and requests `app_access` and `admin_token` through Render's secure settings; it contains no secret value. No Render service has been deployed by this work.

## Backend integration

`readme-Backend_Info.md` documents the separate ASP.NET API. Its source and database are not part of this repository. The adapter preserves that API's existing contract:

| Browser request      | Backend request                         | Behavior                                                            |
| -------------------- | --------------------------------------- | ------------------------------------------------------------------- |
| `GET /api/schools`   | `GET /Schools`                          | Maps `Schools` to `schools`; no credentials sent.                   |
| `POST /api/register` | `POST /Register`                        | Registration requires a separate login.                             |
| `POST /api/login`    | `POST /LogIn`, then `GET /Register`     | Stores the returned user token server-side and returns the profile. |
| `GET /api/profile`   | `GET /Register` with JSON body          | Uses the cookie session's token; browser requests have no GET body. |
| `PATCH /api/profile` | `PATCH /Register`, then `GET /Register` | Sends changed fields only, then reads normalized values.            |
| `POST /api/logout`   | `DELETE /LogIn`                         | Revokes backend sessions before clearing the cookie.                |

The browser receives an opaque, HttpOnly, SameSite=Lax cookie with a 12-hour lifetime. User tokens, shared credentials, and passwords are not stored in localStorage or sessionStorage. The adapter checks Origin on state-changing requests, caps request/response sizes, applies upstream timeouts, rejects redirects, and masks backend exception details. Requests use verified HTTPS for remote backends; HTTP is allowed only for loopback development services. Managed HTTP(S) proxies are respected by Node's native agents.

Sessions are deliberately kept in memory: restarting/redeploying the Node server logs users out. Use a shared server-side session store before scaling beyond one instance. Backend token expiry can invalidate a session earlier. Logout revokes all backend tokens for that user, matching the documented API.

Every upstream request except `/Schools` includes server-generated `ip`, `admin_token`, and `app_access` in its JSON body, including upstream GET profile requests. Browser-supplied body fields cannot override these values. Secrets stay on the Node server.

On Render, the automatically supplied `RENDER=true` flag enables reading the single visitor address from `CF-Connecting-IP` at its public Cloudflare edge. The adapter ignores `X-Forwarded-For` and rejects missing or invalid edge IPs instead of forwarding a proxy address. Local development uses the socket address (usually `127.0.0.1` or `::1`) and ignores forwarding headers. Do not set `RENDER=true` locally or expose a bypass route to this server behind an untrusted proxy. This trust mode assumes requests arrive through Render's public edge; private-network callers must also be trusted. See [Render's environment flags](https://render.com/docs/environment-variables), [Render's Cloudflare provider information](https://render.com/docs/custom-domains), and [Cloudflare's visitor IP header contract](https://developers.cloudflare.com/fundamentals/reference/http-headers/#cf-connecting-ip).

The backend uses the forwarded IP when `admin_token` is valid. Its documented application authorization still checks the adapter connection's IP before processing body forwarding, so forwarding does not bypass that earlier check. After deployment, verify a request through your public Render URL and confirm its attributed IP in the backend; the current tests simulate the Render edge rather than deploying a service.

School lookup and authenticated account workflows have been verified against the deployed Azure backend through the adapter, using securely injected credentials. Live API and Chromium checks covered registration, login, session restoration, profile retrieval, name/school/password updates, login with the changed password, and logout. Automated contract and UI tests also pass. See [live verification results](docs/live-validation.md) for scope and the test accounts left for backend cleanup. `/healthz` checks the Node process and reports whether settings are present, without validating credentials or disclosing their values.

## Project map

| Path                                                                              | Purpose                                                       |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| `src/App.tsx`                                                                     | Homepage, search, category filtering, and account entry point |
| `src/components/AccountPanel.tsx`                                                 | Registration, login, school selection, and profile forms      |
| `src/hooks/useAccount.ts`                                                         | Session restoration, account actions, and operation feedback  |
| `src/api/accounts.ts`                                                             | Typed same-origin browser API client                          |
| `server/api.mjs`                                                                  | ASP.NET adapter, credential injection, and cookie sessions    |
| `server/app.mjs`, `server/index.mjs`                                              | Production static/API server and runtime settings             |
| `src/data/listings.ts`                                                            | Clearly marked sample data                                    |
| `src/styles.css`                                                                  | Responsive styling                                            |
| `src/App.test.tsx`, `src/components/AccountPanel.test.tsx`, `server/api.test.mjs` | Marketplace, account UI, and HTTP contract/error tests        |
| `img/`                                                                            | Original design references and logo                           |
| `.vscode/`                                                                        | Local debugging, build, and test tasks                        |
| `render.yaml`                                                                     | Node Web Service deployment Blueprint                         |

Generated builds, dependencies, and local `.env` files are ignored by Git. Commit `package-lock.json` and use `npm ci` to reproduce the dependency versions.
