# Finyo Backend API Docs (Frontend)

Client reference for the **web app** and the **Android app**.

## Base URL

- Local dev: `http://localhost:5000`
- API prefix: `/api`
- Live/`/health` liveness endpoint (no auth): `GET /health`

## Auth Model

Protected endpoints require a valid **Supabase access token** (JWT).

| Client  | Recommended auth method                                             |
|---------|---------------------------------------------------------------------|
| Web     | `authToken` httpOnly cookie (set automatically by `/auth/register` and `/auth/login`), `credentials: 'include'` |
| Android | `Authorization: Bearer <access_token>` header on every request      |

The access token is returned in the `token` field of register/login responses (same JWT that is also set as a cookie for web).

### Token refresh

- `/auth/login` and `/auth/register` also return `refreshToken`.
- Refresh is **Supabase-managed**: clients can call Supabase Auth directly (`supabase.auth.refreshSession({ refresh_token })`) with the project URL + anon key, then store the new access token.
- When the server returns `401`/`403`, refresh and retry once; if refresh fails, redirect to login.

## Common Response Patterns

### Success

- `200 OK` for reads/updates/deletes
- `201 Created` for resource creation

### Errors

Simple errors:

```json
{ "message": "Human-readable error message" }
```

Validation errors (zod) return a structured payload:

```json
{
  "message": "Validation failed",
  "issues": [
    { "code": "invalid_value", "values": ["bank", "cash", "wallet"], "path": ["accountType"], "message": "..." }
  ]
}
```

Common status codes: `400` bad input, `401` missing auth, `403` invalid/expired token, `404` not found, `409` conflict, `422` unprocessable (e.g. unparseable SMS), `500` server/db errors.

---

## Object Shapes

### Transaction

```json
{
  "id": 8,
  "userId": "owner_uuid",
  "from": "from_user_id",
  "to": null,
  "fromUserId": "from_user_id",
  "toUserId": null,
  "secondPartyId": null,
  "amount": 350,
  "type": "expense",
  "transactionType": "expense",
  "direction": "debit",
  "mode": "UPI",
  "source": "sms",
  "category": "Food",
  "notes": null,
  "tags": [],
  "createdAt": "2026-08-08T10:00:00.000Z",
  "updatedAt": "2026-08-08T10:00:00.000Z",
  "date": "2026-08-08T10:00:00.000Z",
  "accountId": "uuid_or_null",
  "merchantId": "uuid_or_null",
  "rawDescription": null,
  "normalizedDescription": null,
  "sourceTransactionId": null,
  "sourceHash": null,
  "classificationStatus": "classified",
  "classificationConfidence": 0.98,
  "metadata": {},
  "transferId": null
}
```

- `type` values: `expense | income | transfer | refund | adjustment`
- `classificationStatus`: `classified | needs_review | ignored`
- Transfers always create **two** transactions (one `debit` leg, one `credit` leg) linked by the same `transferId`.

### Account

```json
{
  "id": "uuid", "userId": "uuid", "name": "HDFC", "institution": "hdfc",
  "accountType": "bank", "currency": "INR",
  "sourceType": "manual", "externalAccountId": null,
  "currentBalance": 25000, "lastBalanceUpdatedAt": "...Z", "isActive": true,
  "createdAt": "...Z", "updatedAt": "...Z"
}
```

`accountType`: `bank | cash | wallet | card | investment | other`. `sourceType`: `manual | sms | notification | aa | api`.

### Category

```json
{ "id": "uuid", "userId": null, "parentId": null, "name": "Food", "slug": "food", "icon": "", "isSystem": true, "createdAt": "...Z", "updatedAt": "...Z" }
```

`userId` is `null` for system categories. `parentId` gives a hierarchy (e.g. Fast Food → Food).

### Merchant

```json
{ "id": "uuid", "canonicalName": "rapido", "displayName": "Rapido", "aliases": ["RAPIDO", "UPI-RAPIDO"], "defaultCategoryId": null, "createdAt": "...Z", "updatedAt": "...Z" }
```

### Bucket

```json
{ "id": "uuid", "userId": "uuid", "name": "Vacation", "type": "savings", "targetAmount": 50000, "isActive": true, "createdAt": "...Z", "updatedAt": "...Z" }
```

`type`: `spending | sinking_fund | reserved | savings | earmarked`.

### Bucket allocation

```json
{ "id": 1, "userId": "uuid", "bucketId": "uuid", "amount": 5000, "allocationType": "funding", "referenceType": null, "referenceId": null, "occurredAt": "...Z", "createdAt": "...Z" }
```

`allocationType`: `funding | spending | release | adjustment | transfer`. Bucket balance is **derived from the ledger** (funding − spending + release + adjustment) — there is no stored balance.

### Budget plan

