# Finyo (PocketPortrait) — Server Documentation

Backend service for a personal finance tracking application ("Pocket Portrait"). It provides Supabase-backed auth, account & merchant management, transaction ingestion (SMS parsing) with automatic classification, ledger-derived buckets (envelopes), budget plans, recurring sinking funds, deterministic safe-to-spend, and dashboard analytics.

- **Repo**: `finyo-server` (package name: `backend`)
- **Language**: TypeScript
- **Runtime**: Bun (also runnable with Node 20+ for scripts/tests)

---

## 1. Features

### Authentication & User Management

- Email/password registration and login (delegated to Supabase Auth)
- OAuth login redirect URLs for `google`, `github`, `facebook`, `apple`, `discord`
- JWT session handling via Supabase (access + refresh tokens)
- Token delivery both ways:
  - `Authorization: Bearer <token>` header (mobile)
  - `authToken` / `refreshToken` cookies (httpOnly, `sameSite` + `secure` per environment)
- `isLoggedIn` non-httpOnly cookie for frontend UI state
- Profile upsert into the `profiles` table on register/login
- `GET /api/auth/me` to fetch the authenticated user's profile

### Accounts & Merchants

- User-owned financial accounts (bank, cash, wallet, card, …) with optional current balance
- Merchant registry with canonical name + aliases; aliases used for SMS merchant resolution
- System categories (seeded, `user_id IS NULL`) + user categories, hierarchical via `parentId`

### Transaction Ingestion (SMS)

- `POST /api/ingestion/events` accepts raw bank SMS/notification text (`source: "sms" | "notification" | ...`)
- Format-specific parsers: `bank-sms`, `upi-ga`, `bank-notification`, `fallback` (pickup: `Rs/NRs X debited/credited`, `X spent`, `credited by` etc.)
- Deterministic dedupe: SHA-256 event fingerprint (`externalEventId + rawText`) and transaction fingerprint (`amount + direction + occurredAt + description`); duplicates return `{status: "duplicate"}`
- Events are stored first (`ingestion_events`) and published on an in-process event bus; transactions are created and **auto-classified** asynchronously

### Classification & Rules

- Automatic classification: transaction rules → merchant default category → category hierarchy (leaf-first) → `needs_review`
- User rules: match on `merchant | description | amount | account | mode` (operators `equals | contains | starts_with | regex`), action `category | bucket | ignore`; rules are compiled to regexes and prefiltered for performance
- Classification corrections: `PATCH /api/classification/:transactionId` with `applyToFuture` which can materialize a rule

### Ledger & Buckets (Envelope Budgeting)

- `bucket_allocations` is the **source of truth ledger** (funding / spending / release / adjustment / transfer)
- Bucket balances are **derived** from the ledger (never stored) — `GET /api/buckets/:id/balance`
- Bucket types: `spending | sinking_fund | reserved | savings | earmarked`
- Spending `allocationType` requires a linked transaction (enforced by FK)

### Budgets

- Flexible **budget plans** (`budget_plans`): category- or bucket-scoped, `weekly | monthly | quarterly | yearly | custom` period, optional rollover
- Spend is derived from the transaction ledger per period (never stored)
- Alerts: plans ≥80% spent → `medium`, at/over limit → `high`
- Legacy per-category-per-month budgets (`budgets` table) still supported via `POST /api/budgets` (kept for the old web UI)

### Recurring Plans (Sinking Funds)

- `recurring_plans`: upcoming obligations (e.g. "Mobile Recharge ₹900 quarterly") with optional auto-funding into a bucket
- `POST /api/recurring/auto-fund` is **idempotent** — creates `funding` allocations for every funding boundary elapsed since `lastFundingDate`

### Safe-to-Spend

- Deterministic: `safeToSpend = availableCash − reservedMoney − earmarkedMoney − upcomingRequiredExpenses − protectedSavings`
- `GET /api/financial/safe-to-spend` returns the value + component breakdown
- Daily allowance splits remaining allowance across active budget plans (`GET /api/financial/daily-allowance`)

### Dashboard & Analytics

- Current-month summary: total spent/income, net, savings rate; category, payment-method and 6-month trend breakdowns
- Computed on-the-fly from transactions (no materialized aggregation)

### Platform / Ops

