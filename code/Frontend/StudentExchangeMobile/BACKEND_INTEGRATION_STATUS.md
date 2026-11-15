# Android backend integration — 2026-11-15

Deployment preparation is now implemented locally. See
[ADAPTER_DEPLOYMENT.md](ADAPTER_DEPLOYMENT.md) for the current runtime variables,
traffic-off container entry point, connected Android build and exact future deployment
steps. The earlier checklist below describes the original integration stage;
selected source contracts are checked locally with mocks and stubbed transport.
The ASP.NET service has not been executed by these tests; deployed compatibility
remains unverified.

## Source and scope

The replacement repository is accessible. Reference checkout:
`/private/tmp/studentexchange-group-backend-reference-20261115`.
Repository: https://github.com/University-of-Colorado-Anschutz-Denver/CSCI-3508-Group-9
Default branch inspected: `main`, commit `def6578c0dd6ac4729b1c206d2151f49dcadf680`.
This branch was cloned only as reference; no work was committed or merged into it.
Backend: `code/Backend/StudentExchangeBck/`.
The existing ignored local group copy also contains Controllers and Components.
The temporary checkout was used as read-only reference. The failed earlier
SoftwareEngineerTemp clone is no longer an integration blocker.

Read the group README, backend environment README, Program.cs, requested
controllers, Schools, and authentication/token components; inspected SQL/IP
tracking and utility behavior as needed. No environment credential files or
SQLite databases were opened. The backend was not started. Source presence is
not verification of the deployed Azure revision or schema.

The source agrees with Andrew: `app_access` is application authentication;
`access_token` identifies a user; `ip`/`admin_token` forwarding is for the website
and explicitly prohibited for mobile. Messaging uses `/api/Message`; the other
requested controllers use root controller paths. Complex GET inputs bind from
JSON bodies under ASP.NET's ApiController convention. Schools GET is an exception:
it has no request parameter and returns the school directory without authentication.

All edits are in the Android workspace on `robert-android-app`. No commits,
pushes, merges, website/backend modifications, production requests, or production
database access were performed.

## Controller contracts and adapter translation

All upstream operations below use server-owned `app_access`. Authenticated
operations also carry user `access_token` obtained through login and retained
only on the adapter. Android carries an opaque process-memory session cookie.
Node HTTP supports JSON GET bodies; Android's Retrofit GETs do not need bodies.

| Android adapter route | Backend route / body / response |
| --- | --- |
| GET `/api/listings` | GET `/Listing`; `search`, exact `category`, `isbn`, `user_page` in JSON; array with numeric `id`, `price`, nullable `location`, `isbn`, `image_url` |
| GET `/api/listings/{id}` | GET `/Listing/{id}`; optional user token; detail has no ID, has `description`, seller names, nullable `images_url`; adapter excludes seller email |
| GET `/api/my-listings` | GET `/Listing`; server supplies `for_user: ""` plus token, returns own listings of all statuses and `days` |
| GET `/api/categories`, `/api/conditions` | GET `/Category`, `/Condition`; string arrays |
| GET `/api/schools` | GET `/Schools`; object `schools` and `short_names`; adapter exposes schools |
| POST `/api/register` | POST `/Register`; required `email`, `first_name`, `last_name`, `password`, `school`; `user` and `location` forbidden (set later through profile PATCH); 201 with email, no login token |
| POST `/api/login` | POST `/LogIn`; email/password; 201 with `access_token`, `first_name`; adapter reads profile and returns opaque session cookie plus public profile |
| GET/PATCH `/api/profile` | GET/PATCH `/Register`; profile includes `email`, `user`, names, school, nullable location; PATCH returns a message, followed by profile refresh |
| POST `/api/logout` | DELETE `/LogIn`; token; revokes user sessions; adapter also deletes local sessions using that token |
| POST `/api/listings` | POST `/Listing`; `title`, `description`, numeric `price`, `category`, `condition`, optional `isbn`, `imageBase64` array; 201 with message, no listing ID |
| PATCH `/api/listings/{id}` | PATCH `/Listing/{id}`; partial listing fields, optional `status`, `imgs` operations (`action`, zero-based `location`, `imageBase64`) |
| DELETE `/api/listings/{id}` | DELETE `/Listing` with numeric `id` in JSON, not in the backend URL |
| GET `/api/images/{name}` | GET `/uploads/{name}` without credentials; validated name, PNG/JPEG/WebP type/signature, 2 MB cap, no redirects |
| GET `/api/messages` | GET `/api/Message`; conversation summaries including role, other name, preview, amount, unread count |
| GET `/api/messages/unread` | GET `/api/Message/unread`; `{unread}` |
| GET `/api/messages/{id}?after=N` | GET `/api/Message/{id}?after=N`; `{conversation_id,messages}`; up to 200 ascending messages; marks other participant's messages read |
| POST `/api/messages` | POST `/api/Message`; one of `listing_id`/`conversation_id`, kind `message`/`offer`, text up to 1000 chars, offer amount >0 and <=1000000; 201 with `conversation_id` |