```json
{ "id": "uuid", "userId": "uuid", "name": "Food budget", "categoryId": null, "category": null, "bucketId": null, "periodType": "monthly", "limitAmount": 8000, "startDate": null, "endDate": null, "rolloverEnabled": false, "isActive": true, "createdAt": "...Z", "updatedAt": "...Z" }
```

`periodType`: `weekly | monthly | quarterly | yearly | custom`. Spend is derived from the transaction ledger, never stored.

### Rule

```json
{ "id": "uuid", "userId": "uuid", "priority": 100, "enabled": true, "matchType": "merchant", "matchOperator": "equals", "matchValue": "swiggy", "actionType": "category", "actionValue": "food", "createdAt": "...Z", "updatedAt": "...Z" }
```

`matchType`: `merchant | description | amount | account | mode`; `matchOperator`: `equals | contains | starts_with | regex`; `actionType`: `category | bucket | ignore`.

### Recurring plan (sinking fund)

```json
{ "id": "uuid", "userId": "uuid", "name": "Mobile Recharge", "amount": 900, "frequency": "quarterly", "nextDueDate": "2026-10-01", "bucketId": "uuid", "autoFundAmount": 300, "fundingFrequency": "monthly", "lastFundingDate": null, "merchantId": null, "isActive": true, "createdAt": "...Z", "updatedAt": "...Z" }
```

`frequency`/`fundingFrequency`: `weekly | monthly | quarterly | yearly`. Auto-funding creates `funding` allocations in the linked bucket on each funding boundary before the due date (e.g. ₹300/mo → ₹900 quarterly = ₹600 funded, ₹300 remaining before due).

---

## Endpoint Reference

### Health

| Method | Path      | Auth | Description |
|--------|-----------|------|-------------|
| GET    | `/health` | no   | `{status, timestamp}` |

### Auth — `/api/auth`

| Method | Path              | Auth | Description |
|--------|-------------------|------|-------------|
| POST   | `/register`       | no   | `{email, password, username?}` → `201` `{token, refreshToken, user}` + sets cookies |
| POST   | `/login`          | no   | `{email, password}` → `200` `{token, refreshToken, user}` + sets cookies |
| GET    | `/oauth/:provider`| no   | `{url}` OAuth redirect URL. `provider`: `google | github | facebook | apple | discord`. Query `redirectTo?` |
| POST   | `/logout`         | no   | Clears auth cookies → `{message}` |
| GET    | `/me`             | yes  | `{user: {id, email, username}}` |

### Accounts — `/api/accounts`

| Method | Path       | Auth | Description |
|--------|------------|------|-------------|
| GET    | `/`        | yes  | List accounts |
| POST   | `/`        | yes  | Create: `{name, institution?, accountType? (bank), currency? (INR), sourceType? (manual), externalAccountId?, currentBalance?}` → `201` |
| GET    | `/:id`     | yes  | Get account |
| PUT    | `/:id`     | yes  | Partial update (any create field) |
| DELETE | `/:id`     | yes  | Delete → `{message}` |

### Categories — `/api/categories`

| Method | Path   | Auth | Description |
|--------|--------|------|-------------|
| GET    | `/`    | yes  | All categories (system + user), hierarchical via `parentId` |
| POST   | `/`    | yes  | Create: `{name, slug?, icon?, parentId?}` |
| PUT    | `/:id` | yes  | Update (name/slug/icon/parentId) |
| DELETE | `/:id` | yes  | Delete |

### Merchants — `/api/merchants`

| Method | Path   | Auth | Description |
|--------|--------|------|-------------|
| GET    | `/`    | yes  | List all merchants |
| POST   | `/`    | yes  | Create: `{canonicalName, displayName, aliases?, defaultCategoryId?}` (`409` if canonical name exists) |
| GET    | `/:id` | yes  | Get |
| PUT    | `/:id` | yes  | Update |
| DELETE | `/:id` | yes  | Delete |

### Transactions — `/api/transactions`

| Method | Path                 | Auth | Description |
|--------|----------------------|------|-------------|
| GET    | `/`                  | yes  | Latest up to 100 transactions (array) |
| GET    | `/transactions`      | yes  | Paginated + filtered. Query: `page` (1), `limit` (10, max 500), `startDate?`, `endDate?` (normalized to end-of-day), `tags?` (comma-separated), `match?` (`any`\|`all`) → `{transactions, pagination}` |
| GET    | `/filter/tags`       | yes  | Tag filter → `{tags, match, transactions}` (limit 500) |
| GET    | `/dashboard`         | yes  | Current-month + 6-month analytics (see below) |
| POST   | `/`                  | yes  | Create (see below) → `201` transaction |
| POST   | `/transfer`          | yes  | Account-to-account transfer (see below) → `201` `{from, to}` |
| GET    | `/:id`               | yes  | Get transaction |
| PUT    | `/:id`               | yes  | Partial update: `amount?, type?, mode?, source?, tags?, category?, notes?, createdAt?, accountId?, merchantId?` |
| DELETE | `/:id`               | yes  | Delete → `{message}` |

