# Student Exchange

A student marketplace built with React, TypeScript, and Vite, served by a Node.js application. The Node server provides a same-origin API adapter for the separate Student Exchange ASP.NET backend.

## Requirements

- **Node.js 24**, version **24.15.0 or newer within the 24.x series**. The repository pins **24.19.0** in `.nvmrc` and the Render configuration.
- npm, included with Node.js, and Git.
- Access to the Student Exchange backend and its server-side application/service-account credentials for live accounts and marketplace features.

The backend is a separate project: [SoftwareEngineerTemp](https://github.com/supracharger/SoftwareEngineerTemp). You do not need .NET or a local database to build this website or run its ordinary tests. The website does not start the backend or create its database.

## Get the source and install dependencies

These commands check out the `ChatGPT` branch, where the current website updates are maintained:

```sh
git clone --branch ChatGPT https://github.com/supracharger/StudentExchange-Website.git
cd StudentExchange-Website
npm ci --include=dev
```

If you use nvm on macOS/Linux, run `nvm install` and `nvm use` in the repository before installing dependencies. Otherwise install Node 24.19.0 directly and check it with `node --version`.

Run the remaining commands from the repository root, alongside `package.json`. Keep development dependencies installed for building, type checking, and tests, even when preparing a production release.

## Configure the backend connection

Copy the example configuration:

```sh
cp .env.example .env.local
```

On Windows PowerShell, use:

```powershell
Copy-Item .env.example .env.local
```

Edit `.env.local` and supply these values from the backend maintainer or your hosting secret manager:

| Variable | Purpose |
| --- | --- |
| `backend` | Backend service URL. `.env.example` contains the deployed Azure URL. HTTPS is required, except for an HTTP loopback backend during local development. |
| `app_access` | Backend application access credential. |
| `user` | Email of the backend service account used for visitor-IP forwarding. This account must be an administrator. |
| `user_pass` | Password of that service account. |
| `PORT` | Optional Node server port; defaults to `3000`. Vite development and preview use their own ports. |
| `NODE_ENV` | Set to `production` on an HTTPS production deployment. Leave unset for ordinary local HTTP testing. |

Variable names are case-sensitive. Quote `.env.local` values that contain spaces or `#`, following Node/Vite environment-file syntax. Restart the running server after changing its configuration.

`.env.local` is ignored by Git. These credentials belong only on the server: never prefix them with `VITE_`, put them in React source, commit them, or share their values in logs. `user`/`user_pass` are service credentials, not the account visitors use in the website's login form. Visitor accounts authenticate separately through the website.

The website can build and display its interface without live credentials, but account and marketplace requests will report that the service is unavailable until configured. Ordinary tests use local fixtures and do not require these secrets.

## Run for development

```sh
npm run dev
```

Open **http://localhost:5173**. Vite handles hot reload and runs the website's `/api` adapter in the same process, so no second frontend/API command is needed.

Port 5173 must be available. To use another port:

```sh
npm run dev -- --port 5174
```

Use the website URL for login and API requests. The adapter forwards requests to the configured backend, including its JSON GET bodies, while keeping credentials and visitor access tokens out of browser JavaScript.

## Build and run the website

Build the production assets:

```sh
npm run build
```

This first runs TypeScript checking, then writes the website assets to `dist/`.

To serve the built website locally:

```sh
npm start
```

Open **http://localhost:3000**, or the port configured with `PORT`. The start command loads `.env.local` if present and serves both `dist/` and `/api` through Node. Run `npm run build` again after source changes; `npm start` does not rebuild assets.

For an alternative local preview of the Vite build, run `npm run preview` and open **http://localhost:4173**. Production hosting should use `npm start`.

To check the Node server's process health, visit **http://localhost:3000/healthz**. A healthy process does not prove the remote backend is reachable or that its credentials are authorized.

## Test and check changes

```sh
npm run typecheck
npm test
```

`npm test` runs the Vitest UI and local HTTP fixture tests. The fixture tests need permission to listen on loopback ports. The live API test is skipped by default; routine tests do not create or change records in the deployed backend. `npm run test:watch` runs tests interactively while developing.

`npm run build` also includes type checking. A typical validation before pushing is `npm test` followed by `npm run build`.

## Deploy

A Render web-service configuration is included in `render.yaml`:

- Build command: `npm ci --include=dev && npm run build`
- Start command: `npm start`
- Health-check path: `/healthz`
- Node version: `24.19.0`
- Set `NODE_ENV=production` and configure `backend`, `app_access`, `user`, and `user_pass` in the hosting environment. Render supplies `PORT`.

For other hosts, use the same install/build/start sequence and provide those environment variables. Serve the Node application behind HTTPS; production session cookies use the Secure attribute. Environment variables provided by the host can replace `.env.local` entirely.

**Deploy this as a Node web service.** Static hosting of `dist/` alone does not provide the required `/api` adapter. Direct page URLs such as `/seller`, `/admin`, and `/sellers/username` are handled by the Node server's SPA fallback.

Keep one application instance while sessions are stored in process memory. Restarting the server signs users out. A shared session store is needed before scaling across instances. The `RENDER=true` flag enables Render-specific trusted visitor-IP handling; do not set it on unrelated hosts without adapting proxy trust.

## Website features and routes

| Route | Purpose |
| --- | --- |
| `/` | Browse public listings; search by title, category, and textbook ISBN. |
| `/sellers/{username}` | Public seller collection using the backend `user_page` filter. |
| `/seller` | Authenticated seller inventory, public URL/copy control, listing creation and editing, photos, renewal, Mark as Sold, and deactivation. |
| `/admin` | Administrator tools, subject to backend permissions and account hierarchy. |

Listing details show a photo gallery, availability, seller contact when available, and a link to the seller's public collection. A signed-in detail request includes the visitor's access token server-side. Removing a listing from the website sets it to **Inactive**, preserving the listing and photos. Creation supports up to eight PNG/JPEG/WebP photos, at most 2 MiB each.

## Project layout and further documentation

- `src/`: React components, browser API clients, styling, and UI tests.
- `server/`: Node server, backend adapter, session/permission handling, and HTTP fixture tests.
- `vite.config.ts`: development/preview server adapter and test configuration.
- `.env.example`: server configuration template.
- `render.yaml`: Render deployment settings.
- [Marketplace integration](docs/marketplace.md): endpoint mappings, listing statuses, seller pages, photos, and deployed API updates.
- [Administration](docs/administration.md): admin tools, permissions, and forwarding behavior.

The deployed backend can be ahead of its GitHub README or source snapshot. Consult the integration documentation and current deployed contract when changing API behavior.

## Troubleshooting

| Symptom | What to check |
| --- | --- |
| npm reports an unsupported Node version | Install Node 24.19.0 and reinstall dependencies with `npm ci --include=dev`. |
| Development server reports its port is in use | Stop the previous process or choose another port with `--port`. |
| `npm start` cannot display the website | Run `npm run build` first and confirm `dist/index.html` exists. |
| Accounts or listings are unavailable | Check all four backend settings, backend availability, service-account admin membership, and outbound HTTPS access. Restart after configuration changes. |
| Local login does not persist | Use local HTTP with `NODE_ENV` unset; production Secure cookies require HTTPS. Keep requests on the same website origin. |
| Hosted assets work but `/api` fails | Use the Node web-service start command rather than serving `dist/` as a static-only site. |
| Tests fail with `listen EPERM` | Allow local loopback sockets in the test environment. |
| Users are signed out after deployment | Sessions are currently held in server memory and are cleared on restart. |