- `/health` liveness endpoint
- Auto table creation on startup (idempotent DDL, no external migration tool)
- Graceful shutdown of the DB pool on `SIGINT` / `SIGTERM`
- Dockerized multi-stage build + `docker-compose`
- CORS restricted to `FRONTEND_URL`
- Unit tests for the pure-domain logic (run with `bun test`)

---

## 2. Tech Stack

| Layer      | Technology                              |
| ---------- | --------------------------------------- |
| Language   | TypeScript (Bun-compatible, no emit)    |
| Runtime    | Bun ≥1.0.0                              |
| Framework  | Express 5                               |
| Database   | PostgreSQL (via Supabase)               |
| DB driver  | `pg` (node-postgres, `Pool` with SSL)   |
| Validation | `zod` (request bodies, env config)      |
| Auth       | Supabase Auth (`@supabase/supabase-js`) |
| Middleware | `cors`, `cookie-parser`, `dotenv`       |
| Testing    | Bun's built-in test runner (`bun test`) |
| Container  | Docker (oven/bun:1), docker-compose     |

### Scripts (`package.json`)

```bash
bun install             # install deps (use bun, engine is >=1.0.0)
bun run dev             # bun --watch src/server.ts (hot reload)
bun run build           # bun build src/server.ts --outdir dist --target bun
bun start               # bun src/server.ts (production)
bun run type-check      # bun x tsc --noEmit
bun test                # unit tests in tests/
```

Tests live in `tests/` and cover the pure logic: SMS parsing, dedupe fingerprints, rule matching, safe-to-spend math, bucket balance derivation, recurring auto-funding.

---

## 3. Architecture & Project Structure

```
finyo-server/
├── src/
│   ├── server.ts           # process bootstrap: env, pool, migrate, listen, graceful shutdown
│   ├── app.ts              # Express app: middleware, CORS, route mounting, error handler
│   ├── config/
│   │   └── env.ts          # zod-validated env (PORT, SUPABASE_*, DB_URL, COOKIE_*, ...)
│   ├── core/
│   │   ├── eventBus.ts     # in-process pub/sub (transactionReceived, eventProcessed, ...)
│   │   ├── fingerprint.ts  # deterministic SHA-256 event/transaction fingerprints
│   │   ├── SafeToSpendCalculator.ts   # pure safe-to-spend math
│   │   ├── DailyAllowanceCalculator.ts
│   │   ├── PaymentMethodParser.ts     # maps raw SMS payment text -> canonical mode
│   │   └── ingest/
│   │       └── adapters.ts # SMS/notification parsers: bank-sms, upi-ga, notification, fallback
│   ├── db/
│   │   ├── pool.ts         # pg Pool (SSL) + transaction helper
│   │   ├── Migrations.ts   # all CREATE TABLE IF NOT EXISTS DDL (12 tables + indexes)
│   │   └── MigrationRunner.ts
│   ├── domain/             # domain models (Transaction, Bucket, BudgetPlan, Rule,
│   │   │                   # RecurringPlan, Category, Merchant, Account, IngestionEvent)
│   │   └── ...             # each with typed constructors + toApi() serialization
│   ├── repositories/       # data access per aggregate (transactions, buckets, rules, ...)
│   ├── services/           # business logic
│   │   ├── AuthService.ts, TransactionService.ts, BudgetService.ts,
│   │   ├── BucketService.ts, RuleService.ts, RecurringService.ts,
│   │   ├── ClassificationService.ts, MerchantService.ts, CategoryService.ts,
│   │   ├── FinancialStateService.ts, IngestionService.ts, DashboardService.ts
│   ├── controllers/        # thin HTTP layer: validate (zod) -> service -> res (toApi)
│   ├── routes/             # Express routers: auth, accounts, categories, merchants,
│   │   │                   # transactions, buckets, budgets, rules, recurring,
│   │   │                   # classification, financial, ingestion
│   ├── middleware/
│   │   └── auth.ts         # authenticateToken (cookie or Bearer -> Supabase getUser)
│   └── types.ts            # shared types (AuthRequest, DashboardStats, enums, ...)
├── tests/                  # bun test unit tests
├── Dockerfile              # multi-stage: bun deps -> build -> production
├── docker-compose.yaml     # app service, port 5000, env_file .env
├── tsconfig.json
└── package.json
```

