# Presenter notes

## 1. Student Exchange | Progress Review

Open with the actual state: account and administrator workflows are implemented and fixture-tested; the website marketplace remains a local preview. Both application builds pass, but the suite is not entirely green. This review covers concrete source, fresh tests, browser evidence and team-reported contributions. The original proposal document/date and final presentation deadline were not supplied. Do not claim percentage completion or production readiness.

Evidence: Application f91b923 · branch 14c9386 · review 24 Oct 2026

## 2. Current status: the foundation works; the market is still a preview

State the evidence precisely. npm run build and dotnet build both pass. Vitest has 118 registered cases: 116 passed, one failed, one opted-out live case. Local Chromium verifies six sample cards, three after the Textbooks filter, local message/offer updates and no horizontal overflow on the 390-pixel home page. This is not a new Azure or Render live verification. The failure is an accessible-list label mismatch. The offer form also has a separately observed min/step defect.

Evidence: Fresh build/test logs; browser-checks.json; Website/docs/live-validation.md

## 3. Problem, users and project goals

The problem and current product intent are derived from the implemented UI: help students find affordable books, supplies, electronics and campus-living goods. Stakeholders are students, administrators, the implementation team and review stakeholders. Do not invent institution partnerships or research participants. The UI explicitly says payment/pickup is arranged directly; there is no platform checkout integration. Thomas is working on the mobile web experience, not a separately verified native application.

Evidence: Website/src/App.tsx; data/listings.ts; admin.mjs; team role input

## 4. What changed: a verified repository comparison

The dates are repository checkpoints, not asserted proposal dates. The October 11 snapshot had the backend and API documentation. The October 24 source update adds the website, adapter, UI/HTTP tests, deployment configuration and listing endpoint, with schema/config changes. Later October 24 commits add UML and DFD design atlases. The user independently reports the team contributions since the proposal. No claim is made that all source was authored on the commit date or that all changes were planned scope changes.

Evidence: Git compare 2307809 (11 Oct) → f91b923 (24 Oct); team-reported contributions

## 5. Functional requirements: concrete acceptance and status

Walk through each requirement and the precise status. Account/admin implementation is supported by fixture tests; listing integration is not complete. The user interface has contact/offer previews but no persistence or seller delivery. StudentExchange does not process payments in its current product copy. Proposal-specific additions/removals cannot be formally mapped without that artifact.

Evidence: Source routes; test-summary.json; browser-checks.json; PROCESS-SPECS.md

## 6. Non-functional requirements: evidence and remaining limits

These are requirements relevant to the current system, not claims of original proposal wording. Credentials remain server-side and cookies are HttpOnly; same-origin checks and explicit response projections reduce exposure. Important unresolved risks include reversible password storage, listing endpoint authorization and database integrity assumptions. There are bounded request deadlines, but no load/performance result or production SLA. A single Render instance is consistent with in-memory sessions; scaling requires a shared store.

Evidence: api.mjs; client-ip.mjs; Sql.cs; Env.cs; browser/tests/build evidence

## 7. Completed implementation: what is actually present

The implementation is substantial: the student site and account/admin adapter, backend account/school/admin/attempt operations, local HTTP fixture coverage, a production build and deployment configuration exist. Eight account/security tables are declared. ListingController adds three operations on a separate path but lacks a declared Listings schema. The design atlases explain current behavior. This review does not assert that configuration equals deployed production readiness.

Evidence: Website/src and server; Backend/Controllers and Components; user contribution report

## 8. Website evidence: the current frontend running locally

This screenshot is the actual current frontend bundle, not the repository WebsiteDesign mockup. The account backend was intentionally unconfigured for this capture; it demonstrates the local marketplace UI only. Browser checks found six cards, three after the Textbooks filter, no script errors and no horizontal overflow at 390 pixels on the home page. That limited mobile observation does not establish full mobile acceptance or completion of Thomas’s ongoing work.

Evidence: Local Chromium capture; npm run build; assets/website-home.png

## 9. Messaging UI: local interaction and the remaining delivery gap

