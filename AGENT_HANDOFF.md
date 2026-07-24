# Agent Handoff — Donation Management Platform

> **How to use this file:** open a fresh chat and tell the agent:
> _"Read `AGENT_HANDOFF.md` at the repo root first, then continue from the
> **Current Focus** section. Do not assume prior chat context; verify claims
> against the code on disk before acting."_
>
> Keep this file honest — update the **Current Focus**, **Landed Features**,
> and **Known Gaps** sections at the end of every working session.

---

## 1. Product overview

Multi-tenant **donation / foundation management** platform. Each tenant is a
`Foundation`. The platform supports:

- Donor management with three identifier tiers (PAN / phone-only / anonymous).
- Donation intake with lifecycle (`PENDING → RECEIVED`), print flagging, and
  optional WhatsApp receipt delivery.
- Expense management (categories + expenses) with soft-delete + audit.
- Activities (narrative log of programs / events per foundation).
- **Financial years** — per-foundation FY windows (Indian April-start default)
  that gate writes when closed and scope dashboards / reports.
- **Bank accounts + append-only ledger** — donations credit and expenses debit
  a bank account; corrections are reversing rows, never deletes.
- **Transfers + Fixed Deposits** — internal money movement between the
  foundation's own buckets: cash↔bank plus bank→FD / FD→bank, with an FD
  register tracking principal, maturity, and interest earned on return.
- **Accounting views** — income / expense ledgers, cash & bank books, and a
  reports statement built as read-only aggregates over the ledger.
- Superadmin oversight (cross-foundation view, audit log, foundation CRUD).
- Employee role with granular per-permission access, scoped to records they
  created unless granted the relevant `*:viewAll` key.

Not yet built: KYC / file attachments (DB scaffold only), donor→activity
linking, customer self-serve portal.

Branding: the app footer credits **Toran Software Services Pvt. Ltd.** —
rendered on every authenticated page via `components/Layout.jsx` and on
the public login screen via `features/auth/pages/LoginPage.jsx`. Year is
computed with `new Date().getFullYear()` so it auto-rolls.

## 2. Tech stack

**Backend** (`server/`)
- Node.js + Express 5, ES modules, `type: module`.
- Prisma 6 + PostgreSQL 16.
- Zod for validation, JWT auth (`jsonwebtoken`), bcrypt for hashing.
- Pino structured logs, helmet, express-rate-limit.
- No test runner wired yet (npm test is a stub).

**Frontend** (`cms/`)
- React 18 + Vite 5, JSX (no TypeScript). Route-level pages are lazy-loaded
  via `React.lazy` in `App.jsx` and wrapped in a per-route `ErrorBoundary`.
- Tailwind CSS 3 with a CSS-variable token system (`darkMode: 'class'`,
  `data-accent` attribute driving multiple accent palettes).
- Headless UI 2 + Heroicons for interactive primitives.
- Axios client (`src/lib/api.js`) with a `withQuery` helper.
- React Router 7, react-toastify for notifications.
- Chart.js 4 + react-chartjs-2 for the dashboard.
- html2canvas + jspdf + react-to-print for receipt export.

**Infra** — `docker-compose.yml` at repo root: `postgres`, `backend`,
`migrator` (one-shot `prisma migrate deploy && seed`), `frontend` (nginx
serving Vite build + reverse-proxying `/api/v1` → backend).

## 3. Repo layout (top-level)

