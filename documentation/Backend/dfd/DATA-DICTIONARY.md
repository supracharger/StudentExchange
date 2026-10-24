# Data dictionary

Source application commit: `f91b923f4ec8f1072b3dda07070916459342d7a2`. Each element is a named data package; its fields define its information content. Alternatives and error variants belong to the same documented package.

## External entities

- **E1 — Visitor / student**
- **E2 — Administrator**
- **E3 — Direct listing API client**

## Store groups and primitive stores

| ID | Subject | Group | Implementation | Status |
| --- | --- | --- | --- | --- |
| G1 | Marketplace preview records | — | Logical aggregate; expanded in lower-level views | implemented |
| G2 | Account reference records | — | Logical aggregate; expanded in lower-level views | implemented |
| G3 | Security records | — | Logical aggregate; expanded in lower-level views | implemented |
| G4 | Website session records | — | Logical aggregate; expanded in lower-level views | implemented |
| G5 | Runtime service records | — | Logical aggregate; expanded in lower-level views | implemented |
| G6 | Listing records | — | Logical aggregate; expanded in lower-level views | incomplete |
| D1 | Sample catalog | G1 | src/data/listings.ts · bundled constant | preview |
| D2 | Preview conversation | G1 | App.tsx · messages[] in browser memory | preview |
| D3 | School directory | G2 | SQLite Schools | implemented |
| D4 | User accounts | G2 | SQLite User | implemented |
| D5 | Admin memberships | G3 | SQLite Admins | implemented |
| D6 | Access tokens | G3 | SQLite Access_Token | implemented |
| D7 | User attempt records | G3 | SQLite Blocked_Users | implemented |
| D8 | IP registry | G3 | SQLite IP | implemented |
| D9 | User / IP links | G3 | SQLite User_Has_IPs | implemented |
| D10 | IP attempt records | G3 | SQLite Blocked_IPs | implemented |
| D11 | Website sessions | G4 | Node sessions Map · opaque ID → token / expiry | implemented |
| D12 | Service token cache | G5 | Node forwarding-client closure | implemented |
| D13 | Runtime settings | G5 | Server environment + backend Env policy / paths | implemented |
| D14 | Listing records | G6 | Listings table inferred from SQL; missing from DDL | incomplete |
| D15 | Lock metadata | G5 | Users._userLock and IP lock dictionaries | implemented |

## Named data packages

