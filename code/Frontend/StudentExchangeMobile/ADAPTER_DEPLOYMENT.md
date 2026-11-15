# Deploying the StudentExchange mobile adapter

Prepared locally; nothing has been deployed. No requests have been sent to Andrew's
production backend. The code supports its inspected source contracts; its deployed
revision, schema, credentials, TLS behavior and runtime responses remain unverified.

## Architecture and readiness

Android -> HTTPS Node adapter -> Andrew's HTTPS ASP.NET backend.

The adapter injects server-owned `app_access` and retains user `access_token` values
in server memory. Android holds only an opaque session cookie in process memory.
Neither `ip` nor `admin_token` is sent. No service/admin account is required.

The first supported topology is **one container, one Node process, one replica**.
Disable autoscaling and overlapping revisions/slot traffic. Sessions and global
rate limits are in memory: restart logs users out. Multiple replicas require a
shared expiring session/rate-limit store; sticky sessions alone do not solve this.

Backend source reviewed: group repository commit
`def6578c0dd6ac4729b1c206d2151f49dcadf680`. The route/payload matrix in
[BACKEND_INTEGRATION_STATUS.md](BACKEND_INTEGRATION_STATUS.md) still applies.
The deployment path adds HTTPS transport to those same contracts, including:

- Root controllers `/Listing`, `/Category`, `/Condition`, `/Schools`, `/Register`, `/LogIn`.
- Messaging `/api/Message`, `/api/Message/unread`, `/api/Message/{id}?after=N`.
- JSON bodies on complex GETs, `for_user: ""` for own listings, user tokens where required.
- JSON base64 uploads, eight images at most, 2 MB per image; `/uploads/{name}` for reads.
- DELETE `/Listing` with an `id` body; PATCH `/Listing/{id}`; mixed text/JSON action results.

The deployed transport allows only the exact backend origin below and known mobile
paths. It rejects redirects, alternative origins, admin routes, foreign URLs and
unexpected queries. TLS certificate verification must stay enabled. The local
mock entry point still cannot reach Azure. No upstream request occurs on startup,
configuration checks or health probes, even when traffic is enabled.

Before enabling traffic, ask Andrew to confirm the deployed source/schema match,
including message tables, profile username/location, listing statuses/renewal and
image serving. Confirm that backend IP blocking works when all mobile users share
the adapter's connection address. Do not solve shared-IP blocking by forwarding IPs.
No password recovery, payment, checkout or offer acceptance endpoint exists in the
inspected controllers. These are backend gaps, not deployment settings.

## Source-confirmed compatibility corrections

Registration accepts only `email`, `first_name`, `last_name`, `school`, and
`password`. `Register.cs` rejects `user` and `location` at creation: the backend
chooses the username and location starts null. Set either later through profile
PATCH. The adapter rejects these creation fields before transport; the mock now
rejects them too. Android already sends only the five supported fields.

Message text is trimmed before checking the 1000-character limit, matching
`Message.cs`; the normalized text is forwarded for both messages and offers.
Regression coverage includes HTTP wire assertions, post-registration profile
editing, direct mock rejection, and trimmed text at/above the limit. All 15 Node
tests pass using local mocks and stubbed HTTPS, without executing ASP.NET or
contacting production. Android `assembleDebug test lintDebug` also passes offline;
the project currently has no JVM unit-test sources (`NO-SOURCE`).

Remaining source limitations require Andrew's decision or backend support:
blank profile location and blank listing description/ISBN mean omitted rather
than cleared; textbook category changes do not manage the Books relationship;
thread reads mark unread messages beyond the returned 200-message page as read;
positive sub-cent offers may round to zero; logout revokes every user token;
and the unpaginated catalogue can exceed the adapter's 1 MiB response cap.
These corrections do not change those behaviors or guess deployment settings.

## Runtime environment

Use hosting runtime secret storage for `SE_APP_ACCESS`. Never pass it through
Docker build args, Android/Gradle, GitHub, command history or container image layers.
The Docker image explicitly copies code only; `.env` files and mock launchers are absent.