```
server/
  prisma/
    schema.prisma            # single source of truth for the DB
    migrations/              # applied migrations, timestamp-ordered
    seed.js                  # seeds SUPERADMIN + demo data
  src/
    index.js                 # process entry (loads app, starts listener)
    app.js                   # express app assembly (middleware + routes)
    routes/index.js          # mounts every module router under /api/v1
    lib/                     # prisma singleton, audit, pagination, tenantScope,
                             #   permissions, financialYear, bankLedger,
                             #   apiError, asyncHandler, env, logger, requestContext
    middleware/              # authenticate, authorize/requirePermission,
                             #   validate, requestContext, error handler
    modules/                 # one folder per domain — schema/service/controller/routes
cms/
  src/
    lib/                     # axios client, authHelpers, convertNumberToWords
    components/ui/           # theme-aware primitives (Button, Card, Modal, Dropdown,
                             #   PowerTable, Tabs, Select, ConfirmDialog, …)
    components/              # non-primitive shared components (Sidebar, Layout, guards)
    context/                 # AuthContext, ThemeContext, FinancialYearContext
    constants/permissions.js # PERMISSIONS enum (mirrors server)
    hooks/usePermissions.js  # can(permission) helper over AuthContext
    features/<domain>/       # api.js + pages/ + components/ per domain
docker-compose.yml
README.md                    # user-facing project docs
AGENT_HANDOFF.md             # ← you are here
```

## 4. Multi-tenancy & roles

- **Roles**: `SUPERADMIN`, `ADMIN`, `EMPLOYEE`, `CUSTOMER` (customer portal not
  yet built).
- **Tenant scoping**: every mutating request runs through
  `resolveFoundationId(user, body/query)` in `server/src/lib/tenantScope.js`.
  ADMIN/EMPLOYEE are pinned to `user.foundationId`; SUPERADMIN may target any
  foundation by passing `foundationId` explicitly.
- **Permissions**: `User.permissions String[]` on Prisma. `ADMIN`/`SUPERADMIN`
  bypass permission checks (`hasPermission` in `server/src/lib/permissions.js`
  short-circuits for `PRIVILEGED_ROLES`); `EMPLOYEE` needs explicit grants.
  Canonical keys live in `server/src/lib/permissions.js` and are mirrored in
  `cms/src/constants/permissions.js`.
- **Soft delete + audit**: applied in `server/src/lib/prisma.js` via Prisma
  middleware — never delete rows directly; call the service's delete which sets
  `isDeleted=true`, snapshots `before`/`after` into `AuditLog`, and returns the
  tombstoned row. (Exception: `Transaction` is append-only — see §7.)

## 5. Data model summary (see `server/prisma/schema.prisma` for truth)

Core models: `Foundation`, `User`, `Donor`, `Donation`, `Activity`,
`ExpenseCategory`, `Expense`, `FinancialYear`, `BankAccount`, `Transaction`,
`Transfer`, `FixedDeposit`, `Attachment` (polymorphic scaffold), `AuditLog`.

Enums: `Role`, `DonationType` (CASH/CHEQUE/ONLINE/UPI), `DonationStatus`
(PENDING/RECEIVED), `DonationCategory` (GENERAL/CSR), `ActivityStatus`
(PLANNED/IN_PROGRESS/COMPLETED/CANCELLED), `AuditAction`, `FYStatus`
(ACTIVE/CLOSED), `BankAccountCategory` (GENERAL/CSR), `TransactionType`
(CREDIT/DEBIT), `TransferKind` (CASH_TO_BANK/BANK_TO_CASH/BANK_TO_FD/
FD_TO_BANK), `FixedDepositStatus` (ACTIVE/CLOSED).

**Donor identifier tiers**:
- **Tier 1**: donor with PAN (`Donor.pan` unique per foundation when set).
- **Tier 2**: donor with phone only (`Donor.phone` partial-unique per
  foundation via SQL `WHERE phone IS NOT NULL` — Prisma can't declare partial
  uniques, service catches `P2002`).
- **Tier 3**: anonymous donation (`Donation.donorId` nullable, snapshots
  stored in `donorNameSnapshot` / `donorPhoneSnapshot`).

**Financial year**: `FinancialYear` windows are half-open `[startDate, endDate)`
on `donationDate` / `paidOn`. Windows must not overlap per foundation — enforced
by a range-exclusion constraint in migration SQL. `Foundation.fyStartMonth`
(default 4 = April) drives auto-creation.

