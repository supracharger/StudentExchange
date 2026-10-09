# StudentExchangeBck

ASP.NET Core (.NET 9) REST API for student registration, login/logout, profile management, school lookup, and admin user/block management, backed by SQLite. Authentication uses application credentials and user tokens in JSON request bodies.

- [REST API reference and request examples](#use-the-rest-api)
- [Local setup and configuration](#local-setup-and-configuration)
- [Project map and development](#project-map-and-development)

## Use the REST API

Requests and responses use JSON. Send `Content-Type: application/json` for
requests with a body. The current API uses credentials in the **JSON body**,
including for authenticated GET routes; it does not implement Bearer-header or cookie
authentication.

| Method | Route | Credentials | Success |
| --- | --- | --- | --- |
| GET | `/Schools` | None | `200` with `schools` and `short_names` arrays. |
| POST | `/Register` | `app_access` | `201` with registration confirmation and normalized email. |
| POST | `/LogIn` | `app_access`, email, password | `201` with user token and first name. |
| GET | `/Register` | `app_access`, `access_token` | `200` with current user's profile. |
| PATCH | `/Register` | `app_access`, `access_token` | `200` with update confirmation and email. |
| DELETE | `/LogIn` | `app_access`, `access_token` | `200` with logout confirmation; deletes all tokens for the user. |
| GET | `/Admin` | `app_access`, `access_token` | `200` with `is_admin`; includes `level` for admins. |
| GET | `/Users` | `app_access`, admin `access_token` (level ≥ 1) | `200` with user columns inside `body`. |
| DELETE | `/Register` | `app_access`, admin `access_token` (level ≥ 1), `email` | `200` with deletion confirmation, email, and row count. |
| GET | `/Blocked` | `app_access`, admin `access_token` (level ≥ 2) | `200` with `blockedUsers` and `blockedIPs` arrays. |
| DELETE | `/Blocked` | `app_access`, admin `access_token` (level ≥ 2), exactly one of `email` or `ip_addr` | `200` with unblock confirmation and row count. |

`app_access` is the shared application password. `access_token` identifies an
individual logged-in user. Registration does not issue a token: log in afterward.
Logout is described below. Account deletion requires an admin; there is no self-service deletion, password-reset, school-management, or admin-management endpoint.

Development also exposes the generated **[OpenAPI document](http://localhost:5239/openapi/v1.json)** at `/openapi/v1.json`. There is no configured Swagger UI. The examples here describe controller behavior, including response fields and authentication rules that the generated document may not fully express.

Examples assume the HTTP launch profile and a configured database. Replace `YOUR_APP_ACCESS` with `_appAccess` from your configuration, `YOUR_RETURNED_TOKEN` with the login result, and the school with an exact name returned by `/Schools`.

### 1. List schools

```sh
curl -i http://localhost:5239/Schools
```

Example response (actual names depend on the database):

```json
{
  "schools": [
    "Metropolitan State University of Denver",
    "University of Colorado Denver"
  ],
  "short_names": ["MSU Denver", "CU Denver"]
}
```

Response properties use ASP.NET Core's default camel-case serialization: the C# property `Schools` becomes `schools`. Both arrays share the same row order, sorted by full school name; `short_names` comes from the database's `short_name` column. Select a full name from `schools` for registration, not its abbreviation. An empty table currently causes a server error because the controller indexes missing result keys.

### 2. Register an account

```sh
curl -i http://localhost:5239/Register \
  -H 'Content-Type: application/json' \
  --data '{
    "app_access": "YOUR_APP_ACCESS",
    "email": "jane@example.com",
    "first_name": "jane",
    "last_name": "doe",
    "password": "Password!123",
    "school": "University of Colorado Denver"
  }'
```

Success is **201 Created**:

```json
{"message":"User added.","email":"jane@example.com"}
```

Registering the same normalized email again returns **409 Conflict**.

### 3. Log in

```sh
curl -i http://localhost:5239/LogIn \
  -H 'Content-Type: application/json' \
  --data '{
    "app_access": "YOUR_APP_ACCESS",
    "email": "jane@example.com",
    "password": "Password!123"
  }'
```

Success is **201 Created** (the token below is a placeholder):

```json
{
  "message": "Successfull Login.",
  "access_token": "YOUR_RETURNED_TOKEN",
  "first_name": "Jane"
}
```

Copy the returned `access_token` into subsequent profile requests. The misspelling
in the success message reflects the current response. Use status codes and
structured fields rather than matching the message text.

### 4. Read your profile

```sh
curl -i --request GET http://localhost:5239/Register \
  -H 'Content-Type: application/json' \
  --data '{
    "app_access": "YOUR_APP_ACCESS",
    "access_token": "YOUR_RETURNED_TOKEN"
  }'
```

Success is **200 OK**:

```json
{
  "email": "jane@example.com",
  "first_name": "Jane",
  "last_name": "Doe",
  "school": "University of Colorado Denver"
}
```

The profile response does **not** return a password. Some clients and proxies do
not support GET requests with bodies; browser `fetch` also disallows them. This
endpoint currently requires one. Query parameters or an `Authorization` header
are not substitutes; clients must use a transport supporting this contract, or
the API contract must be deliberately revised.

### 5. Update selected profile fields

```sh
curl -i --request PATCH http://localhost:5239/Register \
  -H 'Content-Type: application/json' \
  --data '{
    "app_access": "YOUR_APP_ACCESS",
    "access_token": "YOUR_RETURNED_TOKEN",
    "first_name": "alice"
  }'
```

Success is **200 OK**:

```json
{"message":"Successfully updated: first_name.","email":"jane@example.com"}
```

Editable fields are `email`, `first_name`, `last_name`, `password`, and `school`.
Omitted, JSON `null`, empty, and whitespace-only fields retain their existing values. A request without any nonblank editable fields
returns **400 Bad Request**. A duplicate email returns **409 Conflict** and no profile fields are changed. The response lists updated field names; when updating
multiple fields, clients should not depend on their ordering in the message.

### 6. Log out

```sh
curl -i --request DELETE http://localhost:5239/LogIn \
  -H 'Content-Type: application/json' \
  --data '{"app_access":"YOUR_APP_ACCESS","access_token":"YOUR_RETURNED_TOKEN"}'
```

Success is **200 OK**:

```json
{"message":"You have been logged out."}
```

A valid token deletes **all** access tokens for that user, including tokens used by other sessions. With admin user forwarding (`to_user`, described below), logout instead deletes all tokens for the selected user. After application/IP validation passes, missing or invalid tokens also return the same `200` confirmation. The controller masks any token-validation error with this confirmation; it does not guarantee that a token was found or deleted. A wrong application password or IP block still fails before this step.

### Admin access and user forwarding

Admin membership and permissions come from `Admins.user_id` and `Admins.level`, not from the body field `admin_token`. Any admin membership qualifies for the shorter admin token lifetime; specific actions require the levels in the route table. There is no API for assigning levels: provision them directly in a development database or through your team's database-management process.

Use your own login token to check membership:

```sh
curl -i --request GET http://localhost:5239/Admin \
  -H 'Content-Type: application/json' \
  --data '{"app_access":"YOUR_APP_ACCESS","access_token":"YOUR_RETURNED_TOKEN"}'
```

Success is `200` with `{"is_admin":false}` for a regular user, or, for example, `{"is_admin":true,"level":2}` for an admin.

Token-authenticated bodies optionally accept `to_user`, the email of a user to act as. Omit it for ordinary requests. The token must belong to an admin, and an admin target must have a strictly lower level than the caller. Unlike registration/login, `to_user` is **not trimmed or lowercased** before lookup; supply the exact stored normalized email. A blank or unknown target returns `400`, and a regular caller or an admin target at an equal/higher level returns `401`.

`GET /Register` and `PATCH /Register` allow forwarding only for callers at level ≥ 1. For example, a level-1-or-higher admin can read a regular user's profile with:

```sh
curl -i --request GET http://localhost:5239/Register \
  -H 'Content-Type: application/json' \
  --data '{"app_access":"YOUR_APP_ACCESS","access_token":"YOUR_ADMIN_TOKEN","to_user":"jane@example.com"}'
```

The same `to_user` field selects the target of a profile PATCH. `DELETE /LogIn` also honors it, subject to the shared admin/target checks, but has no additional minimum-level check. `GET /Admin`, `GET /Users`, `DELETE /Register`, and both `/Blocked` actions reject user forwarding even when the caller is an admin. Their target email/IP fields, where applicable, are separate from `to_user`. Body IP forwarding (`ip`, `admin_token`) is an independent feature. `YOUR_ADMIN_TOKEN` in these examples means a login-issued **access token belonging to an admin**, not the configured `_adminToken` secret.

### List users (admin level ≥ 1)

```sh
curl -i --request GET http://localhost:5239/Users \
  -H 'Content-Type: application/json' \
  --data '{"app_access":"YOUR_APP_ACCESS","access_token":"YOUR_ADMIN_TOKEN"}'
```

Example `200` response:

```json
{
  "body": {
    "email": ["jane@example.com"],
    "name": ["Doe, Jane"],
    "school": ["CU Denver"],
    "datetime": ["2026-10-09T12:00:00"]
  }
}
```

This response contains parallel column arrays, ordered by registration `datetime` descending. Emails are decrypted, names use `Last, First`, and school labels use `short_name`, falling back to the full name when the abbreviation is SQL `NULL`. With no matching rows, the response is `{"body":{}}`.

### Delete an account (admin level ≥ 1)

This deletes the matching `User` row. Use disposable accounts when trying it:

```sh
curl -i --request DELETE http://localhost:5239/Register \
  -H 'Content-Type: application/json' \
  --data '{"app_access":"YOUR_APP_ACCESS","access_token":"YOUR_ADMIN_TOKEN","email":"jane@example.com"}'
```

Example `200` response:

```json
{"message":"Successfully deleted user.","email":"jane@example.com","deleted_Rows":1}
```

`email` must be nonblank and exactly match the stored normalized address; it is not trimmed or lowercased here. An unknown email returns `400`. Omit `first_name`, `last_name`, `password`, and `school`: any non-null value, including an empty string, is rejected. The action checks the caller's admin level but does **not** compare it with the target's level; an eligible caller can target an admin account too. It issues only a `DELETE FROM User`, with no explicit deletion of related tokens, admin rows, lockout rows, or IP relationships. Related-row cleanup depends on the database's actual constraints/triggers; the supplied schema notes do not define cascading deletes.

### Inspect and clear attempt records (admin level ≥ 2)

```sh
curl -i --request GET http://localhost:5239/Blocked \
  -H 'Content-Type: application/json' \
  --data '{"app_access":"YOUR_APP_ACCESS","access_token":"YOUR_ADMIN_TOKEN"}'
```

Example `200` response (values depend on recent requests):

```json
{
  "blockedUsers": [
    {"name":"Doe, Jane","email":"jane@example.com","expiry":"2026-10-09T12:05:00","count":10}
  ],
  "blockedIPs": [
    {"ip":"192.0.2.10","name":"Doe, Jane","email":"jane@example.com","expiry":"2026-10-09T12:05:00","count":10}
  ]
}
```

These are arrays of row objects, ordered by `Last, First`; emails and IPs are decrypted. Empty results are `[]`. The queries do not filter by count or expiry, so results may include attempts below the blocking threshold and expired records awaiting cleanup. IP results require a tracked user/IP relationship: an IP with no associated user is omitted, and one associated with multiple users may appear multiple times.

Clear a user's attempt records with:

```sh
curl -i --request DELETE http://localhost:5239/Blocked \
  -H 'Content-Type: application/json' \
  --data '{"app_access":"YOUR_APP_ACCESS","access_token":"YOUR_ADMIN_TOKEN","email":"jane@example.com"}'
```

Example `200` response:

```json
{"message":"Successfully unblocked user.","email":"jane@example.com","deleted_Rows":1}
```

To clear IP attempt records, use:

```sh
curl -i --request DELETE http://localhost:5239/Blocked \
  -H 'Content-Type: application/json' \
  --data '{"app_access":"YOUR_APP_ACCESS","access_token":"YOUR_ADMIN_TOKEN","ip_addr":"192.0.2.10"}'
```

Example `200` response:

```json
{"message":"Successfully unblocked IP Address.","ip":"192.0.2.10","deleted_Rows":1}
```

Supply exactly one nonblank selector; neither or both returns `400`. Selectors are not normalized, so use the exact email or IP string stored by the application. Unknown targets or targets with no attempt rows return `400`. Deletion clears all matching attempt rows, including expired/below-threshold rows, and does not restore tokens deleted by a user lockout. Clearing a user's records does not clear its IP records, or vice versa.

Insufficient admin level on `/Users`, account deletion, or `/Blocked` increments the current request IP's failure count and returns `401`, or `400` if that IP becomes blocked. Forwarded-user requests return `400` on `/Admin`, account deletion, and `DELETE /Blocked`; they return `401` on `/Users` and `GET /Blocked`.

### Optional IP forwarding fields

Authenticated request bodies also accept `ip` and `admin_token`. Normal clients should omit them. A trusted intermediary can provide a nonblank `ip` and an `admin_token` matching configured `_adminToken` to record the forwarded address. This shared forwarding secret is separate from a user's access token and from membership in the `Admins` table.

Application validation tracks the connection IP and checks its block state. Incorrect `app_access` or a supplied incorrect `admin_token` increments that IP's failure count. An incorrect `admin_token` alone does not immediately reject a request with valid `app_access`; it disables body-based forwarding and may trigger an IP block. Forwarded addresses are recorded; body forwarding does not perform a separate block check for that address at this stage. Incorrect login credentials increment the forwarded IP's counter when forwarding is active. `Program.cs` also enables ASP.NET Core forwarded-header middleware; its proxy trust rules govern which headers are accepted.

### Field validation

Registration requires every editable field. PATCH applies the same validation to
the resulting complete profile.

| Field | Current rule |
| --- | --- |
| `email` | Trimmed and lowercased using the current culture; at most 50 characters; must match the email regex in `Register.cs`. |
| `first_name`, `last_name` | Trimmed and normalized to initial capitals per space-separated word. Only ASCII letters and spaces between words pass validation; apostrophes, hyphens, and accented letters currently fail. |
| `password` | Trimmed; 8–50 characters; at least one ASCII uppercase letter and one allowed symbol. Only ASCII letters, digits, and `!@#$%^&*_-+=` are allowed. A digit or lowercase letter is not separately required. |
| `school` | Trimmed; must exactly match a stored school name. |

Login also trims the password and trims/lowercases the email. Names and passwords
have deliberate implementation restrictions; consider client validation a
convenience and keep server validation authoritative.

### Errors and authentication lifecycle

| Status | Typical cause |
| --- | --- |
| `400` | Invalid fields, wrong email/password, expired or unknown token, lockout, or an empty update. |
| `401` | Missing/wrong application password, missing/blank token, insufficient admin permission, or disallowed user forwarding (route-dependent). |
| `409` | Registration or profile update would duplicate an email. |
| `500` | Database/configuration failure or another unexpected server error. Inspect server logs. |

Most controller-generated errors have a `message` property, for example `{"message":"Not authorized."}`. Duplicate-email conflicts return the string `A user with that email already exists.` rather than a message object (the default formatter may send plain text). ASP.NET Core may
return a validation Problem Details body for malformed JSON or model-binding
errors; callers should handle both shapes. Unsupported body media types may
produce `415` before a controller runs.

Tokens contain 32 random bytes encoded as URL-safe Base64 without padding. New tokens expire after **21 days** for regular users and **3 days** for users present in `Admins`. Login reuses a token only when it has **more than one day remaining**; otherwise it creates another token without deleting the old one. Reuse does not extend expiration. Profile requests accept any unexpired token. Password/profile updates do not revoke tokens; logout deletes all user tokens.

For a known email, failed logins are counted within a five-minute window beginning with the first failure. At **10 failures**, all user tokens are deleted and login is blocked until that window's existing expiry; the tenth failure does not start a fresh five-minute window. Requests during an active block increment the count even with correct credentials. At counts 20, 30, 40, …, expiry is extended from the later of the previous expiry or now by 5, 5, 10, … minutes. Successful login before the threshold does not reset the count. Unknown emails do not create a user failure row. Token validation itself does not check `Blocked_Users`.

IP blocking uses the same threshold/window and extension pattern, but does not delete user tokens. IP checks can return `400` even with valid application credentials. Policy values are defined in `Env.cs`. Expirations are stored as Mountain local timestamps without an offset. Startup and daily maintenance at **03:24 Mountain time** clean expired token, user-attempt, and IP-attempt rows and expired lock entries. The scheduler calculates local-time waits; daylight-saving transition handling is not explicitly implemented.

## Local setup and configuration

Install the **.NET 9 SDK**. From the repository root:

```sh
dotnet restore StudentExchangeBck/StudentExchangeBck.sln
dotnet build StudentExchangeBck/StudentExchangeBck.sln
cd StudentExchangeBck
# Prepare bin_/.env and bin_/Data.db before running.
dotnet run --launch-profile http
```

The HTTP profile uses `http://localhost:5239` and `Development`. For HTTPS, run `dotnet dev-certs https --trust`, then `dotnet run --launch-profile https`; this profile binds `https://localhost:7000` and the HTTP port. HTTPS redirection is enabled. For automatic rebuilds, use `dotnet watch run --launch-profile http` from the application directory.

### Required files

Debug uses `bin_/.env` and `bin_/Data.db` relative to the process working directory. Release uses `/home/bin_/.env` and `/home/bin_/Data.db`. There is currently **no `STUDENT_EXCHANGE_DATA_DIRECTORY` override**. Run from the application directory for the Debug paths above. Startup loads configuration and runs database cleanup before creating the HTTP host.

`.env` is **encrypted JSON**, not dotenv `KEY=value` text or plaintext JSON. Obtain compatible configuration and a populated/schema-ready database from the team. To create isolated development configuration, serialize the following keys to JSON and write the Base64 result of `DeterministicEncryption.Encrypt(json, salt)` to `.env`, using the salt expected by `Env.GetEnv()`. Use separate development values and keep encryption keys paired with their database.

| Required JSON key | Purpose |
| --- | --- |
| `_appAccess` | Shared application password (`app_access`). |
| `_emailSalt` | Deterministic email encryption/lookup key material. |
| `_passSalt` | Deterministic password encryption/comparison key material. |
| `_ipSalt` | Deterministic IP encryption key material. |
| `_adminToken` | Shared secret enabling body-based IP forwarding. |

All five keys are read and values trimmed during loading. Use nonempty values; the current loader does not enforce nonempty secrets. Changing email/password/IP keys without migrating their stored values breaks corresponding lookups.

The database must contain these tables and the columns used by the implementation:

| Table | Required columns |
| --- | --- |
| `Schools` | `id`, `name`, `short_name` |
| `User` | `id`, `email`, `first_name`, `last_name`, `password`, `school_id`, `datetime` |
| `Access_Token` | `id`, `user_id`, `token`, `expiry` |
| `Blocked_Users` | `id`, `user_id`, `count`, `expiry` |
| `Admins` | `user_id`, `level` |
| `IP` | `id`, `ip`, `datetime` |
| `User_Has_IPs` | `user_id`, `ip_id` |
| `Blocked_IPs` | `id`, `ip_id`, `count`, `expiry` |

This is a column inventory, not a migration script. [DB_Schema.txt](DB_Schema.txt) includes table/index definitions and a relationship sketch, but is not directly executable SQL as a whole and its `Schools` definition is missing `short_name`. When preparing a database from those definitions, add that column before calling `/Schools` or `/Users`:

```sql
-- Only for a database whose Schools table does not already have this column.
ALTER TABLE Schools ADD COLUMN short_name TEXT;
```

Set abbreviations as needed; `/Users` falls back to full names for SQL `NULL` abbreviations. `Admins.level` is an integer and defaults to `0` in the schema notes; that level does not grant user-list/profile-forwarding/deletion or block-management permissions.

Preserve compatible primary keys and uniqueness constraints, especially unique `User.email` and `Access_Token.token`. Seed at least one school. There is no automatic schema initialization, EF Core model, or migration system, and this checkout does not include a database. SQLite can create an empty file, but startup then fails on missing tables.

## Project map and development

| Source | Responsibility |
| --- | --- |
| [Program.cs](StudentExchangeBck/Program.cs) | Configuration, startup/daily cleanup, forwarded headers, OpenAPI, HTTP pipeline. |
| [Register.cs](StudentExchangeBck/Controllers/Register.cs) | Registration, profile reads/updates, admin account deletion, field validation. |
| [LogIn.cs](StudentExchangeBck/Controllers/LogIn.cs) | Login/logout, token issuance and token cleanup. |
| [Schools.cs](StudentExchangeBck/Controllers/Schools.cs) | Public full-name and abbreviation lists. |
| [Admin.cs](StudentExchangeBck/Controllers/Admin.cs) | Current user's admin membership and level. |
| [Blocked.cs](StudentExchangeBck/Controllers/Blocked.cs) | Admin attempt-record listing and unblocking. |
| [Users.cs](StudentExchangeBck/Components/Users.cs) | Admin `/Users` controller, user blocking/cleanup, per-user locks. |
| [AppAuthJson.cs](StudentExchangeBck/Components/AppAuthJson.cs) | Body credentials, application/token validation, admin user forwarding. |
| [IP.cs](StudentExchangeBck/Components/IP.cs) | IP tracking, user/IP relationships, IP blocking and cleanup. |
| [Env.cs](StudentExchangeBck/Components/Env.cs) | Encrypted configuration and authentication policy. |
| [Sql.cs](StudentExchangeBck/Components/Sql.cs) | Parameterized SQLite reads/writes and process-local synchronization. |
| [Maitenance.cs](StudentExchangeBck/Components/Maitenance.cs) | Daily background scheduling; spelling matches the source. |
| [AccessToken.cs](StudentExchangeBck/Components/AccessToken.cs) | Random URL-safe token generation. |
| [DeterministicEncryption.cs](StudentExchangeBck/Components/DeterministicEncryption.cs) | Reversible encryption. |
| [Utilz.cs](StudentExchangeBck/Components/Utilz.cs) | Name formatting and Mountain-time conversion. |

Runtime package versions are defined in [StudentExchangeBck.csproj](StudentExchangeBck/StudentExchangeBck.csproj): OpenAPI 9.0.12, Microsoft.Data.Sqlite 10.0.12, and Newtonsoft.Json 13.0.4. The solution currently contains only the API project; **no automated test project is included**. Verify changes with a build and the REST workflow above against disposable development data. The existing `.http` file targets localhost, with an optional commented Azure address, and lists routes without required JSON bodies; complete the requests before use.

`Sql.Read` returns column names mapped to value lists; zero rows return an empty dictionary. `Sql.Write` accepts parameterized INSERT/UPDATE/DELETE statements and returns the affected row count. A nonnegative expected row count requires an exact match; `-1` requires at least one row, and `-2` allows any count. Each write uses its own transaction; separate calls do not share one. SQLite foreign-key enforcement is not explicitly enabled in the connection string. User/IP locks and reader/writer synchronization are process-local; they do not coordinate multiple API instances.

### Current implementation considerations

Passwords, emails, and IP addresses use deterministic, reversible encryption. Passwords are not stored with a dedicated password hash. The `.env` wrapper's default key is present in source. Protect configuration/data files and use HTTPS for deployed traffic. Some `500` response messages include full exception details; consumers should handle them as errors rather than depend on their text.

Authentication is checked inside controllers; `UseAuthorization()` does not implement these body credential checks. There is no configured CORS policy. Browser clients need to account for both cross-origin access and the authenticated GET-body contract.

### Troubleshooting

| Symptom | Check |
| --- | --- |
| Failure before HTTP startup | Working directory, encrypted `.env`, all five configuration keys, database tables required by startup cleanup. |
| Login or token-authenticated requests return `500` | Database includes `Admins.level` and IP tracking tables as well as account/token tables. |
| School lookup or `/Users` fails | Ensure `Schools.short_name` exists; seed `Schools` because an empty school list currently causes an error. |
| Profile fails after login | Send both body credentials; verify token expiry and IP blocking. |
| Browser cannot read profile | `fetch` disallows GET bodies; current endpoint requires a transport that supports them. |
| Existing accounts fail after key changes | Restore matching encryption keys or migrate stored records. |
| Duplicate-email response differs from other errors | Handle the conflict string as well as JSON message/Problem Details bodies. |

Before committing, review `git status` and `git diff`; keep configuration, local database files, and build outputs out of the change.
