# Student Exchange — Technical Progress Review

**[Open the editable PowerPoint](StudentExchange-Progress-Review.pptx)** · **[Read the PDF](StudentExchange-Progress-Review.pdf)** · **[Presenter notes](PRESENTER-NOTES.md)**

The 34-slide presentation covers all nine requested review areas and the evaluation criteria: UML, architecture, database/data design, consistency, technology decisions and implementation understanding. Slides 1–30 form the review narrative; slides 31–34 provide technical, contribution and evidence appendices. Use the detailed speaker notes to explain the design rather than reading every table aloud. For a shorter review, prioritize slides 1–4, 7–13, 15–19, 22–28 and 30.

## What the presentation includes

- Current goals, users, scope and a concrete repository comparison.
- Functional/non-functional requirements with acceptance conditions and observed status.
- Completed frontend, backend, adapter, database/design and verification artifacts.
- Actual local build screenshots plus two team-supplied captures of the deployed admin overview and user directory.
- Readable, native editable UML use-case, DTO/class and login-sequence diagrams.
- A request walkthrough and architecture diagram linking browser, Node, ASP.NET and SQLite.
- Core and security relational diagrams covering all eight declared tables.
- Current listing contract/schema/authorization gaps and distinct preview boundaries.
- Azure backend and Render website deployment, confirmed by the team, with a clickable [website link](https://studentexchange.onrender.com).
- Framework/platform decisions tied to actual constraints and trade-offs.
- Team-confirmed individual contributions, ongoing mobile work and clearly labeled proposed next assignments.
- Prioritized implementation/quality issues, a three-gate final-delivery plan and final-demo acceptance.
- A milestone contribution record, a reusable future contribution template and evidence limitations.

## Team contributions incorporated

These claims were explicitly supplied by the user; they are **not inferred from Git commit authorship**.

| Member | Original role supplied | Contribution supplied |
| --- | --- | --- |
| Tristan Roa | Team Leader / Backend | UML diagrams, backend commenting, Listings endpoint |
| Robert (Andrew) Quaife | Backend | Other backend work and website except Listings endpoint and Messaging UI |
| Alex Pyankov | Materials & PowerPoint | Previous PowerPoint |
| Robert Richardson | Frontend | Messaging UI |
| Thomas Phommarath | Frontend | Mobile web app work remains ongoing; called “Tomas” in the update |

Only Thomas's current ongoing assignment was explicitly specified. Current tasks for the other members are not invented. Proposed next assignments are separately labeled in the deck. Alex's previous PowerPoint is credited without assuming its exact date or that it was necessarily the proposal presentation. [CONTRIBUTIONS.csv](CONTRIBUTIONS.csv) records the current review delta; [MILESTONE-TEMPLATE.csv](MILESTONE-TEMPLATE.csv) provides one row per member for each future gate.

## Source and scope

The source application is pinned to [`f91b923`](https://github.com/supracharger/SoftwareEngineerTemp/tree/f91b923f4ec8f1072b3dda07070916459342d7a2), contained in branch base [`14c9386`](https://github.com/supracharger/SoftwareEngineerTemp/tree/14c9386206524de2436698dea829b194ceefc502). Existing [UML](../uml/README.md) and [DFD](../dfd/README.md) atlases supply the established design context; the review selects/reformats diagrams for presentation readability.

The repository comparison is **October 11 → October 24, 2026**, `2307809` → `f91b923`. That is an available source checkpoint comparison, not an invented proposal date. The original proposal artifact/date, formally approved requirement changes and final-presentation deadline were not provided. The deck therefore explains current requirements and actual source/team progress, labels that baseline limitation and uses dependency gates rather than fabricated calendar promises or completion percentages.

The team confirms the backend is deployed on Azure and the website on Render at **https://studentexchange.onrender.com**. That hosting statement is incorporated into the architecture and deployment slides. The supplied admin screenshots show the authenticated deployed overview and Users page, including a Level 20 context, seven displayed registered students and two user/IP attempt records each at capture time. These observations do not prove every action was exercised, that the counts are current, or that every attempt record is a block. The review does not independently establish the deployed revision or a new successful end-to-end production workflow. A read-only web-tool attempt could not retrieve the website, and no credentials or privileged live test were used. This does not contradict the team-confirmed hosting status.

## Fresh verification performed for this review

| Check | Result / scope |
| --- | --- |
| Frontend `npm run build` | Passed: TypeScript check and Vite production build |
| Backend `.NET 9` build | Passed: zero warnings and zero errors |
| Current Vitest run | 118 cases: **116 passed, 1 failed, 1 skipped live test** |
| Server/helper test cases | 84 passed |
| UI test cases | 32 passed, 1 failed |
| Local Chromium sample catalog | 6 cards; 3 after selecting Textbooks |
| Local message preview | Submitted text visible in App-local conversation |
| Local offer preview | `$20.01` appended as local text |
| Whole-dollar input | `$20.00` triggers native step mismatch: `min=0.01`, `step=1` |
| 390 px home page | No horizontal overflow observed |
| Browser script errors during preview | None observed |

The failing case is `sample marketplace renders the starter and identifies the listings as examples` in `src/App.test.tsx`: it expects an accessible list named `Sample listings`, but the current `ul.listing-grid` has no accessible label. The review reports it; it does not silently modify the app or remove the assertion.

The skipped test is the opt-in live backend workflow. It was deliberately disabled (`RUN_LIVE_API_TESTS=0`). The suite was run with local fixture networking enabled; no live account mutation was performed. Browser screenshots came from the built current site served locally by Node with backend account settings intentionally absent. They demonstrate the preview and not a new Azure/Render account test. Historical October 8/9 live reports describe their then-current contracts, before the October 10 service-token migration.

Evidence files: [test summary](evidence/test-summary.json), [browser checks](evidence/browser-checks.json), [frontend build](evidence/build.log), [backend build](evidence/dotnet-build.log), [team confirmations](evidence/team-input.json), [slide/export validation](VALIDATION.md).

## Key technical findings preserved in the deck

1. Node adapts the backend's JSON body authentication and GET-body contract while keeping credentials and tokens off the browser.
2. Browser cookie ID, visitor `access_token` and service forwarding `admin_token` are distinct identities with different roles.
3. A 12-hour local Node session and 21/3-day backend tokens are separate clocks. Process restart loses the local Map; the Render manifest configures one instance.
4. Profile write success followed by readback failure produces a saved notice with null profile. It should not cause a second password write.
5. Backend logout can mask token-validation failures; HTTP 200 alone is not certified target revocation.
6. The website catalog/messages/offers are currently sample/local state. The direct Listing API is unconnected to the website, expects undeclared Listings DDL, uses an independent database path and lacks shared authorization/ownership checks.
7. Passwords currently use reversible deterministic encryption rather than dedicated salted password hashing. The review identifies this as implementation debt and proposes remediation.
8. The schema declares foreign-key relationships/delete rules; runtime enforcement is not explicitly enabled by Sql and was not verified in a live database.

## Rubric coverage

| Review requirement | Main slides |
| --- | --- |
| Project overview / users / goals | 1–4 |
| Requirements and scope updates | 4–7 |
| Concrete progress since proposal | 4, 7–11, 22–23, 26 |
| UML diagrams | 14–16 |
| System architecture / request movement | 12–13, 20, 22 |
| Database / data design | 17–19 |
| Technology decisions and reasoning | 13, 20–22 |
| Individual contributions and milestone record | 26–27, 33; CSV records |
| Current challenges and next steps | 19, 23–25, 27–30 |
| Design consistency and understanding | 13–20, 29, 31–32 |

## Editing and regeneration

The deck uses native editable text, shapes, tables, UML/relational symbols, connectors and arrowheads. The four placed screenshots are raster evidence; diagrams are not flattened into images. Both files contain a clickable website link. PowerPoint speaker notes include source references and technical explanations.

Python 3.10+, DejaVu Sans fonts and the packages in [requirements.txt](requirements.txt) reproduce the files:

```bash
python -m pip install -r requirements.txt
python build_deck.py
python render.py --previews
python verify.py
```

`build_deck.py` is the authored presentation source; `slide-model.json` is its generated editable geometry/content. `render.py` and `vector_export.py` produce consistent PDF and PowerPoint output. PyMuPDF is optional for preview generation and verification. Source screenshots are in [assets](assets/); preview images are ignored. [PRESENTER-NOTES.md](PRESENTER-NOTES.md) is generated from the same notes embedded in PowerPoint.

No application source is modified by this documentation work. Existing UML and DFD artifacts are preserved.