**Create body** (only `amount` + `type` are required):

```json
{
  "amount": 450,
  "type": "expense",
  "direction": "debit",
  "mode": "UPI",
  "source": "manual",
  "tags": ["lunch"],
  "category": "Food",
  "categoryId": "uuid",
  "bucketId": "uuid",
  "merchantId": "uuid",
  "accountId": "uuid",
  "secondPartyId": "counterparty",
  "notes": "Team lunch",
  "createdAt": "2026-08-08T09:00:00.000Z",
  "rawDescription": "UPI/DR/.../SWIGGY",
  "metadata": {}
}
```

- Classification (category/bucket) is automatic when `categoryId`/`bucketId` are omitted — rules + merchant defaults apply.

**Transfer body:**

```json
{ "fromAccountId": "uuid", "toAccountId": "uuid", "amount": 2000, "occurredAt": "...Z", "notes": "...", "source": "manual" }
```

- `fromAccountId` and `toAccountId` must differ. Creates two transactions (`type: transfer`, one debit + one credit). Transfers never count as income/expense.

**Dashboard payload** (`GET /dashboard`):

```json
{
  "totalSpent": 800, "totalIncome": 50000, "netAmount": 49200, "savingsRate": 98.4,
  "topCategory": "Food", "topExpenseCategory": "Food", "topIncomeCategory": "",
  "categoryData": {}, "expenseCategoryData": { "Food": 450 }, "incomeCategoryData": {},
  "topPaymentMethods": ["UPI"], "paymentMethodData": { "UPI": 3 },
  "monthlyData": [ { "month": "Aug 2026", "amount": 0, "expenses": 800, "income": 50000, "net": 49200 } ],
  "totalTransactions": 8, "expenseCount": 4, "incomeCount": 1, "avgExpense": 200, "avgIncome": 50000
}
```

### Buckets — `/api/buckets`

| Method | Path                   | Auth | Description |
|--------|------------------------|------|-------------|
| GET    | `/`                    | yes  | List buckets |
| POST   | `/`                    | yes  | Create: `{name, type? (spending), targetAmount?}` |
| GET    | `/:id`                 | yes  | Get bucket |
| PUT    | `/:id`                 | yes  | Update: `name?, type?, targetAmount?, isActive?` |
| DELETE | `/:id`                 | yes  | Delete |
| GET    | `/:id/balance`         | yes  | Derived balance `{bucketId, balance}` |
| GET    | `/:id/allocations`     | yes  | Ledger entries for the bucket |
| POST   | `/:id/allocations`     | yes  | Add allocation: `{amount, allocationType, referenceType?, referenceId?, occurredAt?}` |

### Budgets — `/api/budgets`

| Method | Path       | Auth | Description |
|--------|------------|------|-------------|
| GET    | `/`        | yes  | Legacy monthly category budgets (list) |
| POST   | `/`        | yes  | Legacy upsert: `{category, limitAmount}` for current month |
| GET    | `/alerts`  | yes  | Plans ≥80% spent → `{category, percentage, spent, limit, severity: "medium"|"high"}` |
| GET    | `/summary` | yes  | `{id, name, category, categoryId, bucketId, limit, spent, remaining, percentage}` per plan |
| POST   | `/plans`   | yes  | Create plan: `{name, categoryId?, bucketId?, periodType? (monthly), limitAmount, startDate?, endDate?, rolloverEnabled?}` |
| GET    | `/:id`     | yes  | Get plan |
| PUT    | `/:id`     | yes  | Update plan (+`isActive?`) |
| DELETE | `/:id`     | yes  | Delete plan |

### Rules — `/api/rules`

| Method | Path          | Auth | Description |
|--------|---------------|------|-------------|
| GET    | `/`           | yes  | User's rules |
| POST   | `/`           | yes  | Create: `{priority? (100), enabled? (true), matchType, matchOperator, matchValue, actionType, actionValue?}` |
| GET    | `/:id`        | yes  | Get rule |
| PUT    | `/:id`        | yes  | Update |
| DELETE | `/:id`        | yes  | Delete |
| POST   | `/:id/test`   | yes  | Dry-run match: body `{merchantName?, description?, amount?, accountId?, mode?}` → `{matches: boolean}` |

### Recurring plans (sinking funds) — `/api/recurring`