| Setting | Value / meaning |
| --- | --- |
| `NODE_ENV` | `production` (required) |
| `SE_BACKEND_URL` | `https://studentexchangebck-fpdnfpcqe4bje2eh.westus-01.azurewebsites.net/` (required exact origin) |
| `SE_PUBLIC_ORIGIN` | Your adapter's public HTTPS root origin on port 443, e.g. `https://your-adapter.azurewebsites.net`; not the backend URL |
| `SE_APP_ACCESS` | Andrew's application credential, injected only into the server runtime; required, no fake/default fallback |
| `SE_ENABLE_BACKEND_TRAFFIC` | `false` initially; set `true` only after explicit authorization for backend requests |
| `PORT` | `8080` by default; listens on `0.0.0.0` inside the container |
| `WEB_CONCURRENCY` | `1`; multiple workers are rejected |
| `SE_SESSION_STORE` | `memory`; other stores are not implemented |
| `SE_UPSTREAM_TIMEOUT_MS` | `180000`; allowed 1000–180000; total API upstream budget shared across follow-up calls |
| `SE_REQUESTS_PER_MINUTE` | `300` default, global single-instance API budget |
| `SE_AUTH_REQUESTS_PER_MINUTE` | `20` default, global login/registration budget; agree with Andrew's IP-blocking thresholds |
| `SE_MAX_CONCURRENT_REQUESTS` | `4` default (1–16), bounds in-flight API work and image/upload memory |

No registry password, admin token or user-service-account credentials belong in
these settings. Registry access is a separate hosting/managed-identity concern.
Do not set `NODE_TLS_REJECT_UNAUTHORIZED=0`; startup rejects it.
`HTTP_PROXY`/`HTTPS_PROXY` are not used by the explicit upstream agents.

`development-adapter/.env.example` contains a nonfunctional template. For optional
local configuration validation, copy it to ignored `.env.production`, restrict
file permissions, and populate it privately. The server does not automatically
load environment files. To validate without listening or sending requests:

```sh
cd development-adapter
node --env-file=.env.production server/deployed.mjs --check-config
```

This checks syntax/configuration only, not credential validity. Never print the
resolved environment, cookies, passwords, tokens or request bodies into logs.

## Local checks and image build

These steps perform no deployment or production requests:

```sh
node --test development-adapter/test/*.test.mjs
./gradlew --offline --no-configuration-cache assembleDebug test lintDebug
SE_ADAPTER_URL=https://adapter.example.invalid ./gradlew --offline --no-configuration-cache assembleConnected lintConnected
```

The `.invalid` origin is deliberately nonresolving; do not install that connected
artifact as a usable live app. The connected APK is not launched during this check.
`assembleDebug` always retains the emulator mock URL, even if `SE_ADAPTER_URL` is set.
Connected/release packaging without `SE_ADAPTER_URL` is rejected.

Build the container locally for the architecture of your deployment host. For
Azure Linux x86-64 custom containers:

```sh
docker build --platform linux/amd64 --tag studentexchange-adapter:reviewed development-adapter
```

There are no npm dependencies to install. Dockerfile runs Node 24 as nonroot, with
no startup login/probe. The base tag receives updates; record/pin a reviewed image
digest when promoting a build, and rebuild/retest for security updates. The local
container test in this session used the Docker engine's native architecture; a
cloud target architecture still needs its own image build/verification.

An optional offline config-only container check, using the private runtime file:

```sh
docker run --rm --network none --read-only --cap-drop ALL --security-opt no-new-privileges \
  --env-file development-adapter/.env.production \
  studentexchange-adapter:reviewed node server/deployed.mjs --check-config
```

Do not start a public service or publish an image until you choose to deploy.

## Concrete deployment path: Azure App Service Linux custom container

Azure is an example hosting target matching the existing backend's platform; no
Azure resources or paid plan were created. Use a **new adapter app**, not Andrew's
backend app or the existing StudentExchange website. These are future user steps:

1. Choose an Azure Linux container host/plan and private registry under your own
   account. Keep instance count at one and disable autoscaling. Allocate enough
   memory for concurrent base64 uploads (budget at least 1 GiB initially, then tune
   from staging measurements). Each listing body can be 23 MiB; JSON parsing and
   decoding add memory overhead. No persistent adapter database/volume is required.
2. Build for the host architecture, tag the reviewed image with your registry path
   and version, and publish it when ready. Do not put a real credential in the image.
   A registry push publishes an image; no such push was performed by this task.
3. Create a separate App Service Linux custom-container application using that
   reviewed image/digest. Configure managed identity for private registry access
   instead of embedding registry passwords in the app image. Use one worker and
   one instance. Do not configure traffic splitting across deployment slots.
4. Copy its actual public HTTPS URL from the hosting overview into `SE_PUBLIC_ORIGIN`.
   Add the runtime settings above with `SE_ENABLE_BACKEND_TRAFFIC=false`.
   Add `SE_APP_ACCESS` as a protected runtime setting, preferably a Key Vault
   reference resolved by the app's managed identity. Grant only the necessary
   secret access; never paste the credential into this repository or Gradle.
5. Set container routing/target port to **8080** and runtime `PORT=8080`. For classic
   App Service custom containers also set `WEBSITES_PORT=8080`; this hosting routing
   setting is not itself injected as `PORT`. For sidecar-enabled container hosting,
   configure the main container's target port in its container configuration.
6. Enable HTTPS Only; terminate TLS at the managed ingress. Preserve the public
   `Host` and Android's `Origin` headers to Node. Only the configured host/origin
   may use `/api/*`; `X-Forwarded-Host`/`X-Forwarded-For` cannot override the policy.
   Every deployed API request, including GET/image requests, requires the canonical
   Origin; Android supplies it. Browser CORS is not needed for this native client.
   The inherited website/static/admin routes are not exposed by this entry point.
7. Configure the health probe to **GET `/healthz`**, never an API/backend route.
   Health reports process/configuration status and the traffic-switch state; it
   does not claim backend readiness. It needs no canonical Host/Origin header.
   For App Service's separate container availability probe, configure its warm-up
   path to `/healthz` (`WEBSITE_WARMUP_PATH=/healthz`) and successful status `200`
   (`WEBSITE_WARMUP_STATUSES=200`) where those settings apply.
8. Configure ingress maximum JSON body to at least **24 MiB**, response/request
   wait time at least **210 seconds**, no automatic retry/replay of API writes,
   no caching of `/api/*`, and no response transformations. Node caps listing bodies
   at 23 MiB and JSON responses at 1 MiB. Header/upload timeouts are 10/30 seconds;
   Node's request-upload timeout does not shorten the separate 180-second backend
   processing budget. API follow-up calls share that budget. Android connected
   read/call timeouts are 200/240 seconds. Verify platform hard limits before use.
9. Add trusted-ingress abuse limits per client as well as Node's global limits.
   Do not log request bodies, Authorization/Cookie/Set-Cookie or secrets. Readiness
   checks and host monitoring must not call Andrew's backend. Disable deployment
   automation that might probe API paths or send test logins.
10. Check only the **adapter** `/healthz`: it should report `backendTrafficEnabled:false`.
    An API call with the proper Host/Origin returns 503 while disabled. This is
    intentional and does not mean deployment failed. Config/health checks never
    validate the app credential or touch the backend.

When possible, run the container read-only, drop Linux capabilities, disable
privilege escalation, and keep the container's HTTP listener private behind TLS
termination. Graceful shutdown allows an in-flight request budget before forced
socket closure; if the host has a shorter stop grace, clients must treat interrupted
writes as uncertain and refresh before resubmitting. Restarting loses sessions.

