# Live backend verification

Verified on October 8, 2026 against the deployed Azure API through the website's same-origin Node adapter. Shared credentials were supplied by the managed environment's secret binding. No shared credential value, user token, or generated test password was written to files or logs.

| Check                                             | Result                                        |
| ------------------------------------------------- | --------------------------------------------- |
| Automated UI and HTTP contract tests              | 38 passed                                     |
| TypeScript check and production build             | Passed                                        |
| Live school lookup                                | Passed; MSU Denver and CU Denver returned     |
| Live registration and login                       | Passed through both API requests and Chromium |
| Profile retrieval using the upstream GET body     | Passed                                        |
| Session restoration after browser reload          | Passed                                        |
| Partial name update and readback                  | Passed                                        |
| School and password updates                       | Passed in Chromium                            |
| Logout, then login with the changed password      | Passed                                        |
| Final logout and session cleanup                  | Passed                                        |
| HttpOnly cookie and no browser credential storage | Passed                                        |
| Mobile account layouts at 320px and 390px         | Passed; no horizontal overflow                |
| Unexpected API failures or browser script errors  | None observed in the live browser workflow    |

The browser used the built website served locally by Node, connected to the real Azure backend through verified HTTPS and the managed proxy. This validates the website/backend integration; it is not a Render deployment check. Production Secure-cookie behavior remains covered by the automated server tests.

The initial browser workflow passed before IP forwarding was added. After the forwarding change, a fresh live API workflow passed school lookup, registration, login, GET-body profile retrieval, name update/readback/restoration, and logout using the securely injected `admin_token` and local socket IP. Azure responses do not expose the stored IP attribution, so these checks establish acceptance of the new request envelope rather than backend attribution.

Automated fixtures verify that all account calls (including follow-up GET reads) include the selected IP and admin credential, while `/Schools` has no body or credentials. They cover Render `CF-Connecting-IP`, spoofed forwarding headers, IPv4/IPv6, missing or malformed edge headers, browser body injection, and missing admin configuration. Production build/type checking passed after this change. No actual Render deployment or public-edge smoke test was performed.

## Earlier test data

These clearly named test accounts were created as part of the authorized live tests:

- `codex.test.bd04900d2d@example.com` — first name Codex, last name Integration.
- `codex.browser.d422866342@example.com` — first name Codex, last name Browser.
- `codex.forward.dc777f4fad@example.com` — first name Codex, last name Forwarding.

Temporary name/school changes were restored, and all three accounts were logged out. The browser account's password was changed during verification. Passwords were generated in memory and were not retained. These accounts were originally left behind before a deletion endpoint was available. On October 9, 2026, sudo-authorized deletion attempts for all three returned `400` with "Unknown email: not found in data base." They were already absent; no deletion was needed.

## Updated backend contract and cleanup — October 9, 2026

The live `/Schools` response now contains `schools` and `short_names`, with two school names. The adapter requires lowercase `schools`; the obsolete uppercase field is rejected.

The updated offline suite covers sudo login, privileged DELETE request fields, cleanup failures, and afterEach deletion of successful fixture registrations. The opt-in live test creates a unique test account, logs in, and deletes it in finally using the securely bound sudo credentials. Sudo is not logged out because that backend operation revokes all of the administrator's sessions. No privileged credentials are exposed to the website browser or saved to source files.

After the update, 43 offline tests and the production build passed. The separately enabled live test also passed registration, login, sudo-authorized deletion, and verification that the deleted account can no longer log in. No new test accounts remain from these successful live runs.

## Subsequent administrator integration

The administrator console and test-cleanup helper now prepare `DELETE /Register` using `to_user`, following the upcoming backend contract. Deploy that backend change before using either deletion workflow against live data. Every adapter backend request now carries the trusted visitor IP, including `/Schools`; its parameterless controller does not consume the forwarded body. Earlier validation results above describe the backend contract at the time of those runs.


## Service-token forwarding migration (October 10, 2026)

The website now uses `user` and `user_pass` to obtain an admin access token at startup and sends that token as `admin_token`. The former `admin_token` environment secret is no longer read. Local HTTP fixtures cover startup, reuse, concurrent refresh, a single retry, visitor-token expiry, and unavailable/non-admin service accounts. Earlier live results above used the former shared-secret contract and do not validate this migration.

Deployment prerequisites: deploy the updated backend, configure server-only `user` and `user_pass`, and grant that account membership in the backend `Admins` table. Until these are ready, account operations remain unavailable; no live migration test or deployment has been performed. The process health endpoint reports configuration presence, not authentication readiness.
