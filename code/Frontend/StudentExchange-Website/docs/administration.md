# Administrator console

The current backend is deployed to Azure, as confirmed by the maintainer. Positive admin levels unlock admin-access management; level 10 unlocks user/profile/school management and account deletion; level 20 unlocks attempt-record tools; level 27 unlocks viewing admin levels; level 30 unlocks changing locked status. Website permission checks and HTTP fixtures use these thresholds.

The `/admin` page is available from **Admin console** in the header after an administrator logs in. Direct navigation requires a valid session and confirmed membership from `GET /Admin`. Regular users never see the admin link. Permission checks fail closed: an unavailable or malformed membership response does not grant access.

The current admin-access and user-directory contracts follow [Admin.cs](https://github.com/supracharger/SoftwareEngineerTemp/blob/88cc232/StudentExchangeBck/Controllers/Admin.cs) and [Users.cs](https://github.com/supracharger/SoftwareEngineerTemp/blob/88cc232/StudentExchangeBck/Components/Users.cs) at commit `88cc232`. Target account selectors use `to_user`, containing the exact stored target email.

| Admin access | Visible tools |
| --- | --- |
| Any administrator, including level 0 | Overview, own membership/level, end an eligible user's sessions |
| Level above 0 | Grant/update/remove admin access for eligible lower-ranked targets; assigned levels must be below the caller's level |
| Level 10+ | User directory, search, school filter, pagination, eligible profile reads/updates, account deletion, school directory/add/delete |
| Level 20+ | User/IP attempt records, search, pagination, clear user or IP records |
| Level 27+ | View admin levels in the directory |
| Level 30+ | Optionally change locked status when granting/updating admin access |

Navigation and controls outside the administrator's permissions are omitted, rather than disabled. Disabled states are only used for temporary loading, missing confirmation, or pagination boundaries.

## Backend route coverage

| Website adapter | Backend request | Required level |
| --- | --- | --- |
| `GET /api/admin` | `GET /Admin` | Logged-in user |
| `POST /api/admin` | `POST /Admin` with `to_user`, `level`, optional `locked` | Above 0; `locked` requires 30+ |
| `PATCH /api/admin` | `PATCH /Admin` with `to_user`, `level`, optional `locked` | Above 0; `locked` requires 30+ |
| `DELETE /api/admin` | `DELETE /Admin` with `to_user` | Above 0 |
| `GET /api/admin/schools` | `GET /Schools` with name/short-name pairing | 10+ |
| `POST /api/admin/schools` | `POST /Schools` with `name` and `short_name` | 10+ |
| `DELETE /api/admin/schools` | `DELETE /Schools` with `name`, `short_name`, or both | 10+ |
| `GET /api/admin/users` | `GET /Users` | 10+ |
| `GET /api/admin/profile?email=...` | `GET /Register` with `to_user` | 10+, eligible target |
| `PATCH /api/admin/profile?email=...` | `PATCH /Register` with `to_user` | 10+, eligible target |
| `DELETE /api/admin/users` | `DELETE /Register` with `to_user` | 10+ |
| `DELETE /api/admin/sessions` | `DELETE /LogIn` with `to_user` | Any admin, eligible target |
| `GET /api/admin/blocked` | `GET /Blocked` | 20+ |
| `DELETE /api/admin/blocked` | `DELETE /Blocked` with exactly one of `email` or `ip_addr` | 20+ |

Existing account registration, own-profile read/update, login/logout, and school lookup remain available. The Schools section follows [Schools.cs](https://github.com/supracharger/SoftwareEngineerTemp/blob/5ba9a9332d0b08a23740dc10b635ce6fc5aac1fd/StudentExchangeBck/Controllers/Schools.cs). Level 10+ administrators can add a school with its name and short name, then delete a listed school after confirmation. Deletion sends both stored values; the backend combines them with AND. A successful mutation refreshes the directory without repeating the mutation if the read fails. The delete response uses `row_count`, rather than `deleted_Rows`.

The Admin access section accepts an exact target email, so levels 1–9 can use it without access to the user directory. Grant and update require a nonnegative integer level strictly below the caller's level. Level 30+ can optionally send `locked: 0` or `locked: 1`; omitting it preserves the backend default or existing value. Every write requires confirmation. Removing admin access deletes the admin membership, preserving the student account. The backend rejects ineligible targets, including equal/higher-ranked admins and locked admins when the caller is below 30.

## Target permissions and backend limitations

`/Users` returns parallel `isAdmin` and `locked` columns as numeric flags. The adapter validates and normalizes these to booleans; the directory shows student/admin status and locked admin status. Only level 27+ callers receive the `level` column, with `-1` for nonadmins. The adapter normalizes this sentinel to null so students have no displayed admin level. The adapter projects this column only when the caller has permission. The directory verifies profile access for the visible page (eight users, at most three checks in flight) before showing **Manage** and **Admin access…**. Known equal/higher-level, locked-ineligible, and own-account targets have no admin-access shortcut. A failed profile check leaves that target without controls while preserving successful checks for other users; service errors remain visible for retry. A forbidden target has no profile/session controls. Selecting an eligible profile opens a native modal with editable email, names, school, and optional new password with confirmation. Only changed, nonblank fields are sent. Passwords are cleared after attempts and never stored in browser storage.

Profile forwarding and session termination cannot target an administrator of equal or higher rank. The backend enforces this again on the mutation. Account deletion now uses `to_user` and follows the shared forwarded-target checks. Its control appears only after successful profile-access verification, so equal/higher-rank targets have no profile, session, or deletion controls. Deletion requires typing the exact email into a confirmation dialog. The browser and adapter both send `{ "to_user": "student@example.com" }` as the deletion selector; the former `email` selector is rejected. The backend only deletes the `User` row; dependent-row cleanup is determined by its actual database configuration.

Level 0 has no user-directory/profile-read permission and the backend has no separate nonmutating target-permission endpoint for logout. Its permitted session tool therefore accepts an exact email and relies on the backend to validate the target before ending sessions. No user/profile/block tools appear at this level. `DELETE /LogIn` masks token and forwarded-target validation failures with HTTP 200. Level 10+ session termination therefore rechecks profile eligibility immediately before sending the logout request. Level 0 cannot make this preflight read; the UI reports that the sign-out request was sent without claiming that sessions were ended.

The deployed `GET /Blocked` includes successful access records as well as failure records. A `count` of `-1` means successful access for both `blockedUsers` and `blockedIPs`; these rows remain visible, searchable, and clearable and display “Successful” instead of a negative failure count. Nonnegative counts display the number of failed attempts. Counts below `-1` and noninteger counts are rejected. Records can include attempts below the blocking threshold or expired rows. The deployed `GET /Blocked` response groups associated users under each IP as `users: [{ name, email }]`; the website displays one row per IP with its count, expiry, and all associated users. Search matches the IP and every nested user name/email. An empty users array displays “No associated users.” Nested identities are projected server-side so extra fields cannot expose credentials. The UI describes them as attempt records, not as a definitive count of currently blocked accounts. Timestamps are displayed as their stored Mountain-local values without browser timezone conversion. Clearing user records and IP records are separate confirmed operations; neither restores revoked tokens.

## Security and visitor IP forwarding

Every admin operation re-reads `GET /Admin` on the server before calling the protected backend route. A demotion blocks the next action even if the browser has stale UI. Expired tokens clear the local session; a forbidden forwarded target returns `403` without logging out the administrator.

Every visitor backend request now has a JSON body containing the server-verified visitor `ip`, including `/Schools`. The service account logs in without forwarding at startup using server-only `user`, `user_pass`, and `app_access`; `GET /Admin` verifies its membership. The returned access token is cached in server memory and inserted as `admin_token`. A forwarding-expiry response (`400`, `expired: true`) triggers a shared re-login and one retry; visitor-token expiry continues to clear the visitor session. Public Schools lookup remains available when service credentials are absent. `Schools.Get()` is parameterless and does not consume the body or record the forwarded IP; changing that backend behavior would require a backend change. The adapter nevertheless sends the IP on that request as requested.

On Render, `RENDER=true` enables trust in the edge's single `CF-Connecting-IP` address. Missing/invalid edge data fails closed. Outside Render, the socket peer is used and forwarding headers are ignored. Browser-supplied IPs, tokens, `to_user`, and application credentials cannot override the adapter's envelope. GET bodies are sent with Node's HTTP client because browser fetch cannot send them.

Existing HttpOnly, SameSite session cookies, write-origin checks, payload limits, response projections, timeouts, redirect rejection, and upstream error redaction are preserved. No shared credential or backend access token reaches the browser. New APIs return `Cache-Control: no-store`.

## Verification

Run `npm test` and `npm run build`. Integration tests use real HTTP fixtures to inspect every outgoing admin request, including GET bodies, IP forwarding, selector preservation, privilege demotion, forbidden targets, credential injection, malformed responses, and partial-write success. UI tests check hidden controls, direct-route protection, navigation, profile editing, deletion confirmation, session termination, and separate user/IP clearing.

The existing Render Node service remains the deployment target; use its normal deployment process. This change does not create a separate hosted site or change its audience.


Marketplace listing review, deletion, and category creation are also available at level 10+. See [marketplace integration](marketplace.md) for the current contracts and backend limitations.