**Bank account + ledger**: `BankAccount` carries a running `balance` seeded by
`openingBalance`; at most one `isDefault=true` per `(foundationId, category)`
(partial unique index). `Transaction` is an append-only ledger — donations post
a CREDIT, expenses a DEBIT; corrections insert a reversing row (`reversalOf` /
`reversedBy` chain). `balanceAfter` snapshots the account balance per row.
**Cash vs bank is derived, not stored**: a `BankAccount` with
`accountNumber = null` is a *cash* bucket; a set `accountNumber` is a *bank*
account.

**Transfer + FixedDeposit**: `Transfer` records an internal money movement
(`kind` = one of the four). Cash↔bank transfers post two ledger legs (DEBIT
source + CREDIT destination, both `entityType="Transfer"`); FD transfers post a
single bank-side leg and open/close a `FixedDeposit`. `FixedDeposit` holds
principal, optional interest rate, maturity, and — once returned — the matured
`returnAmount` and derived interest (`returnAmount − principal`). Transfer legs
are tied to their `Transfer` via the polymorphic `entityType`/`entityId`
pointer (no typed FK on `Transaction`).

**Attachment** is polymorphic (`entityType` + `entityId`) with pluggable
`storageProvider` (`local` planned, `s3` planned) — DB scaffold only, no
module wired yet.

## 6. Backend module conventions

Every domain under `server/src/modules/<name>/` follows the same four-file
layout:

- `<name>.schema.js` — Zod schemas: `createSchema`, `updateSchema`,
  `listQuerySchema`. Always coerce numeric/date query params.
- `<name>.service.js` — pure business logic. Receives `user` (from JWT) as
  the first arg for tenant scoping + audit. Uses `findScoped` /
  `resolveFoundationId` from `lib/tenantScope.js`. Wraps mutations with
  `writeAudit(user, action, model, id, before, after)`.
- `<name>.controller.js` — thin: parse with Zod, call service, respond.
  Errors bubble to the global error middleware.
- `<name>.routes.js` — mounts middleware: `authenticate`, `authorize(...)`,
  `requirePermission(PERMISSIONS.X)`, `validate({ query/body })`, then handler.
  All routers are imported into `server/src/routes/index.js`.

Mounted routers under `/api/v1` (see `routes/index.js`): `auth`, `foundations`,
`admins`, `employees`, `donors`, `donations`, `activities`,
`expense-categories`, `expenses`, `bank-accounts`, `transactions`, `transfers`,
`financial-years`, `stats`, `accounting`, `audits` — plus `GET /health`.

Never talk to Prisma directly from a controller. Never bypass
`resolveFoundationId` in a service.

## 7. Financial years, bank ledger & accounting (backend internals)

- **`lib/financialYear.js`**: `computeFyWindow(date, fyStartMonth)` (pure,
  UTC-anchored) → `{ startDate, endDate, label }`;
  `resolveFinancialYearForDate(foundationId, date, { autoCreate })` finds or
  auto-creates the FY row (catches `P2002`/`P2010` on concurrent create);
  `ensureFyWritable(fy)` throws `409 FY_CLOSED` when writing into a closed FY.
  Donation / expense services call the resolver on create/update to stamp
  `financialYearId` and enforce the closed-window guard.
- **`lib/bankLedger.js`**: `postTransaction(tx, {...})` — MUST run inside a
  Prisma `$transaction`; loads + validates the account, computes the balance
  delta (CREDIT adds, DEBIT subtracts), rejects DEBIT that would go negative
  (`422 INSUFFICIENT_BALANCE`), updates `bankAccount.balance` atomically, and
  inserts the ledger row (back-linking `reversedBy` when it's a reversal).
  `reverseTransactionFor(tx, foundationId, entityType, entityId)` finds the
  live (non-reversed) row and posts the opposite type; idempotent via the
  reversal chain; returns null when there's nothing to reverse (e.g. a PENDING
  donation that never posted). `findDefaultBankAccount` resolves the default
  account for a category.
