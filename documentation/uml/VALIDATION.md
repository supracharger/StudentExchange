# Diagram validation

Validated on 2026-11-14. Both atlases describe combined-repository source commit [`f893267d148fc0c3c6fad8bee5caadf6c086a143`](https://github.com/supracharger/StudentExchange/tree/f893267d148fc0c3c6fad8bee5caadf6c086a143). Deliverables reside in StudentExchange-Website.

## Export checks

| Check | UML atlas | DFD atlas |
| --- | --- | --- |
| Diagram views | 32 | 9 |
| Supporting pages | 6 | 3 |
| PDF pages / PowerPoint slides / SVG files | 38 / 38 / 38 | 12 / 12 / 12 |
| Native editable PowerPoint objects | 1,824 | 537 |
| Matching model/SVG/PowerPoint text | Passed | Passed |
| Searchable PDF page titles | Passed | Passed |
| 1280 × 720 page size | Passed | Passed |
| Unique IDs; complete SVG set | Passed | Passed |
| Text, shape, and path page bounds | Passed | Passed |
| Model shapes preserved in PowerPoint | Passed | Passed |
| Embedded raster slide media | None | None |
| Evidence paths in pinned combined checkout | Resolved | Resolved |

The automated validator reads each PDF, PowerPoint, SVG, and JSON model. It compares text and object counts and validates source paths when `--source-root` is supplied. It does not prove semantic completeness, production behavior, or absence of every possible internal overlap.

## Rendered review and source review

Rendered PNG review covered the atlas layouts, with detailed inspection of the React collaboration view, core table associations, startup self-call sequence, end-to-end messaging sequence, listing lifecycle, DFD process/store overview, and focused message flow. Routing around the listing-state notes and wrapping of the startup self-call were corrected before final export. PNG previews remain scratch artifacts rather than committed duplicate exports.

Source review covered React routes/components/hooks and browser API clients; Node sessions, forwarding, marketplace, messages, admin and deployment configuration; backend controllers, authentication helpers, SQL/schema, and maintenance. Checked-in SQLite metadata was inspected read-only to complement the incomplete schema text file. No application data rows or production endpoints were inspected or modified.

DFD review checked the context-to-Level-1 boundary, stable data store identifiers, named payloads, process input/output, and absence of direct external-entity-to-store or store-to-store flows. Focused Level-2 sheets explicitly abstract shared forwarding and lookup reads. A backend peer in F08 is external to the Node subprocess boundary, while remaining internal to the full system in F00/F01.

Known implementation limitations are documented in UML page GAPS and the associated views: stale schema text, optional listing hit output omitted by the backend summary, website deactivation versus backend deletion, proposal-only offers, and the listing orphan-cleanup directory condition. Diagrams distinguish website session lifetime from backend token lifetime and public seller pages from authenticated seller inventory.

## Reproduce

Install the dependencies and optional PyMuPDF as described in the [UML README](README.md). From the website repository root:

```sh
python3 docs/uml/build_model.py
python3 docs/dfd/build_model.py
python3 docs/uml/render.py
python3 docs/uml/render.py --model docs/dfd/model.json --output docs/dfd
python3 docs/uml/validate.py --source-root /path/to/StudentExchange
python3 docs/uml/validate.py --atlas docs/dfd --source-root /path/to/StudentExchange
```

Use a combined checkout at the pinned commit for the optional source-path check, or omit `--source-root` to validate exports alone. The changes are documentation and rendering tools; no website/backend runtime code changed, so application tests and builds were not required.
