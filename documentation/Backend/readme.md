# Student Exchange backend

Student Exchange is a student marketplace API built with **ASP.NET Core on .NET 9** and **SQLite**. It supports account registration, login, profiles, school lookup, marketplace listings with images and ISBNs, and administration of users, schools, categories, and attempt blocks.

This checkout contains the backend and design documentation. It does **not** contain the website, a mobile application, a database, or the runtime secrets. Some design documents describe a larger system or older source revisions; use the controllers in this checkout as the current API contract.

## Contents

- [Project structure and architecture](#project-structure-and-architecture)
- [Prerequisites](#prerequisites)
- [Configure local data and secrets](#configure-local-data-and-secrets)
- [Restore and build](#restore-and-build)
- [Run locally](#run-locally)
- [API reference](#api-reference)
- [Account walkthrough](#account-walkthrough)
- [Marketplace walkthrough](#marketplace-walkthrough)
- [Administration](#administration)
- [Authentication and maintenance](#authentication-and-maintenance)
- [Publish and run a release](#publish-and-run-a-release)
- [Development and verification](#development-and-verification)
- [Troubleshooting](#troubleshooting)
- [Design documentation](#design-documentation)

## Project structure and architecture

```text
.
├── readme.md
├── DB_Schema.txt                 # Partial database schema reference
├── StudentExchangeBck/
│   ├── StudentExchangeBck.sln    # Solution containing one API project
│   ├── StudentExchangeBck.csproj # net9.0 and NuGet dependencies
│   ├── Program.cs               # Startup, maintenance, HTTP pipeline, static images
│   ├── Controllers/             # Account, marketplace, lookup, and admin endpoints
│   ├── Components/              # Authentication, SQLite, configuration, utilities
│   ├── Properties/launchSettings.json
│   ├── appsettings*.json        # Logging and standard ASP.NET configuration
│   ├── readme-env.md            # Short runtime file-placement reminder
│   └── bin_/                   # Conventional local data directory

```

Requests reach ASP.NET controllers, which explicitly validate body credentials through `AppAuthJson`. Controllers use `Sql` for parameterized SQLite operations; listing images are written to disk and exposed by static-file middleware at `/uploads`. There is no Entity Framework model or automatic migration system.

Startup performs these steps:

1. Load `path.env`, `.env2`, and the encrypted `.env` through `Env.GetEnv()`.
2. Create the listing upload directory.
3. Launch a cleanup task and schedule daily maintenance for **03:24 Mountain time**.
4. Configure controllers, forwarded headers, HTTPS redirection, static uploads, and authorization middleware.
5. Expose `/openapi/v1.json` when the ASP.NET environment is `Development`, then map controllers and start the server.

Initial cleanup runs in a background task; a listening HTTP port alone does not prove the database is complete. Check the relevant endpoints and server logs as well.

Runtime package references are `Microsoft.AspNetCore.OpenApi` 9.0.12, `Microsoft.Data.Sqlite` 10.0.12, and `Newtonsoft.Json` 13.0.4. The project enables nullable reference types and implicit usings.

## Prerequisites

- **.NET 9 SDK**, including the ASP.NET Core runtime. Confirm with `dotnet --info`; a runtime alone cannot build the project. There is no `global.json` pinning an SDK patch.
- Access to NuGet for the initial restore.
- A compatible SQLite database and the matching encryption configuration, normally supplied by the team.
- A writable local directory for the database and uploaded images.
- `curl` or another HTTP client supporting **GET requests with JSON bodies** for the examples.
- Optionally, SQLite tooling to inspect or provision development data.

The command examples use a POSIX shell and start at the repository root unless stated otherwise. The `dotnet` commands also work in PowerShell; adapt shell file-creation commands when using Windows. No Node.js installation or frontend build is needed for this checkout.

## Configure local data and secrets

**Building does not require runtime data. Running the API does.** Prepare the following files before starting the server:

```text
StudentExchangeBck/
├── path.env
└── bin_/
    ├── .env                 # Encrypted JSON, Base64 text
    ├── .env2                # Plaintext database filename setting
    ├── Data.db              # Compatible SQLite database
    └── public/uploads/      # Created automatically; listing image storage
```

### 1. Set the runtime paths

For this layout, create `StudentExchangeBck/path.env` with:

```dotenv
path=bin_/
```

Create `StudentExchangeBck/bin_/.env2` with:

```dotenv
db=Data.db
```

The loader reads `path.env` from the **process working directory**. It constructs the other filenames by string concatenation: `_bin + ".env"`, `_bin + ".env2"`, and `_bin + db`. Keep the trailing slash in `path`; use an absolute directory ending in `/` if preferred. `db` should be a filename or a relative suffix beneath that directory.

Both path files are simple `key=value` text, parsed by splitting lines and `=`. Do not use shell syntax, quotes, comments, or values containing `=`. These values are not expanded as environment variables. There is no `STUDENT_EXCHANGE_DATA_DIRECTORY` override or special Release-only data path: Debug and Release both use this file-based loader.

### 2. Supply the encrypted configuration

`.env` is **not dotenv text** and is **not plaintext JSON**. It contains the Base64 string returned by:

```csharp
DeterministicEncryption.Encrypt(json, salt)
```

`Env.GetEnv()` decrypts it with its default salt, currently `tempPass!^74*`, and deserializes a JSON dictionary containing these four keys:

| Key | Purpose |
| --- | --- |
| `_appAccess` | Shared application credential sent as `app_access`. |
| `_emailSalt` | Key material for deterministic email encryption and lookup. |
| `_passSalt` | Key material for deterministic password encryption and comparison. |
| `_ipSalt` | Key material for deterministic IP address encryption. |

Values are trimmed on load. Supply nonempty, separate development values. The loader does not enforce nonempty secrets. `_adminToken` is commented out in the current configuration class; body IP forwarding uses an admin's login token instead.

**For an existing database, obtain its matching `.env`.** Replacing encryption keys without migrating stored records breaks account/password/IP lookups.

For a **new, disposable database only**, the following optional helper generates compatible development configuration using the project's encryption implementation. Run from the repository root after installing the SDK. It refuses to overwrite an existing `.env`:

```sh
mkdir -p work StudentExchangeBck/bin_
dotnet new console --framework net9.0 --output work/config-init
cp StudentExchangeBck/Components/DeterministicEncryption.cs work/config-init/
cat > work/config-init/Program.cs <<'CS'
using System.Security.Cryptography;
using System.Text.Json;
using StudentExchangeBck;

if (args.Length != 1)
    throw new ArgumentException("Pass the output .env filename.");
var output = Path.GetFullPath(args[0]);
var values = new Dictionary<string, string>
{
    ["_appAccess"] = "local-dev-app!",
    ["_emailSalt"] = Convert.ToHexString(RandomNumberGenerator.GetBytes(32)),
    ["_passSalt"] = Convert.ToHexString(RandomNumberGenerator.GetBytes(32)),
    ["_ipSalt"] = Convert.ToHexString(RandomNumberGenerator.GetBytes(32))
};
using var stream = new FileStream(output, FileMode.CreateNew, FileAccess.Write);
using var writer = new StreamWriter(stream);
writer.Write(DeterministicEncryption.Encrypt(
    JsonSerializer.Serialize(values), "tempPass!^74*"));
CS
dotnet run --project work/config-init -- StudentExchangeBck/bin_/.env
```

This helper creates only `.env`; it does not create either path file or initialize a database. Its application credential is `local-dev-app!`, for local experiments only. Preserve the generated encryption keys with any database populated using them. Keep `work/` and runtime files out of commits.

### 3. Supply a complete database

Copy a compatible development database to the configured location. **There is no first-run database initializer, seed command, or complete migration script in this repository.** An empty file is insufficient: SQLite may create it, but queries and cleanup require existing tables.

[DB_Schema.txt](DB_Schema.txt) documents the account/security tables, indexes, and some foreign keys. It now includes `Schools.short_name` and `Admins.locked`, but it does **not** describe the complete current marketplace schema or all current `User` columns. Do not treat it as a complete initialization script.

The implementation requires at least the following tables and columns:

| Table | Columns used by the API |
| --- | --- |
| `Schools` | `id`, `name`, `short_name` |
| `User` | `id`, `email`, `user_name`, `first_name`, `last_name`, `password`, `school_id`, `location`, `datetime` |
| `Admins` | `user_id`, `level`, `locked` |
| `Access_Token` | `id`, `user_id`, `token`, `expiry` |
| `IP` | `id`, `ip`, `datetime` |
| `User_Has_IPs` | `user_id`, `ip_id` |
| `Blocked_Users` | `id`, `user_id`, `count`, `expiry` |
| `Blocked_IPs` | `id`, `ip_id`, `count`, `expiry` |
| `Listings` | `id`, `title`, `description`, `price`, `category`, `condition`, `user_id`, `datetime`, `expiry`, `status` |
| `Listings_Category` | `id`, `name` |
| `Condition` | `id`, `name` |
| `status` | `id`, `name` |
| `Books` | `list_id`, `isbn` |
| `Img` | `id`, `list_id`, `name` |

This inventory describes query requirements, not complete types, defaults, indexes, or constraints. In particular, listing insertion omits `status` and relies on a compatible database default; browsing treats status **1** as active, and cleanup changes expired active listings to status **3**. Confirm those IDs and defaults with the supplied database. Preserve email/token uniqueness and the relationships needed by deletion.

Seed at least one school, category, and condition. Empty lookup tables currently cause missing-key errors in several controllers. The category name `Textbooks` has special ISBN handling. The first administrator must be provisioned in the database because admin creation through the API already requires an admin token. Use a disposable account and a level appropriate to the administrative operations below.

`client.env` is not used by this backend. `server-all.env` is not loaded by `Env.GetEnv()` either.

## Restore and build

From the repository root:

```sh
dotnet restore StudentExchangeBck/StudentExchangeBck.sln
dotnet build StudentExchangeBck/StudentExchangeBck.sln --configuration Debug --no-restore
```

To build Release:

```sh
dotnet build StudentExchangeBck/StudentExchangeBck.sln --configuration Release
```

Build outputs go under `StudentExchangeBck/bin/<configuration>/net9.0/`; intermediate files go under `obj/`. These SDK output directories differ from the runtime data directory `bin_/`.

## Run locally

Run from the application directory so the relative `path.env` lookup succeeds:

```sh
cd StudentExchangeBck
dotnet run --launch-profile http
```

The `http` profile binds **http://localhost:5239** and sets `ASPNETCORE_ENVIRONMENT=Development`. Stop it with **Ctrl+C**. For automatic rebuilding during development:

```sh
dotnet watch run --launch-profile http
```

For HTTPS, trust a local development certificate where supported, then select the HTTPS profile:

```sh
dotnet dev-certs https --trust
dotnet run --launch-profile https
```

That profile binds **https://localhost:7000** and **http://localhost:5239**. Certificate trust support varies by OS; follow the SDK's instructions if the trust command is unsupported. HTTPS redirection is enabled in the application. When using the HTTP-only profile, the middleware may warn that it cannot determine an HTTPS port.

In another terminal, check:

```sh
curl -i http://localhost:5239/Schools
curl -i http://localhost:5239/openapi/v1.json
```

Expect `200` and a JSON body. `/Schools` returns parallel `schools` and `short_names` arrays, sorted by full school name. A `404` at `/` is expected; there is no homepage or health-check endpoint. There is a generated OpenAPI document, but no configured Swagger UI. The document may not express every body field or authorization restriction.

## API reference

Routes use controller names directly, **without an `/api` prefix**. JSON bodies require `Content-Type: application/json`. Property naming includes both snake-case DTO fields and camel-case serialized C# properties; use the examples rather than assuming one naming convention.

Credential abbreviations below: **App** = body `app_access`; **User** = App plus a valid body `access_token`; **Admin N** = User with the required administrator level.

| Method | Route | Credentials / behavior |
| --- | --- | --- |
| GET | `/Schools` | Public full school names and abbreviations. |
| POST, DELETE | `/Schools` | Admin 10; body `name`, `short_name`; no user forwarding. |
| POST | `/Register` | App; register an account; `201` on success. |
| GET, PATCH | `/Register` | User; read/update profile; forwarding requires level 10. |
| DELETE | `/Register` | Admin 10; target selected through required `to_user`. |
| POST | `/LogIn` | App plus `email`, `password`; `201` with token. |
| DELETE | `/LogIn` | User; delete all tokens for the selected user. |
| GET | `/Admin` | User; return admin membership and level; no forwarding. |
| POST, PATCH, DELETE | `/Admin` | Admin with positive level; required `to_user`; see admin rules below. |
| GET | `/Users` | Admin 10; parallel column arrays inside `body`; no forwarding. |
| GET, DELETE | `/Blocked` | Admin 20; inspect/clear attempt records; no forwarding. |
| GET | `/Category` | App; category name array. |
| POST, DELETE | `/Category` | Admin 10; body `category`. |
| GET | `/Condition` | App; condition name array. |
| GET | `/Listing` | App for active catalog; User when `for_user` is present. |
| GET | `/Listing/{id}` | App; detail including seller contact information and image URLs. |
| POST | `/Listing` | User; create listing; `201` on success. |
| DELETE | `/Listing` | User; body `id`; owner or forwarded owner with level 10. |
| GET | `/uploads/{filename}` | Public static image file; no body credentials. |

Authenticated **GET routes require JSON bodies**. Query parameters, cookies, or an `Authorization: Bearer` header do not substitute for these fields. Browser `fetch` disallows GET bodies, and some proxies/clients do not support them; browser integration needs a compatible server adapter or an intentional API change. There is no configured CORS policy in this backend.

## Account walkthrough

These examples assume the HTTP profile, a seeded database, and an exact school name returned by `/Schools`. Replace `YOUR_APP_ACCESS`, `YOUR_RETURNED_TOKEN`, school names, and IDs with your local values. Do not include `user` or `location` when registering; the server generates the username and rejects either field when non-null at registration.

### Register and log in

```sh
curl -i http://localhost:5239/Register \
  -H 'Content-Type: application/json' \
  --data '{"app_access":"YOUR_APP_ACCESS","email":"jane@example.com","first_name":"Jane","last_name":"Doe","password":"Password!123","school":"University of Colorado Denver"}'

curl -i http://localhost:5239/LogIn \
  -H 'Content-Type: application/json' \
  --data '{"app_access":"YOUR_APP_ACCESS","email":"jane@example.com","password":"Password!123"}'
```

Registration returns `201` with `message` and normalized `email`, but no token. Login returns `201` with `message`, `access_token`, and `first_name`. Copy the token for later calls; rely on status codes and fields rather than exact message spelling.

### Read or update a profile

```sh
curl -i --request GET http://localhost:5239/Register \
  -H 'Content-Type: application/json' \
  --data '{"app_access":"YOUR_APP_ACCESS","access_token":"YOUR_RETURNED_TOKEN"}'

curl -i --request PATCH http://localhost:5239/Register \
  -H 'Content-Type: application/json' \
  --data '{"app_access":"YOUR_APP_ACCESS","access_token":"YOUR_RETURNED_TOKEN","first_name":"Alice","location":"Denver"}'
```

Profile reads return `email`, `user`, `first_name`, `last_name`, `school`, and `location`, without a password. PATCH accepts `email`, `first_name`, `last_name`, `password`, `school`, `user`, and `location`. Omitted/null/blank fields retain their current values; a request with no nonblank updates returns `400`. A duplicate email returns `409` without applying the update.

| Field | Validation / normalization |
| --- | --- |
| Email | Trimmed and lowercased; at most 50 characters; must pass the server's email regex. |
| First/last name | Trimmed, initial capitals per word; only ASCII letters and spaces pass the name regex. Hyphens, apostrophes, and accented letters currently fail. |
| Password | Trimmed; 8–50 characters; at least one ASCII uppercase letter and one symbol from `!@#$%^&*_-+=`; only ASCII letters, digits, and those symbols are allowed. |
| School | Trimmed; exact stored full school name, rather than abbreviation. |
| Username (`user`) | Generated at registration; updates normalize/check uniqueness and require lowercase letters, digits, `_` or `-`, at least two characters. |
| Location | Whitespace normalized; blank PATCH values keep the previous location. |

### Log out

```sh
curl -i --request DELETE http://localhost:5239/LogIn \
  -H 'Content-Type: application/json' \
  --data '{"app_access":"YOUR_APP_ACCESS","access_token":"YOUR_RETURNED_TOKEN"}'
```

Logout deletes **all** tokens for that user. After application/IP validation succeeds, missing or invalid user tokens also receive the same `200` logout confirmation. With valid `to_user` forwarding, logout applies to the target user.

## Marketplace walkthrough

### Look up values and browse

```sh
curl -i --request GET http://localhost:5239/Category \
  -H 'Content-Type: application/json' --data '{"app_access":"YOUR_APP_ACCESS"}'
curl -i --request GET http://localhost:5239/Condition \
  -H 'Content-Type: application/json' --data '{"app_access":"YOUR_APP_ACCESS"}'
curl -i --request GET http://localhost:5239/Listing \
  -H 'Content-Type: application/json' \
  --data '{"app_access":"YOUR_APP_ACCESS","category":"Textbooks","search":"calculus"}'
```

`GET /Listing` accepts optional body `category`, `search`, `isbn`, and `for_user` fields. The category filter uses the stored name. ISBN filtering removes spaces/hyphens, uppercases `X`, and checks ISBN-10/13 validity. Search ranks titles by relevance rather than filtering every nonmatching row out; for more than 2,000 results, fuzzy scoring is restricted to the strongest 2,000 candidates after a cheaper ranking step.

The catalog returns an array of objects with `id`, `title`, `price`, `category`, `condition`, `location`, `isbn`, `image_url`, `datetime`, and seller `user`; no results returns `[]`. Image URLs are relative paths such as `/uploads/<generated-name>.png`.

Any non-null `for_user` value switches to the authenticated user's listings, including statuses other than active, and adds `status` to the response. Its string value does **not** select an arbitrary username: selection comes from `access_token`, or from permitted `to_user` forwarding. For example:

```sh
curl -i --request GET http://localhost:5239/Listing \
  -H 'Content-Type: application/json' \
  --data '{"app_access":"YOUR_APP_ACCESS","access_token":"YOUR_RETURNED_TOKEN","for_user":"self"}'
```

### Create a listing

Use category and condition names from your own database:

```sh
curl -i http://localhost:5239/Listing \
  -H 'Content-Type: application/json' \
  --data '{"app_access":"YOUR_APP_ACCESS","access_token":"YOUR_RETURNED_TOKEN","title":"Calculus textbook","description":"Used copy with notes.","price":25.00,"category":"Textbooks","condition":"Good","isbn":"9780306406157"}'
```

Creation returns `201` with `{"message":"Listing created successfully!"}`. It does not return the listing ID; retrieve your listings afterward to obtain it.

- `title` is required, trimmed, and limited to 200 characters; capitalization is normalized.
- `description` is optional and limited to 2,000 characters; `price` must be nonnegative.
- Category and condition are required and matched case-insensitively against their lookup tables.
- ISBN is optional and accepted only for the `Textbooks` category. Both ISBN-10 and ISBN-13 check digits are validated.
- Optional `imageBase64` is an array of at most **8** Base64 strings. Plain Base64 and `data:image/...;base64,...` forms are accepted. PNG, JPEG, and WebP are identified from signature bytes; each decoded file is limited to **2 MiB**. This is a signature check, not a full image decode.
- The server sets the owner from the validated token and the expiry to **90 days**. Files receive random names under `<path>/public/uploads/`.

The API submits images inside JSON rather than multipart form data. Host/proxy request-size limits can impose a lower effective total upload limit. Database records and files are separate resources; failures can leave partial files, so inspect uploads when testing failed multi-image requests.

### Read detail or delete

```sh
curl -i --request GET http://localhost:5239/Listing/1 \
  -H 'Content-Type: application/json' --data '{"app_access":"YOUR_APP_ACCESS"}'

curl -i --request DELETE http://localhost:5239/Listing \
  -H 'Content-Type: application/json' \
  --data '{"app_access":"YOUR_APP_ACCESS","access_token":"YOUR_RETURNED_TOKEN","id":1}'
```

Detail includes description, status, decrypted seller email, seller names, and `images_url` (null when no images exist). Detail lookup does not restrict results to active status. A missing detail returns `400`; a missing deletion target returns `404`. Deletion checks ownership; an admin must forward to the owner to delete another user's listing. The route is `DELETE /Listing` with body `id`, not `DELETE /Listing/{id}`. No listing update endpoint is implemented.

## Administration

Admin privileges come from `Admins` records. Use a login-issued `access_token` belonging to an administrator; the body field `admin_token` has a different IP-forwarding purpose.

| Permission | Required caller level / rule |
| --- | --- |
| List users; manage schools/categories; forward profiles; delete accounts/listings as a target | At least 10. |
| Inspect or clear attempt blocks | At least 20. |
| Include numeric admin levels in `/Users` results | At least 27. |
| Set `locked` when creating/updating an admin; act on a locked admin | At least 30. |
| Add/update/remove admin membership | Positive caller level, required `to_user`, and target hierarchy checks. |

`to_user` is an exact stored normalized email. It is not trimmed/lowercased before lookup. The caller must be an admin; an existing admin target must have a strictly lower level. Locked admin targets require caller level 30. Additional route rules still apply. Omit `to_user` for normal self requests.

Examples, using an appropriately privileged token and disposable target account:

```sh
# Check your own membership.
curl -i --request GET http://localhost:5239/Admin \
  -H 'Content-Type: application/json' \
  --data '{"app_access":"YOUR_APP_ACCESS","access_token":"YOUR_ADMIN_TOKEN"}'

# List users.
curl -i --request GET http://localhost:5239/Users \
  -H 'Content-Type: application/json' \
  --data '{"app_access":"YOUR_APP_ACCESS","access_token":"YOUR_ADMIN_TOKEN"}'

# Create a lower-level administrator; use PATCH to change an existing admin.
curl -i http://localhost:5239/Admin \
  -H 'Content-Type: application/json' \
  --data '{"app_access":"YOUR_APP_ACCESS","access_token":"YOUR_ADMIN_TOKEN","to_user":"jane@example.com","level":10}'

# Delete a target account (requires to_user, rather than a separate email field).
curl -i --request DELETE http://localhost:5239/Register \
  -H 'Content-Type: application/json' \
  --data '{"app_access":"YOUR_APP_ACCESS","access_token":"YOUR_ADMIN_TOKEN","to_user":"jane@example.com"}'
```

Admin POST/PATCH requires a nonnegative `level` strictly below the caller's level. Optional `locked` must be `0` or `1`; including it requires level 30. DELETE `/Admin` removes membership through `to_user`. `/Admin` GET, `/Users`, school management, and block management reject user forwarding. Category management and listing creation use their own controller checks; do not assume forwarding rules are identical across routes.

`/Users` returns parallel arrays inside `body`, including decrypted email, `Last, First` name, school abbreviation/full name, registration datetime, username, admin membership, and locked state. At level 27 or higher it also includes numeric `level` and sorts by level first. Empty results return `{"body":{}}`.

For school management, send `name` and `short_name`. For category management, send `category`. Use `POST` to add and `DELETE` to remove; removals are subject to the actual database constraints and references.

`GET /Blocked` returns `blockedUsers` and `blockedIPs` row arrays. It can include below-threshold or expired attempt records, and IP results require user/IP relationships. `DELETE /Blocked` requires exactly one of `email` or `ip_addr`, alongside App and admin user credentials. Selectors must match stored values exactly. Clearing user attempts does not clear IP attempts, and neither action restores tokens already revoked by a user block.

Account/listing deletion relies in part on database relationships for related-row cleanup. Check the supplied database's actual constraints and foreign-key behavior before relying on cascade deletion.

## Authentication and maintenance

`app_access` identifies the calling application; `access_token` identifies the user. Body validation happens inside controllers. `UseAuthorization()` does not provide a conventional bearer-token scheme for these endpoints.

- Tokens contain 32 random bytes, encoded as unpadded URL-safe Base64. Regular-user tokens expire after **21 days**; tokens for any admin member expire after **3 days**.
- Login reuses a token only if more than one day remains. Otherwise it creates another token without deleting the previous one. Reuse does not extend expiry.
- Profile/password updates do not revoke existing tokens. Logout revokes all tokens for the selected user.
- Known-user login failures and IP failures use five-minute windows with a threshold of **10 attempts**. User blocking deletes the user's tokens. Further repeated attempts extend blocking; successful login before the threshold does not reset the attempt count.
- Token validation does not separately check `Blocked_Users`; IP validation still applies.
- Timestamps are stored as Mountain local strings without an offset. Cleanup removes expired tokens/attempt rows and stale process-local locks, and changes expired active listings to status 3.

Optional `ip` plus `admin_token` fields support body-based IP forwarding. `admin_token` must be an **unexpired access token belonging to an admin**, independent of the normal user's `access_token`; it is not a configured shared secret. Ordinary clients should omit both fields. ASP.NET forwarded-header middleware is also enabled; configure proxy trust deliberately for deployment.

Current limitations relevant to development and deployment:

- Passwords, emails, and IP addresses use deterministic, reversible encryption. Passwords do not use a dedicated password hash, and the default configuration-wrapper key is present in source.
- Several server-error responses contain exception details. Do not expose development data/secrets through public testing.
- SQLite connections do not explicitly enable foreign-key enforcement. Confirm behavior with the actual database/provider rather than assuming every declared cascade is active.
- SQLite synchronization and per-user/IP locks are process-local, so multiple server instances do not share those protections.
- Listing orphan-file cleanup currently has an inverted directory-existence guard in `Listing.CleanUp()`. Automatic removal of orphaned uploads should not be assumed to work; back up and inspect files before manual removal.

## Publish and run a release

From the repository root:

```sh
dotnet publish StudentExchangeBck/StudentExchangeBck.csproj \
  --configuration Release --output ./artifacts/publish
```

This produces a framework-dependent deployment. The destination needs the **.NET 9 ASP.NET Core runtime**. Publishing does not provision the database or guarantee that your local configuration/data files are copied; manage them separately.

Create a deployment working directory containing `path.env`, point it to a persistent directory containing `.env`, `.env2`, the database, and `public/uploads/`, and grant the service account the required read/write access. Launch from that working directory with an absolute DLL path, for example:

```sh
ASPNETCORE_ENVIRONMENT=Production \
  dotnet /absolute/path/to/artifacts/publish/StudentExchangeBck.dll \
  --urls http://127.0.0.1:8080
```

Launch profiles are a development feature and are not used by `dotnet StudentExchangeBck.dll`. The example HTTP binding is intended for a local reverse proxy that terminates TLS. Configure HTTPS and forwarded-header trust for the actual host. OpenAPI is disabled in Production by the current startup code. Persist and back up the database, matching encryption configuration, and uploads together; test restores as well as backups.

## Development and verification

| File | Responsibility |
| --- | --- |
| [Program.cs](StudentExchangeBck/Program.cs) | Application startup, middleware, static images, maintenance wiring. |
| [Register.cs](StudentExchangeBck/Controllers/Register.cs) | Registration/profile validation, updates, and account deletion. |
| [LogIn.cs](StudentExchangeBck/Controllers/LogIn.cs) | Login, token issuance/reuse, logout, token cleanup. |
| [Listing.cs](StudentExchangeBck/Controllers/Listing.cs) | Catalog ranking, ISBN validation, image storage, listing creation/deletion/expiry. |
| [Admin.cs](StudentExchangeBck/Controllers/Admin.cs) | Admin membership, levels, and locking. |
| [Users.cs](StudentExchangeBck/Controllers/Users.cs) | Admin directory, username generation, user lockout and locks. |
| [AppAuthJson.cs](StudentExchangeBck/Components/AppAuthJson.cs) | Shared body credentials, app/token validation, user/IP forwarding. |
| [IP.cs](StudentExchangeBck/Components/IP.cs) | IP tracking, relationships, blocking, cleanup. |
| [Env.cs](StudentExchangeBck/Components/Env.cs) | Runtime file loading and policy constants. |
| [Sql.cs](StudentExchangeBck/Components/Sql.cs) | Parameterized SQLite reads/writes, transactions, process-local synchronization. |
| [Maitenance.cs](StudentExchangeBck/Components/Maitenance.cs) | Daily background scheduler; filename spelling matches the source. |
| [DeterministicEncryption.cs](StudentExchangeBck/Components/DeterministicEncryption.cs) | Encryption/decryption used for configuration and stored values. |

`Sql.Read` maps column names to parallel value lists and returns an empty dictionary for zero rows. `Sql.Write` validates affected row counts: nonnegative values require an exact count, `-1` requires at least one row, and `-2` allows any count. Ordinary writes have individual transactions; operations can share an explicit `Sql.Trans`, as listing creation does.

There is **no automated test project** in this solution. `dotnet test` alone does not establish functional coverage. For a change, build the solution, then use a disposable compatible database to verify:

1. Schools, categories, conditions, and the development OpenAPI document respond successfully.
2. Registration succeeds once and duplicate email returns `409`.
3. Login returns a token; profile read and PATCH use that token successfully.
4. Listing creation, catalog/detail retrieval, image URLs, ISBN validation, and owner deletion behave as expected.
5. An ordinary user cannot perform admin actions; provisioned admins obey the required levels and target hierarchy.
6. Logout invalidates the token; subsequent protected requests fail.

The supplied [StudentExchangeBck.http](StudentExchangeBck/StudentExchangeBck.http) is a starting point; add the required body fields before using its requests. Historical logs/screenshots in `docs/progress-review/evidence/` are tied to earlier review work and are not current test results.

Review `git status` and `git diff --check` before committing. The existing `bin_/.gitignore` covers several default runtime filenames, but there is no root ignore file covering every local path. Keep `path.env`, alternate databases, secrets, uploads, SDK `bin/`/`obj/`, `work/`, and publish artifacts out of commits.

## Troubleshooting

| Symptom | Likely cause / next check |
| --- | --- |
| `dotnet: command not found` or SDK not found | Install the .NET 9 SDK and ensure its executable is on `PATH`; check `dotnet --info`. |
| NuGet restore fails | Check package-source connectivity and the package versions in the project file. |
| `path.env` not found | Start from `StudentExchangeBck/`, or supply `path.env` in the deployment working directory. |
| `.env2`, `.env`, or database path is wrong | Check `path` trailing slash and `db`; these strings are concatenated, not resolved through appsettings. |
| Base64/decryption/JSON error | `.env` must be encrypted with the project's implementation and expected wrapper salt. |
| Missing key while loading configuration | Ensure all four required JSON keys exist and are nonempty. |
| `no such table` / `no such column` | Use the complete current database; `DB_Schema.txt` alone omits marketplace tables and newer user columns. |
| Empty lookup or listing creation returns `500` | Seed schools, categories, and conditions; check status IDs/defaults and required columns. |
| HTTP root returns `404` | Expected; use `/Schools`, `/Listing` with credentials, or development `/openapi/v1.json`. |
| Browser cannot send a profile/catalog GET | Browser `fetch` forbids GET bodies; use a compatible adapter/client or revise the API contract. Check CORS separately. |
| `401` despite a valid user token | Include the correct body `app_access`; check route admin level and forwarding restrictions. |
| `400` for an apparently valid account/token | Check token expiry, IP/user blocks, exact school/target names, and JSON validation. |
| Login fails after replacing configuration | Restore matching email/password/IP keys or migrate stored ciphertext. |
| Uploaded image URL fails | Resolve the relative URL against the API origin; check the configured upload directory and file permissions. |
| HTTPS certificate or redirect failure | Check the selected launch profile, local certificate trust, and reverse-proxy TLS/forwarded-header configuration. |

Errors may be JSON objects with `message`, string responses (including duplicate-email conflicts), or ASP.NET validation Problem Details. Typical statuses are `400` for invalid input/token/blocks, `401` for missing credentials/permissions, `409` for duplicate emails, and `500` for unexpected failures. Malformed bodies or unsupported content types may be rejected before controller code runs. Inspect status and response shape rather than matching message text.

## Design documentation

- [UML atlas](docs/uml/README.md): diagrams, editable PowerPoint/PDF exports, semantic model, and rendering instructions.
- [Data-flow diagrams](docs/dfd/README.md): process decomposition, data dictionary, flow register, and validation tools.
- [Technical progress review](docs/progress-review/README.md): presentation, presenter notes, contribution records, and historical evidence.
- [Database schema reference](DB_Schema.txt): partial account/security schema; compare with the current source and supplied database.

Documentation generators have their own Python requirements and validation commands described in those directories. They are independent of building or running the API. Check each document's pinned source revision before treating its architecture or implementation status as current.