ASP.NET's default JSON web naming policy makes PascalCase C# properties camelCase
on the wire. Listing action responses mix JSON objects and text; adapter
normalizes those into `{message}`. Search ranks all candidates rather than
promising strict substring exclusion. Price/condition filtering remains on Android.
Images accept base64 JSON, not multipart. Backend allows eight images, 2 MB each.

## Implemented behavior

- Existing marketplace UI, navigation, search, category/condition/price filters,
  saved finds, supplied artwork placeholders, and detail layout retained.
- Bounded asynchronous image loading from the adapter; detail gallery.
- Backend-style registration, school selection, login/logout, profile refresh/edit,
  username and pickup location. Legacy device-local demo accounts no longer
  authenticate network actions. No passwords or session tokens are persisted by Android.
- Posting with optional photo selection, downsampling and JPEG encoding; own
  listing management, price/content edits, sold/renew requests, image add/remove,
  and deletion. The UI adds one photo per save; further photos can be added by
  editing, within the backend limit. Creation success refreshes own listings
  because the backend does not return a created ID.
- Conversation inbox with unread counts, message history/read receipts, replies,
  offers, and manual cursor-based loading of newer messages. No background polling.
- Server-side opaque sessions, Origin protection, application credential injection,
  forbidden forwarding-field rejection, write allowlists, bounded uploads, safe
  error responses, no redirect following, no automatic write retries. The local Android client
  bypasses system proxies and disables idle connection pooling to avoid stale
  Node keep-alive socket failures between UI interactions.
- Stateful in-memory mock with buyer/seller accounts, profiles, listings, images,
  conversations, offers and token revocation. Mock remains default and loopback-only.
  It approximates backend semantics; it does not run C# or reproduce SQL ranking,
  rate limiting, expiry/renewal timing, maintenance jobs, or every validation rule.

## Validation

- Node suite: six tests passed using local HTTP mock servers. Covers application
  envelopes and JSON GET bodies, filter forwarding, profiles/registration/login,
  ownership, images, listing create/edit/delete, conversations/offers/unread,
  cursor rejection, logout invalidation, secret injection and hostile image responses.
- Android `assembleDebug test lintDebug` completed successfully in offline mode
  after the initial lint dependency download. Unit-test tasks report `NO-SOURCE`.
- Final lint: 0 errors, 17 warnings (SDK/dependency versions and existing
  UI resource/drawing/style issues). The emulator smoke test passed on `emulator-5554`: category filtering,
  product detail, login, listing creation, message send/history, inbox, profile
  navigation and logout. Initial runs exposed stale local keep-alive connections;
  disabling idle reuse fixed the run without enabling write retries. UI Automator
  intermittently reported an unavailable root; readiness retries recovered.
