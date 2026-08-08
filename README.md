# Finyo - Financial Tracker

A modern, sleek financial transaction tracking webapp built with SvelteJS and Tailwind CSS.

## Features

- 📊 **Dashboard** - View financial overview with stats and charts
- 💳 **Transaction Management** - Track income and expenses
- 💰 **Budget Tracking** - Set and monitor budgets
- 🏷️ **Tags & Categories** - Organize transactions with custom tags and categories
- 📱 **Responsive Design** - Works on desktop and mobile devices
- 🎨 **Beautiful UI** - Built with Tailwind CSS for a modern look

## Tech Stack

- **Frontend**: SvelteJS 4 + TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **HTTP Client**: Fetch API
- **Charts**: Chart.js

## Getting Started

### Prerequisites

- Node.js 16+ and npm

### Installation

1. Clone the repository:

```bash
git clone <repo-url>
cd PocketPortrait-frontend
```

2. Install dependencies:

```bash
npm install
```

3. Create `.env.local` and configure the backend URL:

```bash
cp .env.example .env.local
```

### Development

Start the development server:

```bash
npm run dev
```

The app will be available at `http://localhost:5173`

### Build

Build for production:

```bash
npm run build
```

### Backend API

Finyo connects to a backend API running at `http://localhost:5000` (set `VITE_API_BASE_URL` in `.env.local`; the dev server also proxies `/api`). The API prefix is `/api` and the full client reference lives in `FRONTEND_API_DOCS.md`.

**Auth:** the backend sets `authToken` (httpOnly) / `refreshToken` / `isLoggedIn` cookies on login and register. The web app sends `credentials: 'include'` on every request; on a `401`/`403` it refreshes the session via Supabase (`VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`) and retries once.

**Endpoints used:**

- `POST /api/auth/login`, `POST /api/auth/register`, `GET /api/auth/oauth/:provider`, `POST /api/auth/logout`, `GET /api/auth/me`
- `GET /api/transactions/transactions` (paged + filtered), `POST /api/transactions`, `POST /api/transactions/transfer`, `PUT/DELETE /api/transactions/:id`, `GET /api/transactions/dashboard`
- `GET /api/financial/safe-to-spend`, `GET /api/financial/daily-allowance`
- `GET/POST /api/budgets/summary|alerts|plans`, `POST /api/budgets/plans`, `PUT/DELETE /api/budgets/plans/:id`
- `GET/POST /api/accounts`, `DELETE /api/accounts/:id`
- `GET/POST /api/buckets`, `GET /api/buckets/:id/balance`, `POST /api/buckets/:id/allocations`
- `GET/POST /api/recurring`, `POST /api/recurring/auto-fund`, `GET /api/recurring/upcoming`
- `GET/POST /api/rules`, `POST /api/rules/:id/test`
- `POST /api/ingestion/events` (SMS import)

## Project Structure

```
src/
├── components/        # Svelte components (pages + modals)
│   ├── App.svelte
│   ├── Sidebar.svelte
│   ├── Dashboard.svelte       # stats + safe-to-spend + daily allowance
│   ├── TransactionList.svelte # paged ledger + SMS import
│   ├── AddTransaction.svelte  # create/edit + transfers
│   ├── BudgetPage.svelte      # budget plans + summary + alerts
│   ├── BucketsPage.svelte     # envelope buckets + allocations
│   ├── RecurringPage.svelte   # sinking funds + auto-fund
│   ├── RulesPage.svelte       # auto-classification rules
│   ├── AccountsPage.svelte    # financial accounts CRUD
│   └── ...                    # modal form components
├── lib/
│   ├── api.ts          # API client (cookies, error/issue parsing, 401 refresh)
│   ├── stores.ts       # Svelte stores for state management
│   ├── types.ts        # TypeScript types matching the backend API
│   └── storage.ts      # safe localStorage helpers
├── main.ts            # Application entry point
└── app.css            # Global styles with Tailwind directives
```

## License

MIT
