# StudentExchange mobile adapter

The default launcher below remains mock-only. A separate prepared deployment
entry point (`npm run start:deployed`) is API-only and keeps backend traffic
disabled by default. See [ADAPTER_DEPLOYMENT.md](../ADAPTER_DEPLOYMENT.md) for
runtime variables, container configuration, limits and authorization steps.

Requires Node 24.15–24.x. No dependencies need installing.

```sh
cd development-adapter
npm test
npm start
```

The launcher binds the adapter to `http://127.0.0.1:3100` and an in-memory mock
backend to an ephemeral loopback port. Android Emulator uses `http://10.0.2.2:3100/`.
Upstream validation and transport prohibit non-loopback destinations. No production
API requests occur; changing an environment URL cannot enable them.

The fake default application credential is public mock data. Optional `SE_APP_ACCESS`
comes only from the Node process environment and is shared with the local mock.
No real credential is needed. Environment files are not loaded. Never put secrets
in Android, Gradle, the APK, command history or version control. Node injects
`app_access` and authenticated user `access_token` into JSON bodies, including GET.
Neither `ip` nor `admin_token` is forwarded; both are rejected before transport.
There is no service-account login bootstrap.

All state is mock memory. Stop the process to discard accounts, photos, listings,
messages and tokens. Ctrl+C shuts down both local servers. Android session cookies
also remain in process memory; app process restart requires login.

| Sample account | Password | Role |
| --- | --- | --- |
| `demo@mock.invalid` | `CampusDemo123!` | Buyer |
| `seller@mock.invalid` | `CampusDemo123!` | Owner of sample calculus listing |

School: `Mock University`. Register additional mock accounts from Android. The
mock hashes passwords in memory and never reads a SQLite database. Its behavior
is representative rather than a complete reimplementation of C# validation,
search ranking, rate limits or renewal timing.

Routes include listings/search/directories/details, images, registration/login,
profile edits, logout, own listings and listing mutations, conversations/unread,
messages and offers. See the exact route and payload matrix in
[BACKEND_INTEGRATION_STATUS.md](../BACKEND_INTEGRATION_STATUS.md).

Thirteen automated tests exercise local HTTP GET bodies, security envelopes, account
and two-user listing/messaging lifecycles, images and rejected/malformed inputs.
In a socket-restricted sandbox the test runner needs loopback socket permission.

Image proxy accepts only validated upload names and PNG/JPEG/WebP bytes under
2 MB. No redirects, external URLs, HTML or SVG are allowed. Write routes use
opaque HttpOnly SameSite cookies and require a matching Origin. Android sends
its adapter origin explicitly. The inherited admin handler remains isolated and
is not part of the Android interface or a newly verified administrative contract.

No deployment was performed. The prepared HTTPS deployment uses a fixed backend
allowlist, canonical Origin/Host, runtime secrets and rate/concurrency limits. It
supports one process/replica with memory sessions. Shared sessions/rate limits
are required before scaling. The mock launcher remains isolated.
