# Verification record

Verified 24 October 2026. Application source: `f91b923f4ec8f1072b3dda07070916459342d7a2`; branch base: `bea1e03b0cd36010ac61a4d400fb267a104a283a`; reference: uploaded **DFD (1).pdf**, 32 pages.

## Reference and semantic review

- Inspected every reference page visually. Applied its four-symbol notation, context/Level-0 distinction, hierarchical numbering, noun/verb naming rules, store restrictions, balancing and meaningful stopping points.
- Confirmed the `ChatGPT` branch still contained the previously reviewed application plus its UML documentation. No subsequent application changes existed at that base.
- Matched flows to the website/adapter/backend source, schema and current route contracts described in README.md and PROCESS-SPECS.md.
- Kept static marketplace samples and browser-only message/offer text separate from server-side account/admin data. Identified direct listing storage as an unintegrated, incomplete expectation.
- Kept caller token, service forwarding token, opaque browser session ID and target user selectors distinct in dictionary definitions.

## Automated structural checks

`python validate.py --self-test` passes for all **18 semantic DFDs** and **17 balanced parent/child relationships**. It verifies:

- Exactly one process and no internal stores in the context diagram.
- Context/Level-0 conservation of all external directional named packages.
- Child boundary equality after declared store-group refinement, rather than arrow-count equality.
- No process without input or output, direct self-return, unknown endpoint, undefined/unlabeled package, direct store/store flow or external/store shortcut.
- Every record package agrees with its declared store or store group.
- Four deliberately corrupted models are rejected: store on the context view, invented child input, missing child output and direct store-to-store connection.

Results are preserved in [validation-report.json](validation-report.json). These checks validate declared package conservation; they do not automatically prove that every field transformation matches real code. That mapping was reviewed separately against the implementation.

## Presentation and export checks

- Rendered **34 PDF pages and 34 editable PowerPoint slides**, including 18 semantic diagrams across 28 readable diagram sheets and six support pages.
- Dense L0/P2 diagrams use three same-level sheets; P3/P4 use four. Their full single-view SVGs are retained for zooming. The sheet manifest proves that every diagram process and flow survives the split; continuations retain the same canonical IDs.
- Individual SVGs parse as XML. PDF pages contain searchable titles; slides include source/takeaway speaker notes.
- PowerPoint text, symbols, process compartments, data stores, edge segments and arrowheads are native editable objects. No raster slide images or `ppt/media/` payloads are present.
- Measured text remains inside page bounds. Flow-label placement checks avoid label/label and label/node-box collisions; opposing vertical-flow labels are separated. White label halos preserve readability where edges cross.
- Reviewed contact sheets of all diagrams and detailed views of context, dense overview sheets, administration, access, registration and login. Adjusted font fitting, symbol spacing, dense-sheet boundaries and opposing labels.
- Renderer simplification removes redundant collinear curve samples so editable PowerPoint lines remain manageable.
- Checked local Markdown deliverable links and source/export inventories. Omitted preview PNGs/cache, generated debugging geometry, the uploaded PDF, application configuration and databases from the commit.

Run `python verify_exports.py` after rendering to repeat the artifact checks; it requires the optional PyMuPDF package. [export-report.json](export-report.json) records the resulting counts. `slide-model.json` is generated locally by the renderer for these checks and is intentionally ignored in Git; the authored semantic source remains `build_model.py`/`model.json`.

## Scope and limitations

This is a documentation-only change. No live production account, user data, database or mutation was used, and no application build/regression suite was needed. Database availability, missing Listings DDL, actual foreign-key enforcement and live deployment behavior are explicitly unverified. The application source and declared configuration remain the evidence boundary.

Structural balancing does not establish correct authorization or production security. Logical process 4.0 groups related transformations across existing modules; it does not assert a new separately deployed access service. Office font substitution can affect layout; install DejaVu Sans for the intended appearance. Complete overview SVGs favor whole-model continuity, while the deck's same-level sheets provide readable presentation detail.
