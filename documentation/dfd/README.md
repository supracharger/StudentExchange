# Student Exchange Data flow diagrams

Nine data flow diagrams cover the system context (Level 0), process/store decomposition (Level 1), and focused website/backend flows (Level 2). Three supporting pages provide the cover, index, and notation. The palette, 16:9 layout, editable shapes, and export formats match the [UML atlas](../uml/README.md).

## Open the diagrams

- [PDF atlas — 12 pages](StudentExchange-DFD.pdf)
- [Editable PowerPoint — 12 slides](StudentExchange-DFD.pptx)
- [Individual SVG diagrams](svg/)
- [Source evidence by diagram](TRACEABILITY.md)
- [Validation results](../uml/VALIDATION.md)

The PDF contains vector artwork, selectable text, and an outline. PowerPoint contains native text boxes, shapes, and connectors rather than slide screenshots. SVGs include accessible titles and descriptions. Use `model.json` and `build_model.py` for reproducible changes; manual PowerPoint edits are not imported back into the model.

## Source and scope

Both atlases model the complete [StudentExchange repository at `f893267`](https://github.com/supracharger/StudentExchange/tree/f893267d148fc0c3c6fad8bee5caadf6c086a143), including `code/Frontend/StudentExchange-Website/` and `code/Backend/StudentExchangeBck/`. These deliverables are maintained in **StudentExchange-Website**, not pushed to the combined repository.

The diagrams follow implementation source rather than the outdated backend README. SQLite table/column metadata and controller SQL supplement the incomplete `DB_Schema.txt`; no application records were inspected. This is a pinned source snapshot, not a verification of the deployed service. Immutable evidence links are in [TRACEABILITY.md](TRACEABILITY.md).

## How to read the DFDs

Rectangles are external entities, rounded boxes are processes, and open-ended boxes are data stores. Arrows carry named data, not timing, navigation, or control flow. Store IDs stay consistent across sheets: D1 website sessions, D2 identity/access, D3 marketplace, D4 conversations/messages, D5 image files.

F00 process 0 expands into F01 processes 1.0 (website runtime) and 2.0 (backend services). F02–F07 decompose backend responsibilities and show their website entry/exit for readability; F08 decomposes the website session/forwarding boundary. Reads shared by several operations and unchanged forwarding details are abstracted on focused sheets. See the UML sequences for detailed ordering and alternate outcomes.

## Diagram index

| ID | View |
| --- | --- |
| [F00](svg/F00.svg) | Context DFD: marketplace boundary |
| [F01](svg/F01.svg) | Level 1: processes and data stores |
| [F02](svg/F02.svg) | Authentication and account data |
| [F03](svg/F03.svg) | Listing discovery, details and seller pages |
| [F04](svg/F04.svg) | Seller listing changes and photos |
| [F05](svg/F05.svg) | Messaging, offers and read receipts |
| [F06](svg/F06.svg) | Administrator data and moderation |
| [F07](svg/F07.svg) | Scheduled maintenance data flow |
| [F08](svg/F08.svg) | Session, forwarding and logout data |

## Rebuild

Run from the website repository root. Rendering requires Python 3.10+ and DejaVu Sans fonts at `/usr/share/fonts/truetype/dejavu` (Debian/Ubuntu package `fonts-dejavu-core`). Use a Python virtual environment:

```sh
python3 -m venv work/diagram-venv
. work/diagram-venv/bin/activate
python3 -m pip install -r docs/uml/requirements.txt
python3 docs/dfd/build_model.py
python3 docs/uml/render.py --model docs/dfd/model.json --output docs/dfd
```

The DFD atlas uses the shared [renderer](../uml/render.py) and [requirements](../uml/requirements.txt). The two builders retain the pinned source commit in their definitions; updating the source snapshot requires reviewing the diagram definitions and evidence, not just changing that identifier. A combined-repository checkout is not needed to reproduce these exports.

For PDF previews and full artifact validation, also install PyMuPDF:

```sh
python3 -m pip install PyMuPDF==1.26.6
python3 docs/uml/validate.py --atlas docs/dfd
```

Optionally pass `--source-root /path/to/StudentExchange` to validate evidence paths against a combined-repository checkout at the pinned commit. Use a scratch output directory for review PNGs:

```sh
python3 docs/uml/render.py --model docs/dfd/model.json --output work/dfd-review --previews
```

Keep preview images, virtual environments, and Python caches out of commits. Exported PDF/PPTX/SVG files are the reviewable deliverables.