Robert Richardson is credited by the team for messaging UI. The browser capture submits a message and an offer of $20.01. Both become local strings in one shared messages array. There is no seller delivery, persistent conversation or per-listing conversation store. A whole-dollar offer such as $20.00 is blocked by native HTML validity because min=0.01 and step=1 have incompatible alignment for whole-dollar values; the JS positive-number check is never reached in that case. The proposed correction is step=0.01 with positive amount validation. No source code was changed during the review.

Evidence: App.tsx form handlers; local browser capture; team-reported attribution

## 10. Deployed admin console: overview and access context

The team provided a screenshot of the deployed /admin page, showing an authenticated overview with seven registered students, two user-attempt records and two IP/network-attempt records at the capture moment. The displayed administrator context is Level 20. This is stronger visual evidence of an authenticated deployed admin page than configuration alone. It does not independently establish all mutations, current source revision, current counts or every permission path. Attempt-record counts are observations, not proof that every record is an active block. Preserve that distinction when speaking. Browser chrome is outside the presentation crop; the original screenshot remains unchanged.

Evidence: User-provided admin overview screenshot; team-confirmed Render deployment

## 11. Deployed user directory: visible management capabilities

The second deployed screenshot shows the Users view with seven total users, name/email/school search, school selection, admin status and locked indicators, joined timestamps and management controls. Describe visible UI affordances as evidence of the directory view; do not claim every action was clicked or that a screenshot proves authorization enforcement. Fixture tests support the corresponding contracts and permission checks. The source shows caller/target separation and rank/locked guards. Avoid presenting personal account details as product requirements; the slide focuses on capability and structure. The original source is retained and cropping is applied only in the presentation layout.

Evidence: User-provided admin Users screenshot; server/admin.mjs and api.mjs; backend Users controller

## 12. Current architecture: browser → adapter → API → data

The browser calls the Node website origin for static assets and /api routes. Node translates body credentials and GET bodies, retains opaque-cookie session mappings and a service admin token in memory, and uses HTTPS to the configured ASP.NET service. Shared helpers read the configured SQLite account database. ListingController bypasses the shared Sql helper and independently uses ../Data.db. The team confirms the backend is deployed on Azure and the website at https://studentexchange.onrender.com. This review does not independently establish the deployed source revision or current full workflow acceptance. There is no third-party OAuth, payment or messaging service integration in the source.

Evidence: Website/server/app.mjs, api.mjs, render.yaml; Backend/Program.cs, Sql.cs, Env.cs, Listing.cs

## 13. Walk one request: reading a signed-in profile

Use a profile read to explain the consequential design. Browser fetch sends GET /api/profile with an opaque HttpOnly cookie, no body token. Node looks up the 12-hour local session and selects the stored backend user token. The forwarding client supplies app_access, verified IP and a cached login-issued service admin_token. Node http(s).request can send the backend GET JSON body; browser fetch cannot. AppAuthJson validates app/IP and visitor token; Register reads user/school and returns profile data. Node projects the four permitted public fields. No password, user token or service token reaches the browser.

Evidence: src/api/accounts.ts; hooks/useAccount.ts; server/api.mjs; Register.cs; AppAuthJson.cs

## 14. UML use cases: goals and implemented boundaries

This is a readable selected use-case view, not an attempt to put every endpoint on one slide. A signed-in student also has visitor capability, shown by generalization. Browse and local message/offer preview are available without the account flow. Register/login and profile/logout are backed by the adapter/API implementation. Admin goals are capability-gated and target-scoped. The boundary covers Student Exchange; the users are outside it. The next slide’s actual class model and subsequent sequence must agree with these goals.

Evidence: Adapted from docs/uml D02/D03; source App.tsx and server/api.mjs

## 15. UML class view: shared credentials and request inheritance

Explain that AppAuthJson combines body fields with static validation operations in the current code. Register.Info, LogIn.Info and Admin.Info inherit those fields. Nullable request properties support per-operation handling; they do not mean that required registration/login fields are optional at runtime. These DTOs differ from the database tables and from Node’s browser-safe TypeScript contracts. The schema model follows on separate slides. This design also exposes a coupling trade-off: validation and request shape share a class.