- **`modules/accounting/`**: read-only aggregates over the ledger. Endpoints
  (all gated `ADMIN`/`SUPERADMIN`/`EMPLOYEE` + `DASHBOARD_VIEW`):
  `GET /accounting/summary`, `/ledger/income`, `/ledger/expense`,
  `/books/cash`, `/books/bank`, `/reports`. Cash-vs-bank split is a predicate
  on `bankAccount.accountNumber` (null ⇒ cash). Running balances derive from
  `Transaction.balanceAfter`.
- **`modules/transactions/`**: read-only `GET /transactions` (the ledger view),
  gated by `BANK_ACCOUNT_VIEW`. Every row is written by the donation/expense
  services — there is no write endpoint.
- **`modules/transfers/`**: internal money movement. `POST /transfers` handles
  all four `TransferKind`s inside one `$transaction` (writes gated by
  `transfer:manage`); `GET /transfers` and `GET /transfers/fixed-deposits`
  (reads gated by `BANK_ACCOUNT_VIEW`); `DELETE /transfers/:id` reverses. The
  service reuses `postTransaction` for the ledger legs, auto-provisions a
  "Cash in Hand" account (`ensureCashAccount`) when a cash↔bank transfer needs
  one, and resolves/guards the FY like donations/expenses. **Reversal**
  (`deleteTransfer`) undoes every live ledger leg (loops `reverseTransactionFor`
  since cash↔bank has two legs) and reverts the linked FD — a reversed BANK_TO_FD
  soft-deletes the FD (blocked if already returned); a reversed FD_TO_BANK
  re-opens it.
- **Transfers must not be counted as income/expense** — `accounting.service.js`
  filters `entityType != "Transfer"` in `sumLedger` and the income/expense
  ledger listings, but **keeps** them in the cash/bank books (they move the
  running balance). The reports statement splits `transferIn`/`transferOut` so
  each account's closing balance still reconciles, and `getAccountingSummary`
  returns a `fixedDeposits` block (`activeCount`, `activePrincipal`,
  `interestEarned`). Anything summing the ledger for income/expense MUST apply
  the same `entityType != "Transfer"` filter.

## 8. Frontend conventions

- **Feature folder** (`cms/src/features/<domain>/`): `api.js` (axios calls),
  `pages/` (route-level screens), optional `components/` for domain-only
  widgets. Shared primitives live in `cms/src/components/ui/`.
- **Routing**: `App.jsx` lazy-loads every page and wraps each protected route
  in `PrivateRoute` (role + optional `perm` gate) and a `RouteBoundary`
  (per-route `ErrorBoundary`). Legacy `/reports` redirects to
  `/donation/search`.
- **Navigation**: `components/Sidebar.jsx` builds a role+permission-filtered
  `navTree`; groups with no visible children are dropped automatically. Groups:
  Donor, Donation, Activities, Expenses, Accounting, Administration.
- **Financial year**: `context/FinancialYearContext.jsx` holds the selected FY;
  the sidebar renders `FinancialYearSelect` when years exist. FY-scoped queries
  and dashboard tiles consume the selection.
- **Theming**: never hard-code colors. Use tokens (`bg-card`, `text-foreground`,
  `text-muted-foreground`, `bg-primary`, `border-border`, …). Dark mode is a
  `class="dark"` on `<html>`; accent is `data-accent="…"` (see ThemeContext).
- **Tables**: use `PowerTable` from `components/ui` for anything with
  filtering / pagination / column visibility. It handles empty/loading states.
- **Row actions**: primary status transitions stay inline; secondary actions
  collapse into a `Dropdown` triggered by `EllipsisVerticalIcon`.
- **Permission gating**: import `PERMISSIONS` from
  `cms/src/constants/permissions.js` and use `usePermissions().can(key)` (or
  `useAuth().hasPermission(key)`) to hide actions the user can't perform.
- **Toasts**: `import { toast } from 'react-toastify'` — `toast.success`
  for confirmations, `toast.error(err?.response?.data?.message || 'Failed')`
  for errors.

## 9. Dev / ops commands

**Fresh rebuild** (after schema or dependency changes):
```powershell
docker compose build --no-cache
docker compose up -d
```

