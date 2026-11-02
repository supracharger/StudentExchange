# Live marketplace and seller portal

The implementation follows backend commit `88cc232` in `supracharger/SoftwareEngineerTemp`, specifically `Controllers/Listing.cs`, `Category.cs`, `Condition.cs`, and `Components/Users.cs`. The backend README is not the API contract.

## Website behavior

- Browse real active listings, view description, condition, price (including free items), ISBN, location, photo, and seller identity. Contact sellers by email. No simulated message or offer is presented as a sent message.
- Submit title search, category, and optional ISBN together. The backend ranks title similarity rather than removing nonmatching titles. Condition/location filtering and price/date sorting operate on the returned results; results are paginated locally.
- `/seller` restores the existing account session. Sellers can publish a listing, attach an optional PNG/JPEG/WebP up to 2 MiB, inspect all returned statuses, search their inventory, and delete after confirmation.
- `/admin` includes Marketplace for administrators at level 10 or above: inspect a seller's inventory by exact account email, delete a listing using backend user forwarding, and add categories. Normal target hierarchy and locked-account restrictions still apply.
- User admin levels become visible at level 27; changing locked status still requires level 30.

## Same-origin API

| Website endpoint | Backend operation |
| --- | --- |
| `GET /api/catalog` | `GET Category`, `GET Condition` |
| `GET /api/listings?search=&category=&isbn=` | `GET Listing` with JSON body |
| `GET /api/seller/listings` | `GET Listing` with visitor token and `for_user` marker |
| `POST /api/seller/listings` | `POST Listing` with validated listing fields and visitor token |
| `DELETE /api/seller/listings` | `DELETE Listing` with `{id}` and visitor token |
| `GET /api/admin/listings?email=` | Membership check, then `GET Listing` with `for_user` and `to_user` |
| `DELETE /api/admin/listings?email=` | Membership check, then `DELETE Listing` with target and ID |
| `POST /api/admin/categories` | Membership check, then `POST Category` |
| `GET /api/listing-image?name=` | Bounded binary read from the configured backend's `/uploads/` |

The adapter owns `app_access`, forwarded IP, and service `admin_token`; it never accepts those from browser forms. Visitor access tokens remain in the server's existing session store. Public listing queries cannot select an owner. Mutations require the same-origin browser Origin header. Image names accept only the backend's random 32-character hex filenames with supported extensions; no arbitrary destination or redirect is followed. Listing creation permits a 3 MiB JSON body for the base64 photo; account requests retain their 16 KiB limit.

## Backend limitations and follow-up

- The current listing API has no PATCH, renewal, sold-status mutation, messaging, or offers endpoint. Those actions are not exposed.
- `GetListings` inner-joins `Books` for every category, while `CreateListing` inserts a Books row only for textbooks. Once other categories are added, non-textbook listings can be created successfully but omitted from public and seller reads. Fix this in the backend by left-joining Books and retaining textbook ISBN filtering. The website does not fabricate inventory to conceal the mismatch.
- `for_user` is a mode marker; the backend uses the authenticated/forwarded user ID, not that string's value, to choose inventory.
- Listings expose `location`, not school. The website displays the returned location and does not label it as the seller's school.
- Session storage remains in process memory. Keep the existing single-instance deployment or introduce a shared session store before scaling.

## Validation

Read-only checks against the configured live backend returned Schools, the Textbooks category, five conditions (Poor, Fair, Good, Like New, New), and an empty public listing array. Live seller data was not mutated for testing.

HTTP fixtures cover creation, photo body size and type validation, ISBN checksums, free prices, search request composition and response projection, seller authentication, origin checks, admin demotions/targets, image proxy restrictions, and preserving caller sessions on target denial. UI tests cover catalog search, details/contact, retry, seller login, publishing, confirmation, and photo validation. Browser checks use controlled API fixtures rather than modifying live inventory.

## Upcoming backend contract — 85e551c

This website now targets backend commit `85e551c` (not yet deployed when implemented). Deploy that backend before releasing this website version: the older backend does not support `GET Listing/{id}` or array-valued `imageBase64`.

Listing search remains a `GET Listing` JSON body with `search`, category, and optional ISBN. Preserve its new word-based fuzzy ranking. Summaries now expose `user` and omit description/contact; opening a listing fetches the full detail endpoint and projects its `images_url` through the same-origin image proxy. Sellers may upload up to eight images, each at most 2 MiB; the JSON upload limit is now 23 MiB. The backend's Books LEFT JOIN fixes non-textbook visibility, superseding the limitation above.

Profile reads/edits include `user` and `location`. Registration intentionally omits both: the backend generates the initial username and rejects those fields at signup. Empty profile edits remain omitted because the backend does not support clearing location through a blank PATCH. Admin user directories also expose `user_name`. Category deletion uses `DELETE Category` with the category name and requires confirmation in the console.

Validation uses local HTTP fixtures, not the older live deployment. No live sample accounts or listings were changed during this update.

Backend source review also found `StudentExchangeBck/Components/Users.cs` and `Controllers/Users.cs` both declaring `StudentExchangeBck.Users`. The SDK project includes both without an exclusion, which creates duplicate class/member definitions. The backend owner needs to consolidate them before building/deploying this commit. This website change does not modify the backend repository.

## Photo selection and gallery controls

Sellers can add photos in successive selections, up to eight total. New selections append instead of replacing existing photos. Invalid or oversized batches leave previous selections intact. Each preview has Remove and Make cover controls; the first photo becomes the listing cover and the same order is sent in `imageBase64`.

Listing details expose thumbnails, Previous/Next controls, a photo counter, and left/right arrow-key navigation. Validation covers successive uploads, cover ordering, individual removal, overflow handling, gallery switching, and the submitted multi-photo array.