| Method | Path           | Auth | Description |
|--------|----------------|------|-------------|
| GET    | `/`            | yes  | List plans |
| POST   | `/`            | yes  | Create: `{name, amount, frequency, nextDueDate (YYYY-MM-DD), bucketId?, autoFundAmount?, fundingFrequency?, merchantId?}` |
| POST   | `/auto-fund`   | yes  | Run funding: creates `funding` allocations for all due boundaries → `{funded: n}` (idempotent) |
| GET    | `/upcoming`    | yes  | `[{name, amount, dueDate, funded, remainingFunding}]` |
| GET    | `/:id`         | yes  | Get plan |
| PUT    | `/:id`         | yes  | Update (all fields optional, `bucketId`/`fundingFrequency`/`merchantId` accept `null`, +`isActive?`) |
| DELETE | `/:id`         | yes  | Delete |

### Classification (user corrections) — `/api/classification`

| Method | Path                  | Auth | Description |
|--------|-----------------------|------|-------------|
| PATCH  | `/:transactionId`     | yes  | Correct classification: `{categoryId?, bucketId?, applyToFuture?}` → `{transaction}` (with `rule` if `applyToFuture` created one) |
| POST   | `/:transactionId/rule`| yes  | Create a persistent rule from a transaction: `{categoryId, bucketId?}` → `201` rule |

`applyToFuture` creates `merchant equals <canonical_name>` if the transaction has a merchant, otherwise `description contains <normalized_description>`, actioning the category/bucket.

### Financial state — `/api/financial`

| Method | Path              | Auth | Description |
|--------|-------------------|------|-------------|
| GET    | `/safe-to-spend`  | yes  | `{safeToSpend, currency, components: {availableCash, reservedMoney, earmarkedMoney, upcomingRequiredExpenses, protectedSavings}}` |
| GET    | `/daily-allowance`| yes  | `{overall, categories: {<plan name>: amount}}` |
| GET    | `/upcoming`       | yes  | Same as `/api/recurring/upcoming` |

`safeToSpend = availableCash − reservedMoney − earmarkedMoney − upcomingRequiredExpenses − protectedSavings` (deterministic, derived from the ledger).

### Ingestion — `/api/ingestion`

| Method | Path     | Auth | Description |
|--------|----------|------|-------------|
| POST   | `/events`| yes  | Ingest a raw event (see below) → `201` |
| GET    | `/status`| yes  | `{counts: {received, processed, duplicate, failed}, events: [...]}` (latest 50) |

**POST `/events` body:**

```json
{
  "source": "sms",
  "accountId": "uuid",
  "rawText": "Rs 147 debited from A/c XX1234 via UPI-RAPIDO",
  "occurredAt": "2026-08-08T12:30:00Z",
  "externalEventId": "optional_provider_event_id"
}
```

`source`: `sms | notification | email | csv | manual | aa`. Responses:

- `{"status": "processed", "eventId": 1, "transaction": {...}}` — transaction created (and classified)
- `{"status": "duplicate", "eventId": 1, "transactionId": 8}` — same event or same transaction already seen
- `422` `{"message": "Unable to parse SMS: ..."}` for unparseable `rawText`

Deduplication is automatic (SHA-256 fingerprint; unique per user).

---

## Frontend / Android Integration Notes

### Web app
- Send `credentials: 'include'` so the `authToken` cookie is attached; CORS is restricted to `FRONTEND_URL` (`http://localhost:3000` in dev).
- After login/register the server sets `authToken`, `refreshToken`, `isLoggedIn` cookies. `isLoggedIn` is non-httpOnly — use it to flip UI state.
- A `401`/`403` means the token expired: refresh via Supabase Auth and retry.

### Android app
- Stack suggestion: Kotlin + Retrofit/OkHttp + `kotlinx.serialization` (or Moshi). Add an OkHttp `Interceptor` that attaches `Authorization: Bearer <token>` and handles 401-refresh-once-and-retry.
- Store tokens in EncryptedSharedPreferences / Android Keystore. Do **not** log tokens.
- Parse `issues` in validation errors to show inline field errors.
- Core screens → endpoints:
  - Home/safe-to-spend → `GET /api/financial/safe-to-spend`, `GET /api/financial/daily-allowance`
  - Transactions → `GET /api/transactions/transactions` (paged), `POST /api/transactions`, `POST /api/transactions/transfer`
  - Buckets → `/api/buckets` + `POST /api/buckets/:id/allocations`
  - Recurring/sinking funds → `/api/recurring` + `POST /api/recurring/auto-fund` (or a future background worker)
  - Rules → `/api/rules`, corrections → `PATCH /api/classification/:transactionId`
  - SMS forwarding (background): forward notification text to `POST /api/ingestion/events` with `source: "sms"` + the user's account id; the server dedupes.
- Numbers (amounts, balances) come back as JSON numbers — use `Double`/`BigDecimal` and format with `₹`.

### General
- Always handle `message` in non-2xx responses.
- Use `createdAt`/`date` from the server as the canonical transaction date.
- `categoryId`/`bucketId` (uuid) are preferred over legacy `category` string for new writes; the legacy string is auto-set from the category hierarchy.
