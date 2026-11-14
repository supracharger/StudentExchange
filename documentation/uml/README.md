# Student Exchange UML diagrams

32 UML diagrams cover the React website, Node API adapter, ASP.NET Core backend, and SQLite/filesystem persistence. Six supporting pages provide navigation, notation, permissions, findings, and traceability.

## Open the diagrams

- [PDF atlas — 38 pages](StudentExchange-UML.pdf)
- [Editable PowerPoint — 38 slides](StudentExchange-UML.pptx)
- [Individual SVG diagrams](svg/)
- [Source evidence by diagram](TRACEABILITY.md)
- [Validation results](VALIDATION.md)

The PDF contains vector artwork, selectable text, and an outline. PowerPoint contains native text boxes, shapes, and connectors rather than slide screenshots. SVGs include accessible titles and descriptions. Use `model.json` and `build_model.py` for reproducible changes; manual PowerPoint edits are not imported back into the model.

## Source and scope

Both atlases model the complete [StudentExchange repository at `f893267`](https://github.com/supracharger/StudentExchange/tree/f893267d148fc0c3c6fad8bee5caadf6c086a143), including `code/Frontend/StudentExchange-Website/` and `code/Backend/StudentExchangeBck/`. These deliverables are maintained in **StudentExchange-Website**, not pushed to the combined repository.

The diagrams follow implementation source rather than the outdated backend README. SQLite table/column metadata and controller SQL supplement the incomplete `DB_Schema.txt`; no application records were inspected. This is a pinned source snapshot, not a verification of the deployed service. Immutable evidence links are in [TRACEABILITY.md](TRACEABILITY.md).

## Diagram index

| ID | View |
| --- | --- |
| [D01](svg/D01.svg) | System context and trust boundaries |
| [D02](svg/D02.svg) | Visitor and student goals |
| [D03](svg/D03.svg) | Administrator goals and role levels |
| [D04](svg/D04.svg) | Website component collaboration |
| [D05](svg/D05.svg) | Node adapter responsibilities |
| [D06](svg/D06.svg) | Backend controller classes |
| [D07](svg/D07.svg) | Request DTO inheritance |
| [D08](svg/D08.svg) | Core marketplace persistence classes |
| [D09](svg/D09.svg) | Listing summaries versus full details |
| [D10](svg/D10.svg) | Login: browser cookie, backend token |
| [D11](svg/D11.svg) | Registration: normalize and persist |
| [D12](svg/D12.svg) | Profile update and read-back failure |
| [D13](svg/D13.svg) | Targeted administration: caller versus target |
| [D14](svg/D14.svg) | Forwarding token renewal |
| [D15](svg/D15.svg) | Logout and messenger cleanup |
| [D16](svg/D16.svg) | Browse, search and inspect live listings |
| [D17](svg/D17.svg) | Authorization and target forwarding |
| [D18](svg/D18.svg) | Attempt windows and temporary blocking |
| [D19](svg/D19.svg) | Website session lifecycle |
| [D20](svg/D20.svg) | Website routes and public navigation |
| [D21](svg/D21.svg) | Deployment and runtime artifacts |
| [D22](svg/D22.svg) | Package and module dependencies |
| [D23](svg/D23.svg) | Startup and maintenance collaboration |
| [D24](svg/D24.svg) | Edit or deactivate a seller listing |
| [D25](svg/D25.svg) | Communication diagram: login collaborators |
| [D26](svg/D26.svg) | End-to-end messages and offers |
| [D27](svg/D27.svg) | Public seller page: user_page filter |
| [D28](svg/D28.svg) | Listing status lifecycle |
| [D29](svg/D29.svg) | Photo creation and incremental edits |
| [D30](svg/D30.svg) | Messenger UI and delivery states |
| [D31](svg/D31.svg) | Messaging and engagement persistence |
| [D32](svg/D32.svg) | Identity and access persistence |

## Rebuild

Run from the website repository root. Rendering requires Python 3.10+ and DejaVu Sans fonts at `/usr/share/fonts/truetype/dejavu` (Debian/Ubuntu package `fonts-dejavu-core`). Use a Python virtual environment:

```sh
python3 -m venv work/diagram-venv
. work/diagram-venv/bin/activate
python3 -m pip install -r docs/uml/requirements.txt
python3 docs/uml/build_model.py
python3 docs/uml/render.py
```

The DFD atlas uses the shared [renderer](../uml/render.py) and [requirements](../uml/requirements.txt). The two builders retain the pinned source commit in their definitions; updating the source snapshot requires reviewing the diagram definitions and evidence, not just changing that identifier. A combined-repository checkout is not needed to reproduce these exports.

For PDF previews and full artifact validation, also install PyMuPDF:

```sh
python3 -m pip install PyMuPDF==1.26.6
python3 docs/uml/validate.py --atlas docs/uml
```

Optionally pass `--source-root /path/to/StudentExchange` to validate evidence paths against a combined-repository checkout at the pinned commit. Use a scratch output directory for review PNGs:

```sh
python3 docs/uml/render.py --model docs/uml/model.json --output work/uml-review --previews
```

Keep preview images, virtual environments, and Python caches out of commits. Exported PDF/PPTX/SVG files are the reviewable deliverables.
