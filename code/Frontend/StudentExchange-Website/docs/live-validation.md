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

## Test data remaining

These clearly named test accounts were created as part of the authorized live tests:

- `codex.test.bd04900d2d@example.com` — first name Codex, last name Integration.
- `codex.browser.d422866342@example.com` — first name Codex, last name Browser.
- `codex.forward.dc777f4fad@example.com` — first name Codex, last name Forwarding.

Temporary name/school changes were restored, and all three accounts were logged out. The browser account's password was changed during verification. Passwords were generated in memory and were not retained. Account records remain because the documented API provides no deletion endpoint; a backend administrator can remove these records if desired.