Evidence: Backend/Components/AppAuthJson.cs; Controllers/Register.cs, LogIn.cs, Admin.cs

## 16. UML sequence: login establishes a website session

Time flows downward. Backend login verifies credentials/attempt admission, reuses or issues a token and returns it only to Node. Node then uses GET /Register with the token in the JSON body to obtain a public profile. Only a validated profile permits local session creation. The browser receives a projected profile and opaque HttpOnly cookie, not the backend token. The Node self-message denotes the local Map write. Backend token validity and local session validity are separate clocks. Failed login/profile read is an alternative result; it does not establish the new Map entry.

Evidence: docs/uml D10; api.mjs /api/login; LogIn.Post; Register.Get

## 17. Database core: one school, many users, optional admin membership

The declared account core includes Schools, User, Admins and Access_Token. User.school_id is required; an account can have zero or one Admins row and many access tokens. Email/token uniqueness matters to lookup and issuance. The schema declares RESTRICT for school/user and user/admin relationships and CASCADE for tokens, but the connection does not explicitly enable foreign keys. Do not claim these runtime effects were verified. Password and email values are deterministically reversibly encrypted in the current code, which is a security debt rather than a recommended password strategy.

Evidence: DB_Schema.txt; Register.cs; LogIn.cs; Components/Sql.cs

## 18. Security data: attempts are observations, not always blocks

These complete the eight-table declared schema. Multiple historical attempt rows may exist, so draw 0..* rather than assuming a unique per-user row. User_Has_IPs has NOT NULL foreign keys and a unique pair. The active time window and count determine blocking, not merely table membership. A successful first observation can have count -1. At user threshold 10, existing tokens are revoked; clearing attempts later does not recreate them. IP blocks do not directly revoke tokens. Process-local identity locks serialize related updates but do not coordinate multiple instances.

Evidence: DB_Schema.txt; Users.cs; IP.cs; docs/dfd P35/P43/P44

## 19. Listing integration: two contracts currently stop short of a vertical slice

Tristan is credited with the Listing endpoint; Andrew’s reported website work excludes that endpoint and messaging UI. Describe the gap without dismissing delivered code: the current website imports six samples with visual fields such as condition/cover/label, whereas the backend expects Listings title/description/price/category/user_id/datetime and joins User. The adapter exposes no listing route. Listings is absent from the supplied schema and the controller selects ../Data.db independently. CRUD lacks shared auth/ownership checks. These need one agreed schema/DTO/security contract before demonstrating live marketplace persistence.

Evidence: Website/data/listings.ts, App.tsx, server/api.mjs; Backend/Listing.cs; DB_Schema.txt

## 20. Three identities and two expiry clocks

Keep these three identities separate. se_session is an opaque cookie ID. Node maps it to the visitor access_token. Separately, a configured service account logs in and its admin access token becomes admin_token for trusted IP forwarding. Human admin authorization comes from the visitor’s own token and Admins level; it is not conferred by the service token. to_user is a selector for an eligible target while sudo_id/caller level retain provenance. Local Map expiry is 12 hours; backend ordinary/admin tokens last 21/3 days. Public school reads and login admission have different checks from token-authenticated actions.

Evidence: api.mjs sessions/forwarding client; AppAuthJson.ValidateApp/ValidateToken; Env.cs

## 21. Technology decisions: constraints, benefits and trade-offs

Use precise reasons, not generic technology praise. React/TypeScript fits a stateful UI and explicit browser contracts. Node is consequential because browser fetch cannot send the upstream GET JSON body and shared credentials should stay off the client. ASP.NET supplies typed controller/validation infrastructure already present. SQLite fits a portable single-instance prototype but brings path, schema migration and concurrency/foreign-key obligations. Render hosting uses the existing Node manifest; Azure is the configured API destination. These explanations are inferred design fit, not a claim that a formal ADR or original team rationale exists.

Evidence: package.json; vite.config.ts; api.mjs; csproj; Sql.cs; render.yaml

## 22. Deployed: Azure backend + Render website