- APK DEX scan: server credential/configuration markers `app_access`, `admin_token`,
  `SE_APP_ACCESS`, `mock-app-only`, and test adapter secret absent. Public mock
  user fill-button credentials are intentional demo data, not backend secrets.
- APK: `app/build/outputs/apk/debug/app-debug.apk`.

## Backend and deployment limitations

- No password-recovery/email-verification endpoint is provided by these controllers.
- Offers are conversational amounts. No accept/reject, checkout, payment or escrow API exists.
- Listing status availability and renewal eligibility depend on backend database
  status levels and runtime configuration. The UI sends requests and shows backend
  errors rather than promising renewal always succeeds.
- PATCH treats blank profile/listing fields as omitted; clearing location,
  description or ISBN is not a reliable supported operation. The UI preserves
  those backend semantics. Changing listing categories with ISBN data needs staging review.
- Without forwarding, the backend sees the adapter connection address for all
  mobile users. Confirm with Andrew that backend IP blocking/attempt tracking
  supports this shared-adapter model; do not reintroduce forwarding to bypass it.
- Message reads and listing detail reads write read/activity records. Even an
  otherwise read-only production test can modify the production database.
- The adapter keeps sessions in memory for 12 hours. Android keeps its opaque
  cookie in process memory. Restart requires login. A failed response after a
  backend write can leave the result uncertain; refresh before repeating. The
  backend provides no idempotency-key contract.
- The passing emulator smoke test does not replace a full device/rotation/accessibility
  and image-picker test matrix. No live compatibility has been established.

## Requirements before connecting live

Deployment code/configuration is now prepared: fixed HTTPS allowlist, traffic switch
(default off), canonical Host/Origin, Secure cookies, request limits, API-only runtime,
Docker image and separate HTTPS Android connected build. Local mock mode remains the
default. No deployment or production requests were made.

Follow [ADAPTER_DEPLOYMENT.md](ADAPTER_DEPLOYMENT.md): confirm Andrew's deployed
revision/schema and shared-IP blocking policy; deploy a separate adapter with its
credential in runtime secret storage and traffic disabled; configure HTTPS/port/
health/limits for one instance; obtain permission for backend/data effects; then
validate actual endpoints before building Android with the adapter's public URL.
Multiple replicas require a shared session/rate-limit store. No IP forwarding or
application credentials in the APK are permitted.

## Changed files

- Android: `app/src/main/java/com/studentexchange/mobile/MainActivity.java`,
  `api/ApiClient.java`, `api/MarketplaceApi.java` under the same package.
- Adapter: `development-adapter/server/api.mjs`, `app.mjs`, `development.mjs`,
  `marketplace.mjs`, `mock-backend.mjs`; new `mobile-contracts.mjs`, `images.mjs`.
- Tests: `development-adapter/test/marketplace.test.mjs`; new `mobile.test.mjs`;
  `tools/check-local-emulator.py`.
- Documentation: `README.md`, `LOCAL_ANDROID_TESTING.md`,
  `development-adapter/README.md`, this integration status document.

## Deployment preparation changes

See [ADAPTER_DEPLOYMENT.md](ADAPTER_DEPLOYMENT.md) for the current test record and
future deployment procedure. Added `development-adapter/Dockerfile`, `.dockerignore`,
`.env.example`, `server/backend-policy.mjs`, `deployment-config.mjs`, `deployed.mjs`,
`limits.mjs`, and `test/deployment.test.mjs`. Updated transport, images, API server,
package scripts, Android Gradle/build URL configuration, manifest and mode labels.
Deployment traffic defaults off. A separate `connected` build accepts only a public
HTTPS adapter URL and removes mock login shortcuts; normal debug remains local.
Current validation: 13 Node tests passed; mock/connected builds and lint passed;
local container built and offline checks passed. Actual deployed compatibility is
still unverified. No deployment, production request, commit or push was made.