### Request flow

```
Client -> Express (CORS, cookie-parser, json parser)
        -> /api/* (routes) -> authenticateToken (all but auth-public + health)
        -> verify JWT against Supabase Auth (authSupabase.auth.getUser)
        -> controller (zod validate) -> service (business logic)
        -> repository -> pg Pool -> Supabase PostgreSQL
```

### Layering rules

- Controllers never touch SQL; repositories never know about HTTP.
- All services throw `AppError` (`badRequest`, `notFound`, `conflict`, …) — the global error handler maps it to `{message, issues?}` with the right status code.
- Ledger-derived values (bucket balance, budget spend, safe-to-spend) are computed, never cached columns.

---

## 4. Where the Database Is

- **Host**: Supabase-hosted PostgreSQL (cloud). There is **no local/embedded database**.
- **Connection**: `SUPABASE_DB_URL` (the "Pooler URI" from Supabase Project Settings → Database → Connection string), `pg.Pool` with `ssl: { rejectUnauthorized: false }`, tunable `PG_POOL_MAX` / `PG_IDLE_TIMEOUT_MS`.
- **Schema initialization**: on startup `MigrationRunner` runs all DDL in `src/db/Migrations.ts` (`CREATE TABLE IF NOT EXISTS` + indexes) in order. No migration files are applied on top — schema changes are edited in `Migrations.ts`.

### Env vars for DB/Auth

```
SUPABASE_URL=...                # required
SUPABASE_SERVICE_ROLE_KEY=...   # required (admin client)
SUPABASE_ANON_KEY=...           # optional, falls back to service key (public auth client)
SUPABASE_DB_URL=...             # required (Postgres connection string)
```

Two Supabase clients are created:

- `supabase` — service-role client
- `authSupabase` — anon-key client, used for `auth.getUser` / `signUp` / `signInWithPassword` / `signInWithOAuth`

---

## 5. Database Schema

All tables auto-created in `src/db/Migrations.ts`. Naming is **snake_case** in SQL, camelCase in the API.

### `profiles`

User profile data mirrored from Supabase auth.

| Column       | Type      | Constraints      |
| ------------ | --------- | ---------------- |
| `id`         | TEXT      | PRIMARY KEY      |
| `email`      | TEXT      | UNIQUE, NOT NULL |
| `username`   | TEXT      |                  |
| `created_at` | TIMESTAMP | DEFAULT now()    |
| `updated_at` | TIMESTAMP | DEFAULT now()    |

### `transactions`

Financial transaction records.

| Column                                       | Type             | Constraints                                                              |
| -------------------------------------------- | ---------------- | ------------------------------------------------------------------------ |
| `id`                                         | BIGSERIAL        | PRIMARY KEY                                                              |
| `owner_user_id`                              | TEXT             | NOT NULL                                                                 |
| `from_user_id` / `to_user_id`                | TEXT             | nullable                                                                 |
| `second_party_id`                            | TEXT             | nullable (counterparty)                                                  |
| `amount`                                     | DECIMAL(12,2)    | NOT NULL, CHECK `amount >= 0`                                            |
| `transaction_type`                           | TEXT             | NOT NULL, CHECK in (`expense`,`income`,`transfer`,`refund`,`adjustment`) |
| `direction`                                  | TEXT             | NOT NULL, CHECK in (`debit`,`credit`)                                    |
| `mode`                                       | TEXT             | NOT NULL (UPI, Card, Cash, …)                                            |
| `source`                                     | TEXT             | NOT NULL (`manual`, `sms`, `notification`, …)                            |
| `tags`                                       | TEXT[]           | NOT NULL, DEFAULT `{}`                                                   |
| `category`                                   | TEXT             | nullable (denormalized category name)                                    |
| `category_id`                                | UUID             | nullable (FK `categories`)                                               |
| `bucket_id`                                  | UUID             | nullable (FK `buckets`)                                                  |
| `account_id`                                 | UUID             | nullable (FK `financial_accounts`)                                       |
| `merchant_id`                                | UUID             | nullable (FK `merchants`)                                                |
| `notes`                                      | TEXT             | nullable                                                                 |
| `raw_description` / `normalized_description` | TEXT             | nullable (SMS text / cleaned)                                            |
| `source_transaction_id` / `source_hash`      | BIGINT / TEXT    | nullable (dedupe)                                                        |
| `classification_status`                      | TEXT             | CHECK in (`classified`,`needs_review`,`ignored`)                         |
| `classification_confidence`                  | DOUBLE PRECISION | nullable                                                                 |
| `metadata`                                   | JSONB            | nullable                                                                 |
| `transfer_id`                                | BIGINT           | nullable (links transfer legs)                                           |
| `created_at` / `updated_at`                  | TIMESTAMP        | NOT NULL, DEFAULT now()                                                  |