Render manifest specifies Node 24.19.0, npm ci/build, npm start, /healthz and one instance. Server-only backend/app_access/user/user_pass settings must be configured; the service user must actually be an admin under the deployed backend contract. The configured Azure URL identifies a destination, not proof of readiness. The team confirms Azure backend and Render website deployment. Historical October 8/9 live workflows preceded the October 10 service-token migration; those dated notes do not independently verify the currently deployed authentication contract. Account DB schema/config files and key pairing must exist. Rollback should preserve compatible configuration/schema. Do not display credentials or run privileged live mutations during this review.

Evidence: render.yaml; server/index.mjs, app.mjs; Env.cs; Website/docs/live-validation.md

## 23. Verification: current results and historical live evidence

The current test run registered 118 cases: 116 pass, one fail, one skipped. The passed breakdown is 84 server/helper tests and 32 UI tests. AccountPanel and AdminPage suites pass; App has two passes and one failed accessible-list expectation. The separately enabled live test was intentionally skipped. Frontend typecheck/production build and backend build pass. Browser checks use the local current build with backend account config absent. Earlier live reports establish only their dated contracts: October 8/9, before the October 10 service-token migration. The team has supplied screenshots of the authenticated deployed admin overview and user directory. Those confirm the visible deployed views at capture time; no new full workflow mutation/load test is represented as passing.

Evidence: evidence/test-summary.json, browser-checks.json, build.log, dotnet-build.log; live-validation.md

## 24. Major implementation risks: next integration priorities

Lead with the risks that could prevent a correct final demo. ListingController accepts UserId and delete ID without shared auth or ownership and uses an undeclared table on a separately resolved database path. Passwords are reversibly encrypted instead of stored with a dedicated salted password hash. The live service-token migration is unverified. These are implementation findings, not theoretical checklists. Proposed remediation ownership follows the user-supplied roles; it is not a claim that those tasks are already in progress. A class-project demonstration must still avoid presenting unauthenticated destructive listing operations as correct ownership behavior.

Evidence: Listing.cs; DB_Schema.txt; DeterministicEncryption.cs; Sql.cs; api.mjs; team role report

## 25. Two concrete quality issues found during this review

Issue one: the test expects getByRole(list, name Sample listings), but the current ul.listing-grid has no accessible label. The fix should restore the intended accessible name, keeping a meaningful assertion, not simply deleting the test. Issue two: min=0.01 with step=1 makes $20.00 a native step mismatch; $20.01 succeeds and produces a local preview. Proposed fix: choose cent precision, positive validation and a browser test for whole-dollar and fractional values. These observations are separate from the 116 passed count. Both fixes belong in application work after this review; they were not silently applied to change the evidence.

Evidence: src/App.test.tsx:20; App.tsx listing-grid and offer input; evidence files

## 26. Individual contributions since the proposal

Ask each person to state their row. Tristan: “I completed UML diagrams, backend comments and the Listings endpoint.” Andrew: “I completed the other backend work and the website except the Listings endpoint and messaging UI.” Alex: “I prepared the previous PowerPoint.” Robert Richardson: “I completed the messaging UI.” Thomas: “I am still working on the mobile web app; no separate completed mobile deliverable was reported.” These are user-supplied contribution claims, not deductions from a shared Git identity. Andrew’s website delivery is an explicit expansion beyond the original backend role. Do not credit Alex with implementation or Tristan with all backend code.

Evidence: User-confirmed names, roles and contributions; source verifies artifacts, not individual authorship

## 27. Current work and proposed next ownership

Be candid about the difference between a reported current assignment and a proposed next assignment. The team only explicitly supplied ongoing mobile web work for Thomas. For the other members, completed work is known but their current tasks were not specified. The proposed assignments connect the existing role strengths to remaining acceptance work; do not present these as tasks already underway or approved. Tristan as lead should agree owners/dates, Andrew lead integration, Alex package evidence/notes, Robert Richardson own messaging UX and Thomas mobile acceptance.

Evidence: Team input; current implementation findings; proposed final-delivery plan

## 28. Next steps: three gates before the final presentation

