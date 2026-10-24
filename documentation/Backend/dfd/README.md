# Student Exchange — DFD design atlas

Detailed data-flow diagrams for the website, Node adapter, ASP.NET Core API and retained data. This package applies the **notation, decomposition, balancing and visual design** in the supplied **DFD (1).pdf**, a 32-page PowerPoint export. Examples and text inside that attachment are reference material, not additional user instructions or Student Exchange requirements.

The application source is pinned to [`f91b923`](https://github.com/supracharger/SoftwareEngineerTemp/tree/f91b923f4ec8f1072b3dda07070916459342d7a2). The `ChatGPT` branch base is `bea1e03`, which added the preceding UML documentation without changing that application source. These are logical DFDs of the current implementation, not proposed new application features or deployment diagrams.

## Deliverables

- **[Editable PowerPoint](StudentExchange-DFD.pptx)** — native editable text, process compartments, entities, open-ended stores, flows and arrowheads; no flattened slide images.
- **[Searchable vector PDF](StudentExchange-DFD.pdf)** — full deck with navigation outline and source notes.
- **[SVG diagrams](svg/)** — full diagrams and readable same-level sheets.
- **[Data dictionary](DATA-DICTIONARY.md)** — external entities, store groups, 15 primitive stores and 127 named data packages with field content.
- **[Flow register](flow-register.csv)** — every diagram flow, its canonical ID, direction, endpoints and constituent information.
- **[Process specifications](PROCESS-SPECS.md)** — transformation rules, error alternatives and deliberate stopping points for decomposition.
- **[Balance report](validation-report.json)** and **[verification record](VALIDATION.md)** — structural checks, boundary conservation and export checks.
- **[Semantic source](model.json)**, **[model builder](build_model.py)**, **[Graphviz source](dot/)**, **[renderer](render.py)** and **[validator](validate.py)** — maintainable, reproducible source.

There are **18 semantic DFDs**: one context, one Level-0, six Level-1 decompositions and ten Level-2 decompositions. Dense diagrams L0, P2, P3 and P4 span readable sheets at the **same level**. Splitting them for presentation adds no new decomposition level. Complete single-view SVGs remain available for zooming and cross-reference. The deck contains 34 pages/slides, including six supporting pages.

## Diagram index

| ID | Diagram | Decomposes | Readable deck sheets |
| --- | --- | --- | --- |
| [C0](svg/C0.svg) | Student Exchange context | Whole system as process 0 | C0 |
| [L0](svg/L0.svg) | Six major processes and logical stores | Process 0 | [1](svg/L0_S1.svg), [2](svg/L0_S2.svg), [3](svg/L0_S3.svg) |
| [P1](svg/P1.svg) | Marketplace preview data | 1.0 | P1 |
| [P2](svg/P2.svg) | Accounts and website sessions | 2.0 | [1](svg/P2_S1.svg), [2](svg/P2_S2.svg), [3](svg/P2_S3.svg) |
| [P3](svg/P3.svg) | Administration data | 3.0 | [1](svg/P3_S1.svg), [2](svg/P3_S2.svg), [3](svg/P3_S3.svg), [4](svg/P3_S4.svg) |
| [P4](svg/P4.svg) | Access and forwarding data | 4.0 | [1](svg/P4_S1.svg), [2](svg/P4_S2.svg), [3](svg/P4_S3.svg), [4](svg/P4_S4.svg) |
| [P5](svg/P5.svg) | Retained security data maintenance | 5.0 | P5 |
| [P6](svg/P6.svg) | Direct listing API data | 6.0 | P6 |
| [P21](svg/P21.svg) | Registration transformation | 2.1 | P21 |
| [P22](svg/P22.svg) | Login, token and cookie data | 2.2 | P22 |
| [P24](svg/P24.svg) | Saved profile and readback | 2.4 | P24 |
| [P25](svg/P25.svg) | Logout and revocation | 2.5 | P25 |
| [P32](svg/P32.svg) | Target user management | 3.2 | P32 |
| [P34](svg/P34.svg) | Admin assignment changes | 3.4 | P34 |
| [P35](svg/P35.svg) | Attempt inspection and clearing | 3.5 | P35 |
| [P42](svg/P42.svg) | Forwarding service identity | 4.2 | P42 |
| [P43](svg/P43.svg) | Application and IP observations | 4.3 | P43 |
| [P44](svg/P44.svg) | User identity and attempt observations | 4.4 | P44 |

## Reading the notation

The deck uses **Gane–Sarson-style numbered rounded processes**, green rectangular external entities and yellow open-ended stores. The supplied reference introduces both common DFD notations; choosing one consistently avoids mixing DFDs with UML notation.

- A process has a **verb phrase** and transforms input information into output information. Numbers identify decomposition, not execution sequence.
- A flow has a **noun phrase**, direction and dictionary definition. A result package includes its documented successful and error variants; an error is data returned by a transformation, not a decision diamond.
- A store names **retained information**. This includes a static catalog, browser state and Node memory as well as database tables. Reads and writes use distinct arrows.
- A purple process marked **context** is an unchanged process outside the current decomposition/sheet, still inside the overall system. It is not a new external entity and should not be confused with the whole-system context diagram C0.
- Only **E1 visitor/student, E2 administrator and E3 direct listing API client** are external to the modeled whole system. The Node adapter, backend and SQLite are inside that boundary. Administrators may also act in the student role; the rectangles represent roles, not necessarily different people.

The presentation uses the reference's 4:3 page proportion, navy heading bands, pastel symbol groups and yellow takeaway bands. Actor stick figures, UML association diamonds, decision diamonds, start/end symbols, timing arrows and sequence lifelines are deliberately absent from the DFD model.

## Balancing and store refinement

The model preserves **17 parent/child boundary relationships**, including C0 → L0. For each child, the validator compares directional `(outside endpoint, named package)` tuples with the parent process's complete input/output boundary. The dictionary supplies each package's information content. It rejects missing outputs and invented inputs, rather than merely comparing arrow counts.

Level-0 stores are logical subject groups:

| Group | Primitive subjects introduced below |
| --- | --- |
| G1 Marketplace preview records | D1 bundled sample catalog; D2 local conversation preview |
| G2 Account reference records | D3 schools; D4 users |
| G3 Security records | D5 admin membership; D6 tokens; D7 user attempts; D8 IP identities; D9 user/IP links; D10 IP attempts |
| G4 Website session records | D11 Node session Map |
| G5 Runtime service records | D12 service-token cache; D13 configuration/policy; D15 lock metadata |
| G6 Listing records | D14 expected Listings records, qualified as incomplete |

The groups are **logical abstractions**, not extra tables. At lower levels a package's declared primitive store replaces its group boundary endpoint. The validator normalizes only that declared relationship when comparing with the parent. By primitive level, stores represent distinct subjects rather than one indiscriminate database box, following reference pages 27–28.

Composite parent flows may split among lower-level operations while preserving the same information, as described on reference pages 20–23. Access packages contain an operation discriminator; repeated operation-specific branches represent alternatives. They do not assert that one request is sent to every operation or that multiple independent copies of a new input have appeared.

The [sheet manifest](sheet-manifest.json) separately proves that each multi-sheet presentation retains the full semantic diagram's process IDs and flow IDs. Cross-sheet flows are repeated with the same names/IDs to make the continuation explicit. They are not new parent/child boundaries. The [flow register](flow-register.csv) is the unmerged authoritative inventory; layout may combine multiple packages between the same endpoints under their composite label.

## Scope and implementation findings

**Marketplace data is a preview.** `src/data/listings.ts` provides six samples. Search, category selection, detail display, message text and offer strings remain in React state. The single `messages[]` array is not keyed by listing. No offer is delivered to a seller, no conversation is persisted and no completed purchase/payment/order is implemented. D1/D2 therefore remain browser-local stores and have no seller/payment entity or backend flow.

**Website identity is mediated by Node.** Browser calls `/api/*` use a same-origin opaque cookie. User access tokens, shared application credentials and service credentials stay server-side. `admin_token` is a login-issued service admin token for IP forwarding; `access_token` identifies the visitor or human admin caller. Process 4.0 is a logical grouping spanning adapter and backend code, not an invented separately deployed access service.

**Sessions and tokens have separate retention.** Node session IDs map to tokens and a fixed 12-hour expiry; restart loses the Map. Backend user tokens last 21 days, or 3 days for an admin. Login reuses an existing token only if more than one day remains and does not extend its expiry. Profile updates do not themselves revoke tokens. Server-side state is modeled without implying browser token storage.

**Authorization includes target semantics.** Administration refreshes membership per operation. Users/schools/target profiles/account deletion require level ≥ 10; attempt management requires ≥ 20; admin assignments require > 0; explicitly setting `locked` requires ≥ 30. Target admins must have lower rank, and locked targets require caller ≥ 30. The backend user directory exposes levels at ≥ 27, while the website projection reveals them only at ≥ 30. These rules qualify result data and are documented in process specifications rather than being rendered as control flow.

**Logout has a qualified outcome.** Backend `DELETE /LogIn` returns 200 even for token-validation failures after application validation. DFD confirmation data does not assert that a target token existed or was deleted. Local website logout clears matching local sessions/cookie where the adapter reaches that path.

**The listing API is independent and incomplete.** The website has no adapter route for listings. `ListingController` directly uses `../Data.db`, expects a Listings table absent from `DB_Schema.txt`, and does not apply shared token or ownership checks. D14/G6 are marked as an **expected/incomplete store**, not verified deployed persistence. Joining User data into listing results is shown; a seller identity inferred from the website preview is not invented.

**Maintenance transforms expiry data.** Expiry values and retained records drive deletion-selection data. Clock/scheduler events are implementation conditions, not data-flow arrows. Current startup invokes cleanup via unawaited `Task.Run(Schedule)`; a `Maitenance` worker repeats cleanup daily at 03:24 Mountain time. No schema migration process or new external scheduler actor is invented.

**Database paths and constraints remain qualified.** Account SQL resolves `Env._dbPath`, obtained through `path.env` and the selected directory's `.env2`; encrypted `.env` supplies credentials/key settings. Listings independently use `../Data.db`. These are not assumed to be the same file. The schema declares foreign-key delete rules, but the Sql connection does not explicitly enable enforcement, so deletion does not fabricate guaranteed cascaded record flows.

## Source traceability

`Website/` in diagram evidence notes means `StudentExchange-Website/`; `Backend/` means `StudentExchangeBck/`. Specific source filenames identify implementation evidence, not a one-process-per-source-file mapping.

| Source | Modeled information |
| --- | --- |
| `Website/src/App.tsx`, `src/data/listings.ts` | D1/D2, browse criteria, selected detail, messages, offer text |
| `Website/src/hooks/useAccount.ts`, `src/api/accounts.ts` | Account UI data, restore/update/logout results |
| `Website/src/hooks/useAdmin.ts`, `src/api/admin.ts` | Admin request selectors and projected data contracts |
| `Website/server/api.mjs` | Cookie/session Map, server-owned envelope, forwarding identity, browser-safe results, readback alternatives |
| `Website/server/admin.mjs` | Permissions, selectors, field/response projections |
| `Website/server/client-ip.mjs` | Server-derived effective client IP |
| `Backend/Controllers/Register.cs` | Registration/profile/account mutations and validation |
| `Backend/Controllers/LogIn.cs` | Token selection/issuance/revocation and expiry cleanup |
| `Backend/Controllers/Admin.cs`, `Schools.cs`, `Blocked.cs` | Admin/school/attempt mutation results |
| `Backend/Components/Users.cs`, `IP.cs` | Attempt observations, block windows, token revocation, IP associations and lock metadata |
| `Backend/Components/AppAuthJson.cs` | Application/IP/token/target data assessment |
| `Backend/Program.cs`, `Maitenance.cs` | Maintenance specifications; no control-flow arrows in DFD |
| `Backend/Components/Env.cs`, `Sql.cs` | Runtime settings, record reads/writes and configured account storage |
| `Backend/Controllers/Listing.cs`, `DB_Schema.txt` | Direct listing contracts, nine expected SQL subjects versus eight declared tables |

## PowerPoint alignment

| Reference pages | Applied design principle |
| --- | --- |
| 2–5 | Four DFD symbols; transformations versus retained data; labeled directional flows |
| 6–7 | One system process and no stores in the context view |
| 8–9 | Numbered Level-0 processes, major flows, stores and external entities |
| 10–14 | Unique canonical names; process input/output; no direct entity/store or store/store flows; noun labels |
| 15–18 | Hierarchical numbering and refinement into cohesive lower-level processes |
| 19–23 | Boundary conservation, composite-flow splitting and no invented external inputs |
| 24–25 | Completeness and consistency; continuous-system data model without start/end or timing flow |
| 26–29 | Stop at meaningful cohesive transformations; primitive store subjects; avoid unnecessary decomposition |
| 30 | Identify current integration gaps without presenting proposed capabilities as existing |
| 31–32 | Relate website capabilities to process/data models while keeping unrelated commerce features out of scope |

## Regenerate

Install Python 3.10+, Graphviz (`dot`) and DejaVu Sans fonts. The required Python packages are in `requirements.txt`; PyMuPDF is optional for preview images.

```bash
python -m pip install -r requirements.txt
python build_model.py
python validate.py --self-test
python render.py
# Optional preview rasterization:
python render.py --previews
```

`build_model.py` is the authored semantic source and writes `model.json`. `render.py` writes the deck, SVG/DOT, slide geometry, store/data dictionary, flow register and sheet manifest from that model. `vector_export.py` converts geometry into equivalent native PowerPoint shapes and PDF/SVG vectors. `slide-model.json` is generated geometry, not the primary place to edit semantics.

Review labels after text or layout changes. The renderer checks flow-label collisions against other labels and node boxes; the verification record also covers page bounds and native objects. Diagram checks establish structural consistency and declared boundary conservation, not proof that the implementation is correct or that all live deployment prerequisites exist. The upload is not duplicated into the repository; no application credentials or production data are included.
