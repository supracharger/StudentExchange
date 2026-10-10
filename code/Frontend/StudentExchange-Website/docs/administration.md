# Administrator console

The `to_user` deletion change is prepared for an upcoming backend release and has not yet been deployed there. Deploy the backend contract update before deploying this website change. Validation of the new deletion request uses local HTTP fixtures.

The `/admin` page is available from **Admin console** in the header after an administrator logs in. Direct navigation requires a valid session and confirmed membership from `GET /Admin`. Regular users never see the admin link. Permission checks fail closed: an unavailable or malformed membership response does not grant access.

The implementation follows [SoftwareEngineerTemp/readme.md](https://github.com/supracharger/SoftwareEngineerTemp/blob/a10ea5d5f109cf3afac6f56b254c53e770ab05ed/readme.md) and its controllers at commit `a10ea5d5f109cf3afac6f56b254c53e770ab05ed`. The originally attached backend guide predates these endpoints. The account-deletion selector follows the subsequent backend contract update: `to_user`, containing the exact stored target email, replaces `email`.

| Admin access | Visible tools |
| --- | --- |
| Any administrator, including level 0 | Overview, own membership/level, end an eligible user's sessions |
| Level 1+ | User directory, search, school filter, pagination, eligible profile reads/updates, account deletion, school directory/add/delete |
| Level 2+ | User/IP attempt records, search, pagination, clear user or IP records |

Navigation and controls outside the administrator's permissions are omitted, rather than disabled. Disabled states are only used for temporary loading, missing confirmation, or pagination boundaries.

## Backend route coverage

| Website adapter | Backend request | Required level |
| --- | --- | --- |
| `GET /api/admin` | `GET /Admin` | Logged-in user |
| `GET /api/admin/schools` | `GET /Schools` with name/short-name pairing | 1+ |
| `POST /api/admin/schools` | `POST /Schools` with `name` and `short_name` | 1+ |
| `DELETE /api/admin/schools` | `DELETE /Schools` with `name`, `short_name`, or both | 1+ |
| `GET /api/admin/users` | `GET /Users` | 1+ |
| `GET /api/admin/profile?email=...` | `GET /Register` with `to_user` | 1+, eligible target |
| `PATCH /api/admin/profile?email=...` | `PATCH /Register` with `to_user` | 1+, eligible target |
| `DELETE /api/admin/users` | `DELETE /Register` with `to_user` | 1+ |
| `DELETE /api/admin/sessions` | `DELETE /LogIn` with `to_user` | Any admin, eligible target |
| `GET /api/admin/blocked` | `GET /Blocked` | 2+ |
| `DELETE /api/admin/blocked` | `DELETE /Blocked` with exactly one of `email` or `ip_addr` | 2+ |

Existing account registration, own-profile read/update, login/logout, and school lookup remain available. The Schools section follows [Schools.cs](https://github.com/supracharger/SoftwareEngineerTemp/blob/5ba9a9332d0b08a23740dc10b635ce6fc5aac1fd/StudentExchangeBck/Controllers/Schools.cs). Level 1+ administrators can add a school with its name and short name, then delete a listed school after confirmation. Deletion sends both stored values; the backend combines them with AND. A successful mutation refreshes the directory without repeating the mutation if the read fails. The delete response uses `row_count`, rather than `deleted_Rows`. The backend still provides no admin-level-assignment API.

## Target permissions and backend limitations

`/Users` does not return admin levels. The directory verifies profile access for the visible page (eight users, at most three checks in flight) before showing **Manage**. A forbidden target has no profile/session controls. Selecting an eligible profile opens a native modal with editable email, names, school, and optional new password with confirmation. Only changed, nonblank fields are sent. Passwords are cleared after attempts and never stored in browser storage.

Profile forwarding and session termination cannot target an administrator of equal or higher rank. The backend enforces this again on the mutation. Account deletion now uses `to_user` and follows the shared forwarded-target checks. Its control appears only after successful profile-access verification, so equal/higher-rank targets have no profile, session, or deletion controls. Deletion requires typing the exact email into a confirmation dialog. The browser and adapter both send `{ "to_user": "student@example.com" }` as the deletion selector; the former `email` selector is rejected. The backend only deletes the `User` row; dependent-row cleanup is determined by its actual database configuration.

Level 0 has no user-directory/profile-read permission and the backend has no separate nonmutating target-permission endpoint for logout. Its permitted session tool therefore accepts an exact email and relies on the backend to validate the target before ending sessions. No user/profile/block tools appear at this level. `DELETE /LogIn` masks token and forwarded-target validation failures with HTTP 200. Level 1+ session termination therefore rechecks profile eligibility immediately before sending the logout request. Level 0 cannot make this preflight read; the UI reports that the sign-out request was sent without claiming that sessions were ended.

Attempt records can contain counts below the blocking threshold, expired rows, or repeated IPs associated with different users. The UI describes them as attempt records, not as a definitive count of currently blocked accounts. Timestamps are displayed as their stored Mountain-local values without browser timezone conversion. Clearing user records and IP records are separate confirmed operations; neither restores revoked tokens.

## Security and visitor IP forwarding

Every admin operation re-reads `GET /Admin` on the server before calling the protected backend route. A demotion blocks the next action even if the browser has stale UI. Expired tokens clear the local session; a forbidden forwarded target returns `403` without logging out the administrator.

Every visitor backend request now has a JSON body containing the server-verified visitor `ip`, including `/Schools`. The service account logs in without forwarding at startup using server-only `user`, `user_pass`, and `app_access`; `GET /Admin` verifies its membership. The returned access token is cached in server memory and inserted as `admin_token`. A forwarding-expiry response (`400`, `expired: true`) triggers a shared re-login and one retry; visitor-token expiry continues to clear the visitor session. Public Schools lookup remains available when service credentials are absent. `Schools.Get()` is parameterless and does not consume the body or record the forwarded IP; changing that backend behavior would require a backend change. The adapter nevertheless sends the IP on that request as requested.

On Render, `RENDER=true` enables trust in the edge's single `CF-Connecting-IP` address. Missing/invalid edge data fails closed. Outside Render, the socket peer is used and forwarding headers are ignored. Browser-supplied IPs, tokens, `to_user`, and application credentials cannot override the adapter's envelope. GET bodies are sent with Node's HTTP client because browser fetch cannot send them.

Existing HttpOnly, SameSite session cookies, write-origin checks, payload limits, response projections, timeouts, redirect rejection, and upstream error redaction are preserved. No shared credential or backend access token reaches the browser. New APIs return `Cache-Control: no-store`.

## Verification

Run `npm test` and `npm run build`. Integration tests use real HTTP fixtures to inspect every outgoing admin request, including GET bodies, IP forwarding, selector preservation, privilege demotion, forbidden targets, credential injection, malformed responses, and partial-write success. UI tests check hidden controls, direct-route protection, navigation, profile editing, deletion confirmation, session termination, and separate user/IP clearing.

The existing Render Node service remains the deployment target; use its normal deployment process. This change does not create a separate hosted site or change its audience.