**Frontend-only iteration**:
```powershell
docker compose build --no-cache frontend
docker compose up -d frontend
```

**Backend-only iteration** (rebuilds `backend` and re-runs `migrator`):
```powershell
docker compose build --no-cache backend
docker compose up -d backend migrator
```

**New Prisma migration** (from the host, then rebuild):
```powershell
cd server
npx prisma migrate dev --name <descriptive_snake_case>
cd ..
docker compose build --no-cache backend
docker compose up -d backend migrator
```

**Tail logs**: `docker compose logs -f backend` /
`docker compose logs -f frontend`.

**Reset DB** (destructive): `docker compose down -v && docker compose up -d`.

## 10. Landed features (verified against disk on 2026-07-13)

- Auth (login, `/me`), Foundations CRUD, Admins CRUD, Employees CRUD with
  granular permissions, Donors CRUD, Donations CRUD + lifecycle
  (`mark-received`, `mark-printed`), Activities CRUD, Audits list, Stats
  dashboard.
- WhatsApp receipt delivery: opt-in on donation create, stub provider under
  `modules/notifications/whatsapp/`, resend endpoint.
- Unified donation management: `SearchDonation.jsx` (list + filters +
  actions) and `DonorHistory.jsx` (per-donor drill-down). `DonationReport`
  folded into SearchDonation; receipt export via `receiptTemplate.js`.
- Theme system (light/dark × accents) with CSS-variable tokens.
- 3-tier donor identity (`resolveOrCreateDonor` dedupes PAN → phone → name-only,
  persists snapshots, supports anonymous Tier-3) + polymorphic `Attachment`
  DB scaffold.
- **Expense management**: `ExpenseCategory` + `Expense` models,
  `modules/expenseCategories/` + `modules/expenses/`, `expense:*` +
  `expenseCategory:manage` permissions, `ManageExpenseCategories.jsx` +
  `ManageExpenses.jsx` (server-paginated PowerTable, filters, row Dropdown,
  create+edit modal, SUPERADMIN foundation picker).
- **Analytics dashboard**: `stats.service.js` returns lifetime + MTD totals,
  fulfillment rates, donor tier mix, and a pending-donations queue
  (`GET /stats/pending-donations`); `Dashboard.jsx` renders KPI tiles, a
  donations-vs-expenses trend, donation-type / expense-category / tier-mix
  pies, and the pending queue.
- **Financial years** (`modules/financialYears/`, `lib/financialYear.js`):
  per-foundation FY windows with April-start default, auto-creation on
  donation/expense writes, close/reopen lifecycle, closed-window write guard
  (`ensureFyWritable`). Frontend: `ManageFinancialYears.jsx`,
  `FinancialYearContext`, `FinancialYearSelect` in the sidebar.
  Permission: `financialYear:manage`.
- **Bank accounts + append-only ledger** (`modules/bankAccounts/`,
  `modules/transactions/`, `lib/bankLedger.js`): per-category bank accounts
  with running balances and a default-account-per-category constraint;
  donations CREDIT and expenses DEBIT via `postTransaction` inside a Prisma
  `$transaction`; corrections via reversing rows; insufficient-balance guard.
  Frontend: `ManageBankAccounts.jsx`, `ManageTransactions.jsx` (ledger view),
  `BankAccountSelect`. Permissions: `bankAccount:manage`, `bankAccount:view`.
- **Accounting module** (`modules/accounting/`): read-only income/expense
  ledgers, cash & bank books (running balances from `balanceAfter`), and a
  per-account opening/closing reports statement (with a Transfers column).
  Frontend under `features/accounting/`: `AccountingDashboard`, `IncomeLedger`,
  `ExpenseLedger`, `CashBook`, `BankBook`, `AccountingReports`.