Indexes: `owner_user_id`, `created_at DESC`, GIN `tags`, `(owner, transfer_id)`, `(owner, account_id, date)`.

### `budgets`

**Legacy** per-category-per-month budgets (kept for the old web UI; new budget plans live in `budget_plans`).

| Column          | Type          | Constraints                       |
| --------------- | ------------- | --------------------------------- |
| `id`            | BIGSERIAL     | PRIMARY KEY                       |
| `user_id`       | TEXT          | NOT NULL                          |
| `category`      | TEXT          | NOT NULL                          |
| `limit_amount`  | DECIMAL(12,2) | NOT NULL, CHECK `>= 0`            |
| `current_spent` | DECIMAL(12,2) | NOT NULL, DEFAULT 0, CHECK `>= 0` |
| `month`         | TEXT          | NOT NULL (e.g. `"2026-05"`)       |
| `year`          | INTEGER       | NOT NULL                          |
| `created_at`    | TIMESTAMP     | DEFAULT now()                     |
| `updated_at`    | TIMESTAMP     | DEFAULT now()                     |

Unique: `UNIQUE(user_id, category, month)`.

### `monthly_reports`, `user_summaries`

Reserved aggregation tables (not written by any route).

### `financial_accounts`

| Column                      | Type          | Constraints                                                                    |
| --------------------------- | ------------- | ------------------------------------------------------------------------------ |
| `id`                        | UUID          | PRIMARY KEY (gen_random_uuid)                                                  |
| `user_id`                   | TEXT          | NOT NULL                                                                       |
| `name`                      | TEXT          | NOT NULL                                                                       |
| `institution`               | TEXT          | nullable                                                                       |
| `account_type`              | TEXT          | NOT NULL, CHECK in (`bank`,`cash`,`wallet`,`card`,`investment`,`other`)        |
| `currency`                  | TEXT          | NOT NULL DEFAULT `INR`                                                         |
| `source_type`               | TEXT          | NOT NULL DEFAULT `manual`, CHECK in (`manual`,`sms`,`notification`,`aa`,`api`) |
| `external_account_id`       | TEXT          | nullable                                                                       |
| `current_balance`           | DECIMAL(12,2) | DEFAULT 0                                                                      |
| `last_balance_updated_at`   | TIMESTAMP     | nullable                                                                       |
| `is_active`                 | BOOLEAN       | NOT NULL DEFAULT true                                                          |
| `created_at` / `updated_at` | TIMESTAMP     | NOT NULL                                                                       |

### `categories`

System + user categories. System rows have `user_id IS NULL` and `is_system = true`.

| Column                      | Type      | Constraints              |
| --------------------------- | --------- | ------------------------ |
| `id`                        | UUID      | PRIMARY KEY              |
| `user_id`                   | TEXT      | nullable (NULL = system) |
| `parent_id`                 | UUID      | nullable (self-FK)       |
| `name`                      | TEXT      | NOT NULL                 |
| `slug`                      | TEXT      | NOT NULL, UNIQUE         |
| `icon`                      | TEXT      | nullable                 |
| `is_system`                 | BOOLEAN   | NOT NULL DEFAULT false   |
| `created_at` / `updated_at` | TIMESTAMP | NOT NULL                 |

### `merchants`

Canonical merchant + aliases (used for SMS resolution).

| Column                      | Type      | Constraints                |
| --------------------------- | --------- | -------------------------- |
| `id`                        | UUID      | PRIMARY KEY                |
| `canonical_name`            | TEXT      | NOT NULL, UNIQUE           |
| `display_name`              | TEXT      | nullable                   |
| `aliases`                   | TEXT[]    | DEFAULT `{}`               |
| `default_category_id`       | UUID      | nullable (FK `categories`) |
| `created_at` / `updated_at` | TIMESTAMP | NOT NULL                   |

