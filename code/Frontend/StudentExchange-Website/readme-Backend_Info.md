# StudentExchangeBck

Administrator API additions and the updated deletion contract are documented in [docs/administration.md](docs/administration.md). `DELETE /Register` selects its target using `to_user`, not `email`. The account examples below otherwise describe the older backend snapshot.

ASP.NET Core (.NET 9) REST API for student registration, login/logout, profile management, and school lookup, backed by SQLite. Authentication uses application credentials and user tokens in JSON request bodies.

- [REST API reference and request examples](#use-the-rest-api)
- [Local setup and configuration](#local-setup-and-configuration)
- [Project map and development](#project-map-and-development)

## Use the REST API

Requests and responses use JSON. Send `Content-Type: application/json` for
requests with a body. The current API uses credentials in the **JSON body**,
including for `GET /Register`; it does not implement Bearer-header or cookie
authentication.

| Method | Route | Credentials | Success |
| --- | --- | --- | --- |
| GET | `/Schools` | None | `200` with lowercase `schools` array and `short_names` metadata. |
| POST | `/Register` | `app_access` | `201` with registration confirmation and normalized email. |
| POST | `/LogIn` | `app_access`, email, password | `201` with user token and first name. |
| GET | `/Register` | `app_access`, `access_token` | `200` with current user's profile. |
| PATCH | `/Register` | `app_access`, `access_token` | `200` with update confirmation and email. |
| DELETE | `/Register` | `app_access`, admin `access_token`, `to_user` | `200` with account deletion confirmation. |
| DELETE | `/LogIn` | `app_access`, `access_token` | `200` with logout confirmation; deletes all tokens for the user. |

`app_access` is the shared application password. `access_token` identifies an
individual logged-in user. Registration does not issue a token: log in afterward.
Logout is described below. Administrator account deletion uses `DELETE /Register` with `to_user`. There is no password-reset or school-management endpoint.

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
  ]
}
```

The deployed response uses lowercase `schools` and also includes `short_names`. The website requires the lowercase `schools` field. Names are sorted by school name. An empty table currently causes a server error because the controller indexes a missing result key. Select a returned name for registration.

### Privileged test-account deletion (updated October 9, 2026)

Log in via `POST /LogIn` with a sudo user's email/password, then send `DELETE /Register` with `app_access`, the returned sudo `access_token`, and the target email in `to_user` (upcoming backend contract). Include `admin_token` and `ip` when forwarding a visitor address, as for other account calls. A regular user's token does not grant this privilege. The website provides this operation in the permission-checked administrator console and its server-side test cleanup helper. Deleting an unknown email currently returns `400` with an unknown-email message.

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

A valid token deletes **all** access tokens for that user, including tokens used by other sessions. After application/IP validation passes, missing or invalid tokens also return the same `200` confirmation. The controller masks any token-validation error with this confirmation; it does not guarantee that a token was found or deleted. A wrong application password or IP block still fails before this step.

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
| `401` | Missing/wrong application password, or missing/blank token on a profile request. |
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
| `Schools` | `id`, `name` |
| `User` | `id`, `email`, `first_name`, `last_name`, `password`, `school_id`, `datetime` |
| `Access_Token` | `id`, `user_id`, `token`, `expiry` |
| `Blocked_Users` | `id`, `user_id`, `count`, `expiry` |
| `Admins` | `user_id` |
| `IP` | `id`, `ip`, `datetime` |
| `User_Has_IPs` | `user_id`, `ip_id` |
| `Blocked_IPs` | `id`, `ip_id`, `count`, `expiry` |

This is a column inventory, not a migration script. Preserve compatible primary keys and uniqueness constraints, especially unique `User.email` and `Access_Token.token`. Seed at least one school. There is no automatic schema initialization, EF Core model, or migration system, and this checkout does not include a database. SQLite can create an empty file, but startup then fails on missing tables.

## Project map and development

| Source | Responsibility |
| --- | --- |
| [Program.cs](StudentExchangeBck/Program.cs) | Configuration, startup/daily cleanup, forwarded headers, OpenAPI, HTTP pipeline. |
| [Register.cs](StudentExchangeBck/Controllers/Register.cs) | Registration, profile reads/updates, field validation. |
| [LogIn.cs](StudentExchangeBck/Controllers/LogIn.cs) | Login/logout, token issuance, user blocking and cleanup. |
| [Schools.cs](StudentExchangeBck/Controllers/Schools.cs) | Public school list. |
| [AppAuthJson.cs](StudentExchangeBck/Components/AppAuthJson.cs) | Body credentials, application and token validation. |
| [IP.cs](StudentExchangeBck/Components/IP.cs) | IP tracking, user/IP relationships, IP blocking and cleanup. |
| [Env.cs](StudentExchangeBck/Components/Env.cs) | Encrypted configuration and authentication policy. |
| [Sql.cs](StudentExchangeBck/Components/Sql.cs) | Parameterized SQLite reads/writes and process-local synchronization. |
| [Maitenance.cs](StudentExchangeBck/Components/Maitenance.cs) | Daily background scheduling; spelling matches the source. |
| [AccessToken.cs](StudentExchangeBck/Components/AccessToken.cs) | Random URL-safe token generation. |
| [DeterministicEncryption.cs](StudentExchangeBck/Components/DeterministicEncryption.cs) | Reversible encryption. |
| [Utilz.cs](StudentExchangeBck/Components/Utilz.cs) | Name formatting and Mountain-time conversion. |

Runtime package versions are defined in [StudentExchangeBck.csproj](StudentExchangeBck/StudentExchangeBck.csproj): OpenAPI 9.0.12, Microsoft.Data.Sqlite 10.0.12, and Newtonsoft.Json 13.0.4. The solution currently contains only the API project; **no automated test project is included**. Verify changes with a build and the REST workflow above against disposable development data. The existing `.http` file targets an Azure address and has incomplete requests.

`Sql.Read` returns column names mapped to value lists; zero rows return an empty dictionary. `Sql.Write` accepts parameterized INSERT/UPDATE/DELETE statements. A nonnegative expected row count requires an exact match; `-1` requires at least one row, and `-2` allows any count. Each write uses its own transaction; separate calls do not share one. SQLite foreign-key enforcement is not explicitly enabled in the connection string. User/IP locks and reader/writer synchronization are process-local; they do not coordinate multiple API instances.

### Current implementation considerations

Passwords, emails, and IP addresses use deterministic, reversible encryption. Passwords are not stored with a dedicated password hash. The `.env` wrapper's default key is present in source. Protect configuration/data files and use HTTPS for deployed traffic. Some `500` response messages include full exception details; consumers should handle them as errors rather than depend on their text.

Authentication is checked inside controllers; `UseAuthorization()` does not implement these body credential checks. There is no configured CORS policy. Browser clients need to account for both cross-origin access and the GET-body profile contract.

### Troubleshooting

| Symptom | Check |
| --- | --- |
| Failure before HTTP startup | Working directory, encrypted `.env`, all five configuration keys, database tables required by startup cleanup. |
| Login returns `500` | Database includes `Admins` and IP tracking tables as well as account/token tables. |
| School lookup fails | Seed `Schools`; an empty result currently causes an error. |
| Profile fails after login | Send both body credentials; verify token expiry and IP blocking. |
| Browser cannot read profile | `fetch` disallows GET bodies; current endpoint requires a transport that supports them. |
| Existing accounts fail after key changes | Restore matching encryption keys or migrate stored records. |
| Duplicate-email response differs from other errors | Handle the conflict string as well as JSON message/Problem Details bodies. |

Before committing, review `git status` and `git diff`; keep configuration, local database files, and build outputs out of the change.