- **Transfers + Fixed Deposits** (`modules/transfers/`, migration
  `20260713000000_transfers_and_fixed_deposits`): four transfer kinds
  (cash↔bank, bank↔FD) posting paired/single ledger legs; auto-provisioned
  "Cash in Hand" cash account; FD register with principal / rate / maturity /
  return / derived interest; full reversal (undo legs + revert FD). Accounting
  aggregates exclude transfer legs from income/expense but keep them in the
  cash/bank books, and the reports statement + dashboard surface transfers and
  FD holdings. Permission `transfer:manage` (reads reuse `bankAccount:view`).
  Frontend: `features/transfers/` — `ManageTransfers.jsx` (Transfers +
  Fixed Deposits tabs, kind-driven New Transfer modal), route
  `/accounting/transfers`, **Transfer** item in the sidebar Accounting group.
- **Settings**: `SettingsPage.jsx` with `AppearanceSettings` (theme/accent)
  and `OrganizationSettings` (foundation config incl. cash limit, WhatsApp,
  fyStartMonth).

## 11. Known gaps

Do **not** silently pick these up — flag to the user before starting.

- **Attachments module**: no server module, no upload route, no storage
  provider code, no `AttachmentUploader.jsx`. DB scaffold only.
- **Donation ↔ Activity linkage**: `Donation.activityId` does not exist
  (only `Expense.activityId` does). Activities are otherwise a standalone log.
- **Customer portal**: `Role.CUSTOMER` is defined but no self-serve UI.
- **Donor tier badging in list views**: the 3-tier model is captured on write
  but list views don't yet surface a Tier 1/2/3 chip. Nice-to-have polish.
- **Tests**: no test runner is wired; `npm test` is a stub on both sides.

## 12. Current focus

> ⚠️ **Repo state (2026-07-13):** the working tree is a large in-place
> refactor that is **not yet committed**. Git still tracks the *old* flat
> layout (`server/src/controllers|services|routes`, `cms/src/pages/*`,
> `cms/src/apis/*`) as deleted, while the current modular structure on disk
> (`server/src/modules/*`, `cms/src/features/*`) is entirely untracked.
> Treat the code **on disk** as truth, not `git HEAD` and not this doc.
> A number of scratch/debug artifacts also sit at the repo root
> (`_check.sql`, `body.json`, `login.json`, `container_*.service.js`,
> `handoff_*.json`, `server/_*.bat`, …) — candidates for gitignore/cleanup
> before any commit.

**Owed verification pass** (carried over): manual end-to-end check of
`/expenses`, `/expense-categories`, the FY close/reopen guard, bank-account
default-per-category enforcement, and the ledger reversal flow on
donation/expense delete — across SUPERADMIN (foundation picker), ADMIN
(pinned scope), and EMPLOYEE (`*:viewAll` ownership scope).

**Candidate next steps** (pick one with the user before starting):

- **Commit the refactor**: stage the module/feature restructure and remove
  scratch artifacts so `git HEAD` reflects reality.
- **Attachments module**: server module + upload route + local storage
  provider + `AttachmentUploader.jsx`, wired into donations then expenses.
- **Donation ↔ Activity linkage**: add `Donation.activityId`, expose it in
  the donation form, surface per-activity totals.
- **Donor tier badging**: Tier 1/2/3 chips in `SearchDonation.jsx` and donor
  lists; low-effort polish.
- **Analytics — deeper cuts**: donor cohorts / retention, expense budget vs
  actuals, activity-linked spend, WhatsApp delivery-failure drill-in.

**Deliberately out of scope**: recurring expenses, vendor management, customer
portal, S3 attachment storage.

---

_Last updated: 2026-07-13 — **Transfers + Fixed Deposits** subsystem landed
end-to-end (migration `20260713000000`, `modules/transfers/`,
`features/transfers/ManageTransfers.jsx`, `transfer:manage` permission,
accounting income/expense exclusion + reports Transfers column + dashboard FD
block). Verified in Docker across all four kinds, income/expense exclusion,
and reversal. Earlier the same day: rewrote the handoff to match disk after the
financial-year, bank-account, append-only ledger, transactions, and accounting
subsystems landed. Note the uncommitted refactor + root scratch artifacts
flagged in §12 still stand — the Transfers work sits on top of the
`refactor-baseline` branch and is likewise uncommitted._