### `buckets`

Envelope/sinking-fund buckets.

| Column                      | Type          | Constraints                                                                     |
| --------------------------- | ------------- | ------------------------------------------------------------------------------- |
| `id`                        | UUID          | PRIMARY KEY                                                                     |
| `user_id`                   | TEXT          | NOT NULL                                                                        |
| `name`                      | TEXT          | NOT NULL                                                                        |
| `type`                      | TEXT          | NOT NULL, CHECK in (`spending`,`sinking_fund`,`reserved`,`savings`,`earmarked`) |
| `target_amount`             | DECIMAL(12,2) | nullable                                                                        |
| `is_active`                 | BOOLEAN       | NOT NULL DEFAULT true                                                           |
| `created_at` / `updated_at` | TIMESTAMP     | NOT NULL                                                                        |

### `bucket_allocations`

**Ledger** for buckets — balance is derived, never stored.

| Column            | Type          | Constraints                                                                 |
| ----------------- | ------------- | --------------------------------------------------------------------------- |
| `id`              | BIGSERIAL     | PRIMARY KEY                                                                 |
| `user_id`         | TEXT          | NOT NULL                                                                    |
| `bucket_id`       | UUID          | NOT NULL, FK `buckets`                                                      |
| `amount`          | DECIMAL(12,2) | NOT NULL, CHECK `>= 0`                                                      |
| `allocation_type` | TEXT          | NOT NULL, CHECK in (`funding`,`spending`,`release`,`adjustment`,`transfer`) |
| `reference_type`  | TEXT          | nullable (`transaction`, `recurring_plan`, …)                               |
| `reference_id`    | BIGINT        | nullable (FK `transactions` when `reference_type='transaction'`)            |
| `occurred_at`     | TIMESTAMP     | NOT NULL                                                                    |
| `created_at`      | TIMESTAMP     | NOT NULL DEFAULT now()                                                      |

Balance formula: `SUM(±amount)` where only `spending` allocations count as negative (`signFor` in `src/services/BucketBalanceCalculator.ts`), all others positive.

### `budget_plans`

| Column                      | Type          | Constraints                                                                             |
| --------------------------- | ------------- | --------------------------------------------------------------------------------------- |
| `id`                        | UUID          | PRIMARY KEY                                                                             |
| `user_id`                   | TEXT          | NOT NULL                                                                                |
| `name`                      | TEXT          | NOT NULL                                                                                |
| `category_id`               | UUID          | nullable (FK `categories`)                                                              |
| `bucket_id`                 | UUID          | nullable (FK `buckets`)                                                                 |
| `period_type`               | TEXT          | NOT NULL DEFAULT `monthly`, CHECK in (`weekly`,`monthly`,`quarterly`,`yearly`,`custom`) |
| `limit_amount`              | DECIMAL(12,2) | NOT NULL, CHECK `> 0`                                                                   |
| `start_date` / `end_date`   | DATE          | nullable (for `custom`)                                                                 |
| `rollover_enabled`          | BOOLEAN       | NOT NULL DEFAULT false                                                                  |
| `is_active`                 | BOOLEAN       | NOT NULL DEFAULT true                                                                   |
| `created_at` / `updated_at` | TIMESTAMP     | NOT NULL                                                                                |

### `transaction_rules`

| Column                      | Type      | Constraints                                                             |
| --------------------------- | --------- | ----------------------------------------------------------------------- |
| `id`                        | UUID      | PRIMARY KEY                                                             |
| `user_id`                   | TEXT      | NOT NULL                                                                |
| `priority`                  | INTEGER   | NOT NULL DEFAULT 100                                                    |
| `enabled`                   | BOOLEAN   | NOT NULL DEFAULT true                                                   |
| `match_type`                | TEXT      | NOT NULL, CHECK in (`merchant`,`description`,`amount`,`account`,`mode`) |
| `match_operator`            | TEXT      | NOT NULL, CHECK in (`equals`,`contains`,`starts_with`,`regex`)          |
| `match_value`               | TEXT      | NOT NULL                                                                |
| `action_type`               | TEXT      | NOT NULL, CHECK in (`category`,`bucket`,`ignore`)                       |
| `action_value`              | TEXT      | nullable                                                                |
| `created_at` / `updated_at` | TIMESTAMP | NOT NULL                                                                |