This is a dependency plan, not invented calendar commitments. Gate 1 completes a persistent authorized listing vertical slice with a declared schema and coherent database path. Gate 2 fixes quality/security blockers and runs current integration/mobile/authorization checks, including the live service-token migration with disposable data and cleanup. Gate 3 freezes a known working build and rehearses a bounded final demonstration with evidence and contribution deltas. Dates and effort cannot be honestly derived without the final deadline; Tristan should anchor this plan after the team supplies it.

Evidence: Implementation gaps + current verification; proposed acceptance plan

## 29. Design consistency: one capability across every layer

This slide demonstrates design understanding rather than a diagram inventory. Profile editing maps from the use case to Register.Info and AppAuthJson, through PATCH /api/profile and PATCH/GET /Register, to User/Schools and readback-aware tests. Administration uses the caller token and to_user target with Admins rank/locked data; fresh permissions are enforced at adapter and backend. Listing discovery currently maps to imported samples, not a Listings query. The deliberate mismatch is shown as an integration backlog, preventing the team from pretending the diagramed future exists today.

Evidence: UML/DFD atlases; source contracts; fresh verification

## 30. Progress review walkthrough and final-demo acceptance

For this progress review, show the local UI, six samples, category filtering and a local message/offer preview; explain rather than hide that messages stay in memory. Walk through the login sequence and profile request, then show fresh build/test evidence with the one known failure. Save the full live demonstration for final: a disposable student account, persisted owner-authenticated listing, another browser read, rejected unauthorized deletion, allowed cleanup and evidence that no secrets reach the browser. Do not perform live destructive operations just to decorate this review. End by naming ownership and the three gates, not claiming completion percentages.

Evidence: Local build screenshots + test/build artifacts; proposed final acceptance

## 31. Appendix | route and permission reference

Use when asked a precise API question. Shared app and service forwarding fields are supplied by Node. Public Schools GET is parameterless in the backend even when the adapter sends a body. Token-protected GET bodies require Node transport. Admin profile/deletion use caller token and to_user; blocked selectors email/IP are separate from to_user. Backend directory level visibility begins at 27 but the UI projection uses 30. Admin DELETE logout can mask validation failure. This table is selective; the complete source/DFD route register is linked in the evidence README.

Evidence: Website/server/api.mjs, admin.mjs; Backend controllers and AppAuthJson

## 32. Appendix | three edge cases that reveal design understanding

Explain three non-obvious cases. Forwarding token expiry is explicitly recognized as pre-operation rejection and permits a single coalesced service-token renewal/retry; ordinary server, forbidden or visitor-expired errors do not permit replay. A committed profile write followed by a failed read returns saved status with profile null and should not silently repeat a password update. Logout returns success even on certain backend token-validation failures; the UI must not certify target revocation. These are precisely the sort of details that show the team understands its implementation, beyond the names of frameworks.

Evidence: api.mjs upstream/forwarding/profile/logout; AppAuthJson.cs; LogIn.cs

## 33. Appendix | milestone contribution record

This is the short contribution record for the current review milestone, with the previous milestone named as the proposal but its date unconfirmed. It does not redistribute all work over guessed historical dates. For every later gate, each person must add one artifact or result completed since the prior milestone plus the task currently owned. Do not use commit counts to divide contribution percentages: current repository commits use a shared Andrew identity and can aggregate team work. Alex’s previous presentation is a separately reported prior deliverable; its exact date and whether it was the proposal deck are not confirmed.

Evidence: Team responses in this conversation; CONTRIBUTIONS.csv; repository comparison

## 34. Appendix | evidence, limitations and presentation handoff

Explain the provenance. Repository source supports technical claims; fresh command logs and browser output support verification claims; the team’s two replies support names, roles and contributions. Earlier live results are explicitly dated and predate migration. The exact original proposal wording/date, formal change approvals, final presentation date and most current personal assignments remain unavailable. Thus the deck states current goals and repository change evidence rather than inventing a proposal delta, and labels next assignments as proposals. Materials include editable native diagrams, actual local screenshots, notes, evidence summaries, a contribution CSV and reproducible source.

Evidence: Source f91b923; branch 14c9386; fresh local verification; team statements