Official references:
[Azure custom containers](https://learn.microsoft.com/en-us/azure/app-service/configure-custom-container),
[App Service settings](https://learn.microsoft.com/en-us/azure/app-service/reference-app-settings),
[Key Vault references](https://learn.microsoft.com/en-us/azure/app-service/app-service-key-vault-references),
[Node 24 HTTP timeout semantics](https://nodejs.org/download/release/latest-v24.x/docs/api/http.html),
[Docker secret handling](https://docs.docker.com/build/building/secrets/).

## Authorization boundary and compatibility check

**Stop with traffic disabled under the current instructions.** Merely deploying
with the switch off is safe from backend traffic, but deployment itself has not
been authorized in this task. No production compatibility claim can be made yet.

After Andrew confirms the revision/schema, arrange approved test accounts and
explicit permission for backend/database effects. Category/condition reads invoke
application/IP tracking; listing details update activity; opening conversations
marks messages read; logins and writes change data. Even GET-only smoke tests are
not a strict no-database-writes operation. A separate staging backend would need
its own explicitly reviewed allowlist entry before testing against it.

Only after that authorization, set `SE_ENABLE_BACKEND_TRAFFIC=true` and restart the
adapter. This permits public API clients to trigger backend requests immediately,
not just Android. Validate directories/listings, image bytes, register/login/profile,
own listings, approved create/edit/sold/renew/delete actions, two-user messaging,
offers, unread counts and token expiry, using approved data. Compare actual status,
field casing/nullability and errors to the source matrix. Do not blindly retry a
write after timeout; the backend has no idempotency-key contract. Record any contract
mismatch and stop traffic by setting the switch false. Restart invalidates sessions
but does not undo backend operations already performed.

## Connect Android when the adapter is ready

The only Android build input is the **public adapter URL**, never Andrew's URL or
any credential. Build/install the separate connected preview:

```sh
SE_ADAPTER_URL=https://YOUR-ADAPTER-HOST ./gradlew --offline --no-configuration-cache assembleConnected
adb install -r app/build/outputs/apk/connected/app-connected.apk
```

Use the real public hostname, no path/query/userinfo. This application ID ends in
`.connected` and can coexist with the mock app. It enforces HTTPS, standard TLS
certificate validation, exact configured origin, allowed API paths/methods, no
redirects and no automatic write retries. Cleartext is disabled; emulator HTTP
access remains confined to `assembleDebug`. Mock fill buttons are removed from
connected builds. Its session cookie is process-only and Secure/HttpOnly server-side.

The connected variant is debug signed for supervised integration testing, not a
Play Store release. For a release, supply the same public `SE_ADAPTER_URL`, configure
release signing privately in Android Studio/your release workflow, then build
`assembleRelease`. Never store release signing passwords or backend secrets here.
Re-run tests/lint, inspect packaged configuration and scan for actual secret values
before distributing. Test on real devices and against an authorized environment.

## Local validation record

- Adapter deployment and existing contract suites: **13 passed, 0 failed**, using
  loopback servers and stubbed HTTPS. Includes the disabled-traffic guard, canonical
  Host/Origin, Secure opaque sessions, TLS policy, HTTPS GET bodies/images, redirects,
  rate/concurrency limits and the existing two-user lifecycle.
- Mock Android build/test/lint passed: **0 lint errors, 11 warnings**. Connected
  build/lint passed: **0 errors, 10 warnings**. Connected URL was
  `https://adapter.example.invalid/`, never resolved or requested.
- Android has no JVM test sources (`NO-SOURCE`). Missing public adapter URL was
  correctly rejected by `validateAdapterEndpoint` (intentional negative test).
- APK DEX marker checks passed for both variants: server credential/configuration
  names and test secrets absent; public mock login password also absent in connected
  APK. This is a targeted artifact check, not proof against every possible secret.
- The emulator smoke suite from the preceding integration stage was not rerun
  during deployment preparation; no connected APK was launched against any service.
- Docker build succeeded locally; offline config check succeeded with fake secret,
  traffic disabled, networking disabled, nonroot user and read-only filesystem.
- No deployment, registry/GitHub push, commit or production request was performed.