### `classification_decisions`

Log of classification outcomes (used to avoid re-classifying the same transaction).

| Column                      | Type      | Constraints                                          |
| --------------------------- | --------- | ---------------------------------------------------- |
| `id`                        | BIGSERIAL | PRIMARY KEY                                          |
| `user_id`                   | TEXT      | NOT NULL                                             |
| `transaction_id`            | BIGINT    | NOT NULL, FK `transactions`, UNIQUE                  |
| `category_id` / `bucket_id` | UUID      | nullable                                             |
| `method`                    | TEXT      | NOT NULL (`rule`\|`merchant`\|`hierarchy`\|`manual`) |
| `rule_id`                   | UUID      | nullable (FK `transaction_rules`)                    |
| `created_at`                | TIMESTAMP | NOT NULL DEFAULT now()                               |

### `ingestion_events`

Raw ingested events (SMS etc.) with processing status.

| Column              | Type      | Constraints                                                                         |
| ------------------- | --------- | ----------------------------------------------------------------------------------- |
| `id`                | BIGSERIAL | PRIMARY KEY                                                                         |
| `user_id`           | TEXT      | NOT NULL                                                                            |
| `account_id`        | UUID      | nullable (FK `financial_accounts`)                                                  |
| `source`            | TEXT      | NOT NULL                                                                            |
| `external_event_id` | TEXT      | nullable                                                                            |
| `source_hash`       | TEXT      | NOT NULL, UNIQUE(user, hash)                                                        |
| `raw_payload`       | JSONB     | nullable                                                                            |
| `status`            | TEXT      | NOT NULL DEFAULT `received`, CHECK in (`received`,`processed`,`duplicate`,`failed`) |
| `error`             | TEXT      | nullable                                                                            |
| `created_at`        | TIMESTAMP | NOT NULL DEFAULT now()                                                              |

### `recurring_plans`

| Column                      | Type          | Constraints                                                  |
| --------------------------- | ------------- | ------------------------------------------------------------ |
| `id`                        | UUID          | PRIMARY KEY                                                  |
| `user_id`                   | TEXT          | NOT NULL                                                     |
| `name`                      | TEXT          | NOT NULL                                                     |
| `amount`                    | DECIMAL(12,2) | NOT NULL, CHECK `> 0`                                        |
| `frequency`                 | TEXT          | NOT NULL, CHECK in (`weekly`,`monthly`,`quarterly`,`yearly`) |
| `next_due_date`             | DATE          | NOT NULL                                                     |
| `bucket_id`                 | UUID          | nullable (FK `buckets`)                                      |
| `auto_fund_amount`          | DECIMAL(12,2) | nullable, CHECK `> 0`                                        |
| `funding_frequency`         | TEXT          | nullable, CHECK in (`weekly`,`monthly`,`quarterly`,`yearly`) |
| `last_funding_date`         | DATE          | nullable                                                     |
| `merchant_id`               | UUID          | nullable (FK `merchants`)                                    |
| `is_active`                 | BOOLEAN       | NOT NULL DEFAULT true                                        |
| `created_at` / `updated_at` | TIMESTAMP     | NOT NULL                                                     |

---

## 6. API Structure

- **Base URL (local)**: `http://localhost:5000` (port from `PORT`, default 5000)
- **API prefix**: `/api`
- Auth: all `/api/*` routes except `/health`, `/api/auth/*` (public subset) require a valid Supabase access token (cookie `authToken` **or** `Authorization: Bearer <token>`).
- Success codes: `200` (reads/updates/deletes), `201` (creates). Errors: `400` bad input, `401` missing token, `403` invalid token, `404` not found, `409` conflict, `422` unprocessable (unparseable SMS), `500` server/DB error. Errors return `{ "message": "..." }`; zod validation failures return `{ message: "Validation failed", issues: [...] }`.