| Key | Diagram noun phrase | Information content | Primitive store, if applicable |
| --- | --- | --- | --- |
| `browse` | Browse criteria | query, category, selectedListingId | — |
| `message` | Message draft | selectedListingId, messageInput | — |
| `offer` | Offer draft | selectedListingId, offerAmount | — |
| `cards` | Listing selection view | filtered sample cards, selected detail, empty state | — |
| `messages` | Message preview | local message strings, display state | — |
| `offers` | Offer preview | formatted local offer string, display state | — |
| `register` | Registration fields | email, first_name, last_name, password, school | — |
| `login` | Login credentials | email, password | — |
| `read_profile` | Profile read request | opaque session cookie | — |
| `edit_profile` | Profile change request | opaque cookie, selected nonblank fields | — |
| `logout` | Logout request | opaque session cookie or no cookie | — |
| `schools` | School lookup request | public directory request | — |
| `registration_result` | Registration result | normalized email, created status or validation/conflict/service error | — |
| `login_result` | Login result | public profile, opaque cookie or safe error | — |
| `profile_result` | Profile view | email, first_name, last_name, school or safe error | — |
| `edit_result` | Profile change result | saved notice, public profile or null, validation/conflict/error | — |
| `logout_result` | Logout confirmation | expired cookie, qualified sign-out message or safe error | — |
| `school_result` | School directory view | school names or safe error | — |
| `admin_status` | Membership inquiry | caller cookie | — |
| `admin_users` | User management request | caller cookie, target email, optional profile fields, operation | — |
| `admin_schools` | School management request | caller cookie, name, short_name, operation | — |
| `admin_roles` | Admin assignment request | caller cookie, to_user, level, optional locked, operation | — |
| `admin_attempts` | Attempt management request | caller cookie, email XOR ip_addr for clearing, operation | — |
| `admin_logout` | Target sign-out request | caller cookie, target email | — |
| `status_result` | Membership view | is_admin, level, projected permission flags or safe error | — |
| `users_result` | User management result | directory, target profile, saved/deleted confirmation or safe error | — |
| `schools_result` | School management result | school directory, mutation confirmation or safe error | — |
| `roles_result` | Admin assignment result | target email, granted/changed/removed confirmation or safe error | — |
| `attempts_result` | Attempt management result | user/IP observations, cleared row count or safe error | — |
| `signout_result` | Target sign-out confirmation | qualified request confirmation or safe error; not deletion proof | — |
| `listing_read` | Listing query | optional category | — |
| `listing_create` | Listing creation fields | Title, Description, Price, Category, UserId | — |
| `listing_delete` | Listing deletion selector | path listing ID | — |
| `listing_view` | Listing query result | listing fields and joined user email/name or service error | — |
| `listing_created` | Listing creation result | creation confirmation or service error | — |
| `listing_deleted` | Listing deletion result | deleted confirmation, not-found result or service error | — |
| `account_access` | Account access data | operation, app envelope, verified IP, session token if present, login evidence if applicable | — |
| `account_assessment` | Account access assessment | prepared envelope, resolved identity, block/validation result, safe error | — |
| `admin_access` | Admin access data | operation, caller token, target selector, server-owned IP/envelope | — |
| `admin_assessment` | Admin access assessment | fresh caller membership, eligible target context, block/validation result | — |
| `catalog` | Sample catalog data | sample ID, title, category, price, school, condition, art fields | D1 |
| `conversation` | Preview conversation data | App.messages[] strings, current draft / display context | D2 |
| `preview_changes` | Preview text updates | appended message or formatted offer text; browser memory only | D2 |
| `school_rows` | School reference data | id, name, short_name | D3 |
| `user_rows` | Account reference data | id, encrypted email/password, names, school_id, datetime | D4 |
| `new_user` | New account record | normalized/encrypted registration fields, school_id, timestamp | D4 |
| `changed_user` | Profile record changes | selected validated fields, selected user ID | D4 |
| `deleted_user` | Account deletion data | selected user ID | D4 |
| `changed_school` | School record changes | normalized name, short_name | D3 |
| `deleted_school` | School deletion data | name and/or short_name selectors | D3 |
| `admin_rows` | Admin membership data | user_id, level, locked | D5 |
| `token_rows` | Access token data | user_id, token, expiry | D6 |
| `new_token` | User token record | user_id, random token, expiry | D6 |
| `revoked_token` | User token revocation data | selected user ID; all tokens for that user | D6 |
| `admin_changes` | Admin membership changes | selected user_id, level, optional locked or removal selector | D5 |
| `target_revocation` | Target token revocation data | selected eligible target user ID | D6 |
| `user_attempts` | User attempt data | user_id, count, expiry | D7 |
| `ip_registry` | IP identity data | id, encrypted IP, datetime | D8 |
| `ip_links` | User / IP relationship data | user_id, ip_id | D9 |
| `ip_attempts` | IP attempt data | ip_id, count, expiry | D10 |
| `cleared_user_attempts` | User attempt removal data | selected user ID | D7 |
| `cleared_ip_attempts` | IP attempt removal data | selected IP ID | D10 |
| `service_token` | Service token record | service user_id, login-issued token, expiry | D6 |
| `user_attempt_changes` | User attempt updates | new count/expiry or first observation | D7 |
| `ip_identity_changes` | IP identity updates | new encrypted IP and timestamp | D8 |
| `ip_link_changes` | User / IP link updates | selected user_id, selected ip_id | D9 |
| `ip_attempt_changes` | IP attempt updates | new count/expiry or first observation | D10 |
| `blocked_token_removals` | Blocked-user revocation data | user ID at count 10; all tokens removed | D6 |
| `session_rows` | Website session data | opaque ID, backend user token, fixed 12-hour expiry | D11 |
| `session_changes` | Website session updates | new opaque ID → user token + expiry | D11 |
| `session_removals` | Website session removal data | old login ID, matching-token IDs or invalid/expired ID | D11 |
| `settings` | Runtime configuration data | app credential, service identity credentials, auth policies, paths; names only | D13 |
| `service_cache` | Cached service identity data | cached admin token and identity context | D12 |
| `service_cache_changes` | Service cache updates | fresh verified admin token or invalidation | D12 |
| `lock_rows` | Lock metadata records | identity ID, last-use timestamp; lock mechanics omitted | D15 |
| `lock_changes` | Lock metadata updates | identity key and usage timestamp | D15 |
| `expired_tokens` | Token expiry records | token record ID, expiry; expiry predicate applied by process | D6 |
| `expired_users` | User attempt expiry records | attempt record ID, expiry | D7 |
| `expired_ips` | IP attempt expiry records | attempt record ID, expiry | D10 |
| `token_cleanup` | Expired token removal data | expired token IDs / expiry predicate | D6 |
| `user_cleanup` | Expired user-attempt removal data | expired user-attempt IDs / expiry predicate | D7 |
| `ip_cleanup` | Expired IP-attempt removal data | expired IP-attempt IDs / expiry predicate | D10 |
| `lock_cleanup` | Stale lock removal data | identity keys meeting stale-lock predicate | D15 |
| `listing_rows` | Stored listing data | id, title, description, price, category, user_id, datetime | D14 |
| `new_listing` | New listing record | validated SQL parameters, supplied UserId, UTC datetime | D14 |
| `deleted_listing` | Listing deletion data | listing ID | D14 |
| `message_context` | Selected listing context | selectedListingId, sample title; no seller identity | — |
| `offer_context` | Selected offer context | selectedListingId, listed sample price | — |
| `scoped_admin_2` | Scoped user request | caller identity, fresh permission data, operation, exact target selectors and relevant request fields | — |
| `scoped_admin_3` | Scoped school request | caller identity, fresh permission data, operation, exact target selectors and relevant request fields | — |
| `scoped_admin_4` | Scoped assignment request | caller identity, fresh permission data, operation, exact target selectors and relevant request fields | — |
| `scoped_admin_5` | Scoped attempt request | caller identity, fresh permission data, operation, exact target selectors and relevant request fields | — |
| `scoped_admin_6` | Scoped sign-out request | caller identity, fresh permission data, operation, exact target selectors and relevant request fields | — |
| `prepared_access` | Prepared operation data | operation, server-owned IP, selected public fields, caller token | — |
| `forwarding_identity` | Forwarding identity data | service admin token, operation envelope, caller token | — |
| `app_ip_context` | Application / IP assessment | application validity, effective IP identity, selected operation | — |
| `user_context` | Resolved user context | caller level, selected user ID, sudo_id, target eligibility, attempt result | — |
| `ip_rejection` | Application / IP rejection data | safe validation/block response or forwarding-expiry marker | — |
| `registration_accessed` | Assessed registration fields | submitted fields, application/IP assessment | — |
| `normalized_registration` | Normalized registration data | validated email/names/password, resolved school_id or validation errors | — |
| `registration_persistence` | Registration persistence outcome | normalized email, insert success, duplicate-email conflict or error | — |
| `login_identity` | Admitted login identity | matched user ID, credential comparison, block assessment | — |
| `visitor_token` | Visitor token data | selected or newly generated token, user ID, eligibility result | — |
| `profile_session_seed` | Projected profile and token | public profile plus backend token for server-side session storage | — |
| `validated_profile_change` | Validated profile changes | selected user ID, nonblank normalized changes or validation error | — |
| `saved_profile_change` | Profile persistence outcome | write committed flag, normalized email, conflict/validation/service result | — |
| `logout_identity` | Assessed logout identity | selected user/token if valid; idempotent no-session case | — |
| `logout_backend_result` | Backend logout outcome | confirmation including masked token-validation cases; submitted visitor token | — |
| `logout_local_result` | Local logout outcome | cookie expiry data, matching local session IDs, qualified notice | — |
| `target_read` | Selected user read data | permitted directory/profile query, exact selected user ID | — |
| `target_change` | Selected target changes | eligible target ID, profile fields, caller context | — |
| `target_delete` | Selected target deletion | eligible target ID, caller level and authorization result | — |
| `target_saved` | Target profile persistence result | saved flag, normalized identity, readback/validation/error result | — |
| `target_deleted` | Account deletion result | affected row count, target email, error result | — |
| `assignment_fields` | Validated assignment data | to_user, operation, integer level below caller, optional 0/1 locked | — |
| `assignment_change` | Permitted membership changes | selected user_id, operation, requested level/locked, eligibility result | — |
| `attempt_query` | Permitted attempt inquiry | caller level, directory request or validated selectors | — |
| `attempt_selection` | Permitted attempt selection | email XOR ip_addr, resolved identity context | — |
| `attempt_cleared` | Attempt removal outcome | deleted row count, selector type, not-found/error result | — |
| `service_credentials` | Configured service credential data | service email/password, app credential, rejected/missing cache context | — |
| `service_token_candidate` | Service token candidate | login-issued token, selected service user ID, login outcome | — |
| `app_comparison` | Application credential assessment | validity, forwarded-IP eligibility, operation and caller context | — |
| `effective_ip` | Effective IP identity | connection/forwarded IP ID, failed-credential observation | — |
| `ip_window_result` | IP window assessment | count, expiry, blocked status, IP ID, operation context | — |
| `caller_identity` | Resolved caller evidence | operation, caller ID/level, optional token validity or login-match evidence | — |
| `target_admission` | Target scope assessment | selected target ID, caller rank, target rank/locked, validation result | — |
| `user_window_result` | User admission assessment | login-specific attempt count/expiry, token revocation selectors, resolved identity | — |

## Read/write interpretation

An arrow into a store carries inserted/updated record values or deletion-selection data. An arrow out carries retrieved record/reference data. A removal arrow is a noun-phrase representation of record mutation, not a control command. All data movement between stores, entities and retained records is mediated by a process.

Grouped stores G1–G6 preserve logical subjects at Level-0. D1–D15 refine those subjects at lower levels. The balance validator maps each primitive store to its declared group only when that group is the parent boundary endpoint. No new external information is introduced by this expansion.

Dictionary counts on the BALANCE page count directional `(outside endpoint, named package)` tuples, not individual JSON properties or the count of arrows. A package repeated on several operation-specific branches is the same information, selected by its operation discriminator; it is not additional boundary data.
