# Student Exchange — UML design atlas

A detailed model of the React website, Node adapter, ASP.NET Core backend and SQLite persistence, based on repository commit [`f91b923`](https://github.com/supracharger/SoftwareEngineerTemp/tree/f91b923f4ec8f1072b3dda07070916459342d7a2). The supplied **UML (1).pdf**, an 81-page PowerPoint export, provides the notation, design concepts and visual direction. System-specific behavior comes from the code at that commit. The attachment's examples are reference material, not additional instructions or requirements for Student Exchange.

## Open the deliverables

- **[Editable PowerPoint — 31 slides](StudentExchange-UML.pptx)**: text, boxes, actors, lifelines, edges and arrowheads are native editable PowerPoint objects. Speaker notes include the source and principal design finding.
- **[Vector PDF — 31 pages](StudentExchange-UML.pdf)**: full presentation, searchable text and an outline for navigation.
- **[Individual SVG diagrams](svg/)**: scalable vectors suitable for documents, reports and web viewing.
- **[Editable model](model.json)** and **[renderer](render.py)**: reproducible source for the PDF, PowerPoint and SVGs. Edit the JSON geometry/text or edit PowerPoint objects directly.
- **[Verification results](VALIDATION.md)**: scope, checks and limits of verification.

The deck contains 25 numbered diagrams and six supporting pages: cover, index, notation, authorization matrix, integration findings and source traceability. It uses the reference's navy title bands, pastel groups and yellow takeaway bands, with one question per diagram. It deliberately avoids a single unreadable system-wide diagram.

## Diagram index

| ID | View | Question answered | Main evidence |
| --- | --- | --- | --- |
| [D01](svg/D01.svg) | Architecture context | Where are the system and storage boundaries? | App.tsx, server/app.mjs, api.mjs, Program.cs |
| [D02](svg/D02.svg) | Visitor/student use cases | What can a visitor or signed-in student accomplish? | App.tsx, useAccount.ts, accounts.ts |
| [D03](svg/D03.svg) | Administration use cases | Which admin role can perform which goal? | server/admin.mjs, Admin/Register/Blocked/Schools controllers |
| [D04](svg/D04.svg) | React components | Which UI components and hooks collaborate? | src/App.tsx, components/, hooks/, api/ |
| [D05](svg/D05.svg) | Adapter components | How are browser requests translated and protected? | server/app.mjs, api.mjs, admin.mjs, client-ip.mjs |
| [D06](svg/D06.svg) | Backend controller classes | Which classes expose the HTTP operations? | Controllers/*.cs, Components/Users.cs |
| [D07](svg/D07.svg) | DTO inheritance | Which request types inherit shared auth fields? | AppAuthJson.cs and nested Info classes |
| [D08](svg/D08.svg) | Persistence class model | What are the eight declared tables and their multiplicities? | DB_Schema.txt, Sql.cs |
| [D09](svg/D09.svg) | Listing contract boundary | How do preview data and listing API contracts differ? | data/listings.ts, App.tsx, Listing.cs |
| [D10](svg/D10.svg) | Login sequence | How does a backend token become a website cookie session? | api.mjs login handler |
| [D11](svg/D11.svg) | Registration sequence | Where do normalization, school lookup and uniqueness occur? | api.mjs, Register.cs Post / ValidateFormatInfo |
| [D12](svg/D12.svg) | Profile update sequence | What happens if a committed update cannot be read back? | api.mjs profile PATCH, useAccount.ts |
| [D13](svg/D13.svg) | Admin deletion sequence | How are caller and target identities kept distinct? | api.mjs admin/users, AppAuthJson.cs, Register.cs Delete |
| [D14](svg/D14.svg) | Forwarding renewal sequence | When is a rejected operation safe to retry? | createForwardingClient, ValidateApp |
| [D15](svg/D15.svg) | Logout sequence | What is revoked and what does HTTP 200 actually prove? | api.mjs logout, LogIn.cs Delete |
| [D16](svg/D16.svg) | Marketplace activity | How do filtering, messages and offers update browser state? | App.tsx form handlers |
| [D17](svg/D17.svg) | Token/target activity | Which identity and hierarchy guards must pass? | AppAuthJson.cs ValidateToken |
| [D18](svg/D18.svg) | Attempt-window activity | How do observations become temporary blocks? | Users.cs, IP.cs, Env.cs |
| [D19](svg/D19.svg) | Website session state | What causes local session creation and invalidation? | api.mjs sessions / sessionFor / catch |
| [D20](svg/D20.svg) | Marketplace UI state | Which UI states are reachable and what persists locally? | App.tsx selectedListingId, messageOpen, offerOpen |
| [D21](svg/D21.svg) | Deployment | What runs in the browser, Render and the backend host? | render.yaml, index.mjs, Env.cs, Sql.cs |
| [D22](svg/D22.svg) | Package dependencies | What architectural layers and direct dependencies exist? | src/server imports and backend helper calls |
| [D23](svg/D23.svg) | Startup/maintenance sequence | How does asynchronous startup cleanup relate to daily work? | Program.cs, Maitenance.cs and CleanUp methods |
| [D24](svg/D24.svg) | Listing API sequence | What does the separate, unintegrated listing API do? | Controllers/Listing.cs |
| [D25](svg/D25.svg) | Communication diagram | Which collaborators exchange the numbered login messages? | api.mjs login + forwarding + session creation |

Paths in diagram footers use `Website/` for `StudentExchange-Website/` and `Backend/` for `StudentExchangeBck/`. Persistence boxes are UML classes stereotyped as tables; they are not claimed to be existing C# entity classes. React functions are modeled as components. Sequence alternatives are summarized with guards or explicit alternate outcomes; the diagrams omit routine transport plumbing to preserve readability. D23 depicts one permitted interleaving, not a guarantee that background cleanup finishes before the host starts.

## Use-case contracts

### UC01 — Browse and inspect sample listings

**Actor:** visitor or signed-in student. **Precondition:** React application loaded. **Trigger:** enter a query, choose a category or select a card. The UI filters the six records imported from `src/data/listings.ts`; matching uses title, school and category, with trimmed case-insensitive query text. Selecting a record opens its detail view. An empty result shows a clear-filters action. **Postcondition:** UI selection/filter state changes; there is no backend request. **Views:** D02, D04, D09, D16, D20.

### UC02 — Preview messages and offers

**Actor:** visitor or student; login is not checked by these current UI handlers. **Precondition:** a sample listing is selected. Open Message, submit nonblank trimmed text, or open Send Offer and submit a finite amount greater than zero. The UI appends text or an `Offer: $...` string to `messages[]`. Invalid form values do not append. Closing the dialog or navigating back changes UI flags. **Postcondition:** local React state changes. There is no seller delivery, persistent conversation, accepted offer or purchase. The shared array is not keyed by listing, so text can carry across selections until App unmount/reload. **Views:** D02, D16, D20.

### UC03 — Register an account

**Actor:** visitor. **Precondition:** backend and website forwarding service are configured; a suitable school exists. Submit email, names, password and full school name. The adapter checks Origin and allowlisted JSON fields, attaches its server-owned envelope, and calls `POST /Register`. The backend trims/normalizes input, validates email/name/password rules, resolves the exact school name, encrypts email/password and inserts User. **Alternatives:** invalid fields/school → 400; duplicate normalized email → 409; infrastructure errors are mapped to safe browser errors. **Postcondition:** an account exists; registration issues no token and creates no website session. **Views:** D02, D07, D08, D11.

### UC04 — Log in and restore a session

**Actor:** registered student or administrator. Submit credentials to `POST /api/login`. The adapter calls backend `POST /LogIn`, then reads `GET /Register` using the returned token. Only after the profile is validated does it create a random 32-byte opaque ID, rotate an existing local session ID, and store `{token, expires}` in its Map. It returns a projected profile and cookie. On application mount, `useAccount` calls `GET /api/profile` to restore a still-valid session. **Alternatives:** invalid credentials/blocks fail; invalid response prevents session creation; maximum 5,000 live entries produces 503. **Postcondition:** browser has an opaque session ID; backend token remains server-side. **Views:** D05, D10, D14, D18, D19, D25.

Backend login reuses an existing token only when it has **more than one day** remaining; reuse does not extend expiry. Otherwise it attempts token generation/insertion up to five times. Ordinary tokens last **21 days**; tokens for accounts with admin membership last **3 days**. Website sessions independently last **12 hours**, with no sliding extension. These clocks are deliberately not collapsed into one lifecycle.

### UC05 — Read or edit a profile

**Actor:** signed-in user; eligible admin for a target profile. The browser calls `GET/PATCH /api/profile`; target administration uses `/api/admin/profile?email=...`. The adapter supplies the backend access token and sends the backend's required JSON body even for GET, using Node's HTTP client. PATCH accepts only editable, nonblank fields. After success the adapter reads back normalized values. **Alternatives:** no valid local session → 401; duplicate email → 409; saved write followed by failed read → 200 with `profile:null` and a saved/reload notice. **Postcondition:** a successful write remains successful without silently repeating a password update. **Views:** D07, D12, D17.

### UC06 — Perform a targeted admin action

**Actor:** admin with the action's required level. The adapter reads membership freshly for every request, checks its projected permission and validates selectors. Backend forwarding uses the caller's `access_token` and the exact stored target email in `to_user`. Target eligibility checks happen in `ValidateToken`: caller must be an admin; an admin target must have strictly lower level; locked admin targets additionally require caller level ≥ 30. Caller level and original ID remain available while target ID selects the affected user. **Alternatives:** blank/unknown target → 400; unauthorized rank/lock → rejection; adapter maps target authorization failure to 403 without expiring the caller's session. **Postcondition:** only the selected operation proceeds, subject to controller policy. **Views:** D03, D13, D17 and the ACCESS slide.

Account deletion requires caller level ≥ 10 and forwarding. School creation/deletion requires level ≥ 10 and rejects forwarding. Admin grants/updates/removal require caller level > 0 and forwarding; new level must be a nonnegative integer below caller level. An explicitly supplied `locked` field requires ≥ 30. The rank guard runs before target substitution, so the later self-forwarding allowance does not override the equal-rank prohibition.

### UC07 — Inspect and clear attempt records

**Actor:** admin level ≥ 20. Read the attempt directory or select **exactly one** email or IP address for clearing. The backend endpoint rejects `to_user` forwarding; email and `ip_addr` are its own selectors. **Alternatives:** absent/both selectors or invalid target produce validation errors. **Postcondition:** matching attempt rows are removed; clearing a user attempt record does not recreate tokens already revoked at the block threshold. Returned records are observations, not necessarily active blocks. **Views:** D03, D08, D18.

When no active attempt row exists, failure creates count `1`; a successful observation creates count `-1`. Expiry begins five minutes later. Effective count -1 is treated as zero for later evaluation. Failures increment; requests during an active block increment even if credentials are correct. Count ≥ 10 blocks; the transition to user count 10 deletes all user tokens. At counts 20, 30, 40, ... expiry is extended from `max(expiry, now)` by `5 minutes × max(count/10 − 2, 1)`. Successful requests before the threshold do not reset the count. Unknown email login attempts cannot create a user-specific row. IP blocking follows the related pattern and does not delete user tokens.

### UC08 — Log out or request target sign-out

**Actor:** signed-in user, or admin requesting target sign-out. Browser logout is `POST /api/logout`; backend logout is `DELETE /LogIn`. After application validation, the backend validates the user token and deletes all tokens for the selected user when valid. It also returns 200 when token validation fails. The adapter clears all its local entries sharing the visitor's token and expires the cookie. No-session website logout also returns 200. **Postcondition:** local browser logout is complete; backend 200 alone does not certify a target's tokens were deleted. Where target-profile permission exists, the adapter checks target eligibility before requesting sign-out; low-level admins receive a deliberately qualified confirmation. **Views:** D03, D15, D19.

### UC09 — Use the separate listing API

**Actor:** direct API client; the website currently does not call this API. `GET /api/Listing` optionally filters category and joins Listings to User; POST inserts using a supplied UserId and UTC timestamp; DELETE by ID returns 200 or 404. **Precondition:** the separately selected database must contain the expected Listings table and User data. **Limit:** the controller does not call shared authentication or ownership checks. **Postcondition:** a direct database read/write occurs if that missing deployment/schema prerequisite is met. **Views:** D09, D24.

## Browser-to-backend route mapping

The browser sends normal same-origin HTTP requests. Node supplies backend credential bodies; browser GET requests have no JSON body.

| Website route | Backend route(s) | Behavior / selectors |
| --- | --- | --- |
| GET `/api/schools` | GET `/Schools` | Public school names; server envelope where configured |
| POST `/api/register` | POST `/Register` | Account fields; 201; no login |
| POST `/api/login` | POST `/LogIn`, GET `/Register` | Establish local Map entry and opaque cookie; browser 200 |
| GET `/api/profile` | GET `/Register` | User token in backend GET body |
| PATCH `/api/profile` | PATCH then GET `/Register` | Readback may fail after successful write |
| POST `/api/logout` | DELETE `/LogIn` | Local token-sharing sessions cleared |
| GET `/api/admin` | GET `/Admin` | Fresh membership and permission projection |
| POST/PATCH/DELETE `/api/admin` | same verb `/Admin` | `to_user`, plus `level` and optional `locked` for writes |
| GET `/api/admin/users` | GET `/Admin`, GET `/Users` | Level ≥ 10 |
| DELETE `/api/admin/users` | GET `/Admin`, DELETE `/Register` | `to_user`; level ≥ 10 |
| GET/PATCH `/api/admin/profile?email=...` | GET `/Admin`, GET/PATCH `/Register` | Query email becomes backend `to_user`; PATCH reads back |
| DELETE `/api/admin/sessions` | GET `/Admin`, optional GET `/Register`, DELETE `/LogIn` | Target email becomes `to_user`; qualified confirmation |
| GET/DELETE `/api/admin/blocked` | GET `/Admin`, same verb `/Blocked` | Level ≥ 20; email XOR ip_addr when clearing |
| GET/POST/DELETE `/api/admin/schools` | GET `/Admin`, same verb `/Schools` | Level ≥ 10; name / short_name selectors |

All admin routes refresh membership. Backend `/Users` exposes admin levels at **27**, while the website's response projection reveals them only at **30**. This is an intentional distinction in the model, not an assumption that the two thresholds match.

## Design findings and assumptions

1. **Website service identity differs from visitor identity.** `admin_token` is an unexpired admin login token used for IP forwarding, not a fixed configuration secret. `access_token` remains the visitor/admin caller token. The forwarding client's service account is separate from the human admin role in use-case diagrams. It bootstraps via login, verifies membership and coalesces concurrent renewal with `loginPending`.
2. **Retry is deliberately narrow.** The adapter renews/retries once only when the backend explicitly reports forwarding-token expiry, which is rejected before the action. It does not automatically repeat successful profile writes after readback failure.
3. **Session storage is local.** Cookie: `se_session`, `Path=/api`, `HttpOnly`, `SameSite=Lax`, 12-hour Max-Age, and `Secure` in production. A restart loses the Map. `render.yaml` configures one instance; no shared session store is present. Cookie attributes and the 12-hour local expiry do not alter backend token expiry.
4. **Storage paths must remain distinct in the model.** Account SQL uses `Path.GetFullPath(Env._dbPath)`. `Env` reads `path.env`, then the selected directory's `.env2` database filename and encrypted `.env`. ListingController independently uses `Data Source=../Data.db;`. These may resolve to different files; the diagrams do not assert that they are the same database or that both exist.
5. **Eight tables are declared; Listings is inferred.** D08 includes Schools, User, Admins, Access_Token, IP, User_Has_IPs, Blocked_IPs and Blocked_Users. The listing table in D09 is an expectation inferred from SQL, not supplied DDL. Attempts may have historical rows; no uniqueness constraint limits them to one row per identity. Multiplicity is therefore 0..*, not 0..1. Join-table columns are NOT NULL and the pair is unique.
6. **Association is not composition.** User belongs to one school and can have many tokens, attempt records and IP links. The schema declares delete cascades for tokens/attempt/link records, and restrictions for School→User and User→Admins. However `Sql` does not explicitly enable foreign keys, so actual connection/runtime enforcement is not verified. Composition diamonds are not used to imply stronger ownership or guaranteed runtime cleanup.
7. **Current code has real layering limits.** Controllers directly use static helpers and SQL; Users combines endpoint, blocking and locking duties. No ORM entity layer, generic repository abstraction or domain service classes are invented in the diagrams. ListingController bypasses the shared Sql helper.
8. **Startup cleanup is asynchronous.** The pinned Program.cs uses `Task.Run(Schedule)` without awaiting it. Host construction/startup can overlap cleanup. A separate `Maitenance` worker repeats cleanup at 03:24 Mountain time; spelling is preserved from source. The scheduler has no explicit daylight-saving correction, and cleanup is not schema migration.
9. **Marketplace behavior is a preview.** The UI does not connect to the listing API. Offers and messages do not persist or reach sellers. Payment, order fulfillment, seller verification and live offer acceptance are not implemented and are not modeled as existing features.
10. **Configured topology is not a live deployment assertion.** D21 derives Render and Azure roles from checked-in configuration. `/healthz` establishes Node process health and a configuration flag, not upstream database readiness. No live user data, login credentials or production requests were used to validate the diagrams.

## Alignment with the supplied PowerPoint

| Reference pages (PDF page numbers) | Applied here |
| --- | --- |
| 2, 7 | Separate structural and behavioral views; use cases, classes, sequences, communication, state, activity and deployment |
| 8–14 | Actor roles outside boundaries; use-case ovals; generalization; optional extension from preview messaging to browsing; required validation include |
| 15–21, 26–43 | Compartments, visibility, types, inheritance/dependency direction and multiplicities |
| 22–25, 28–29, 42 | Ownership is justified rather than decorating every relation with aggregation/composition |
| 45–59 | Functional separation, refinement, source-based component responsibilities and explicit coupling |
| 60 | Nodes, execution environments and artifacts in deployment |
| 61–73 | Layered and object-oriented architectural reasoning without inventing a complete MVC/DDD implementation |
| 74–81 | Context, component structure and separation of analysis goals from runtime architecture |

## Maintain and regenerate

Use Python 3.10+ and install DejaVu Sans fonts plus the two required packages from `requirements.txt`. `PyMuPDF` is optional for preview generation only.

```bash
python -m pip install -r requirements.txt
python render.py
# Optional local previews (not committed):
python render.py --previews
# Or write generated deliverables elsewhere:
python render.py --output /path/to/deliverables
```

`model.json` stores the slide geometry and content with a top-left 1280×720 coordinate system. Native editable PowerPoint objects are regenerated from the same model as the PDF and SVGs. The rendering script rejects text that extends beyond the page. Re-review relevant slides when changing labels or geometry; page-bound validation alone does not establish semantic correctness or eliminate edge crossings. Font substitution in an Office installation may alter text metrics; install DejaVu Sans for the intended appearance.

To update the design after an application change, inspect the affected source paths, revise the relevant diagrams and contracts, change `source_commit`, regenerate, inspect the rendered slides and update `VALIDATION.md`. The original upload is not duplicated into the repository.