| Area           | Route prefix          | Highlights                                                                      |
| -------------- | --------------------- | ------------------------------------------------------------------------------- |
| Health         | `GET /health`         | liveness `{status, timestamp}`                                                  |
| Auth           | `/api/auth`           | `register`, `login`, `oauth/:provider`, `logout`, `me`                          |
| Accounts       | `/api/accounts`       | CRUD                                                                            |
| Categories     | `/api/categories`     | CRUD (system + user, hierarchical)                                              |
| Merchants      | `/api/merchants`      | CRUD (canonical name unique)                                                    |
| Transactions   | `/api/transactions`   | list (latest 100), paged+filters, tag filter, dashboard, create, transfer, CRUD |
| Buckets        | `/api/buckets`        | CRUD, `:id/balance`, `:id/allocations` GET/POST                                 |
| Budgets        | `/api/budgets`        | legacy upsert+list, `alerts`, `summary`, `/plans` CRUD                          |
| Rules          | `/api/rules`          | CRUD, `:id/test` dry-run                                                        |
| Recurring      | `/api/recurring`      | CRUD, `auto-fund`, `upcoming`                                                   |
| Classification | `/api/classification` | `PATCH :id`, `POST :id/rule`                                                    |
| Financial      | `/api/financial`      | `safe-to-spend`, `daily-allowance`, `upcoming`                                  |
| Ingestion      | `/api/ingestion`      | `POST events`, `GET status`                                                     |

> **Full endpoint reference** (paths, bodies, response shapes) lives in **[FRONTEND_API_DOCS.md](FRONTEND_API_DOCS.md)** — the single source of truth for the web and Android clients.

---

## 7. Domain Vocabulary

| Concept           | Values / Notes                                                         |
| ----------------- | ---------------------------------------------------------------------- |
| Transaction type  | `expense`, `income`, `transfer`, `refund`, `adjustment`                |
| Direction         | `debit`, `credit`                                                      |
| Classification    | `classified`, `needs_review`, `ignored` (with confidence)              |
| Account type      | `bank`, `cash`, `wallet`, `card`, `investment`, `other`                |
| Bucket type       | `spending`, `sinking_fund`, `reserved`, `savings`, `earmarked`         |
| Allocation type   | `funding`, `spending`, `release`, `adjustment`, `transfer`             |
| Budget period     | `weekly`, `monthly`, `quarterly`, `yearly`, `custom`                   |
| Rule match types  | `merchant`, `description`, `amount`, `account`, `mode`                 |
| Rule operators    | `equals`, `contains`, `starts_with`, `regex`                           |
| Rule actions      | `category`, `bucket`, `ignore`                                         |
| Ingestion sources | `sms`, `notification`, `email`, `csv`, `manual`, `aa`                  |
| Payment modes     | Free-form; canonicalized by `PaymentMethodParser` (UPI, Card, Cash, …) |

---

## 8. Updating the Web App

The existing web frontend consumes the **legacy** API surface. These still work unchanged:

- `/api/auth/*`, `/api/transactions` (list/create/update/delete, tags, dashboard), `/api/budgets` (legacy `POST {category, limitAmount}`)

Breaking changes since the legacy version:

1. **`secondPartyId` is no longer required** on transaction create (was mandatory before; column is now nullable and optional in the schema).
2. **Transaction types expanded**: `transfer`, `refund`, `adjustment` added; transfers create a debit + credit leg.
3. **Budget response shape changed**: `GET /api/budgets/` still returns legacy rows, but the new primary API is `budget_plans` (`POST /api/budgets/plans`, `GET /api/budgets/summary`, `GET /api/budgets/alerts`) — migrate the UI to plans.
4. **New endpoints to adopt**: buckets (envelope budgeting), recurring plans, rules, classification corrections, financial (safe-to-spend / daily allowance).
5. **Validation errors** now return `{message, issues: [...]}` instead of a plain message string.

Recommended migration path: keep the legacy transaction list/dashboard screens as-is; add buckets, plans and safe-to-spend as new screens; swap budget alerts to `/api/budgets/alerts` (uses plan spend, more accurate).

---

## 9. Building the Android App

Reference: **[FRONTEND_API_DOCS.md](FRONTEND_API_DOCS.md)** (object shapes, endpoint tables, auth section).

### Stack suggestion

- Kotlin + Retrofit/OkHttp + `kotlinx.serialization`; `EncryptedSharedPreferences` for tokens.
- OkHttp interceptor adds `Authorization: Bearer <token>`; on `401`/`403`, refresh via Supabase Auth (`supabase.auth.refreshSession`) and retry once.

### Core flows

| Screen / feature     | Endpoint(s)                                                                                                  |
| -------------------- | ------------------------------------------------------------------------------------------------------------ |
| Home / Safe-to-spend | `GET /api/financial/safe-to-spend`, `GET /api/financial/daily-allowance`                                     |
| Transactions         | `GET /api/transactions/transactions` (paged), `POST /api/transactions`, `POST /api/transactions/transfer`    |
| Buckets              | `GET /api/buckets`, `POST /api/buckets`, `GET /api/buckets/:id/balance`, `POST /api/buckets/:id/allocations` |
| Budgets              | `POST /api/budgets/plans`, `GET /api/budgets/summary`, `GET /api/budgets/alerts`                             |
| Sinking funds        | `GET/POST /api/recurring`, `POST /api/recurring/auto-fund`, `GET /api/recurring/upcoming`                    |
| Rules & corrections  | `GET/POST /api/rules`, `PATCH /api/classification/:transactionId`                                            |
| SMS auto-import      | `POST /api/ingestion/events` with `source: "sms"` (server dedupes)                                           |

### SMS forwarding (background)

Forward SMS/notification text to `POST /api/ingestion/events`:

```json
{
  "source": "sms",
  "accountId": "<user's account uuid>",
  "rawText": "<SMS body>",
  "occurredAt": "<ISO 8601>"
}
```

`accountId` should be stored from `GET /api/accounts` (pick the account whose institution matches, e.g. bank → UPI). Responses: `processed` (transaction created), `duplicate` (already seen), `422` (unparseable — skip, don't retry).

---

## 10. Deployment

### Docker

```bash
docker compose up -d --build
```

- Exposes port `5000`, `restart: unless-stopped`, multi-stage `Dockerfile` builds a Bun runtime image.

### Local

```bash
bun install
bun run dev              # development (nodemon)
bun run build && bun start   # production (tsc -> dist)
bun run type-check       # typecheck
bun test                 # unit tests (parsers, fingerprints, rules, math)
```

### Environment variables (full set)

```
PORT=5000
NODE_ENV=development|production
FRONTEND_URL=http://localhost:3000
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_ANON_KEY=
SUPABASE_DB_URL=
PG_POOL_MAX=5            # optional
PG_IDLE_TIMEOUT_MS=30000 # optional
COOKIE_DOMAIN=           # optional
OAUTH_REDIRECT_TO=       # optional, fallback for OAuth redirectTo
```

> No JWT_SECRET needed — JWT handling is entirely Supabase-side.

---

## 11. Notes & Gotchas

- **Auth is Supabase-managed**: passwords and JWTs never touch the app; middleware calls `authSupabase.auth.getUser(token)`.
- **Ledger-derived values are never stored**: bucket balances, budget spend, safe-to-spend, and daily allowance are computed on read. Don't "fix" them by writing columns.
- **Ingestion is fire-and-forget**: the event is stored and published immediately; parsing/classification happens in the handler. The API returns once the transaction (or duplicate/failure) is known — treat `422` as "unparseable, do not retry".
- **Dedupe is deterministic**: same event or same transaction (amount+direction+date+description) can never create two records for the same user.
- **Transfer legs**: a transfer creates two transactions sharing a `transferId`; they never count as income/expense in dashboard or budget math.
- **Route ordering matters**: `/transactions`, `/filter/tags`, `/dashboard` are registered before `/:id` in the transactions router so they are not shadowed.
- **`monthly_reports` / `user_summaries`** exist in the schema but are not written by any endpoint — analytics are computed live.
- **Legacy `budgets` table** is only kept for the old web UI; new features should use `budget_plans`.
- Cookie `sameSite=none` + `secure=true` in production — the frontend must be served over HTTPS for cookies to work in production.
- **Schema changes** are edited directly in `src/db/Migrations.ts` (idempotent DDL) — there is no migration versioning; don't rely on `ALTER TABLE` for existing prod data without a manual step.

opencode -s ses_01d2d2577ffet6V0MdFP6LuzcF
