# FitRelay

Automation-first gym operations and membership platform. Member management, membership
lifecycle (registration, freeze/unfreeze, renewal), an append-only financial ledger (payments,
refunds, credit), automated WhatsApp-ready reminders, and reporting — built for a single gym,
designed to be tenant-ready if that ever changes.

## Tech stack

- **Frontend**: React 19 + TypeScript + Vite, Tailwind CSS v4
- **Backend**: Supabase (Postgres + Auth), SQL migrations via the Supabase CLI
- **Data layer**: `@supabase/supabase-js` (typed client) + TanStack Query for all server state
- **Routing**: React Router v6
- **Scheduled jobs**: `pg_cron` (daily reminder generation)
- **Deployment**: Vercel (frontend) + Supabase (hosted Postgres/Auth)
- **Reporting exports**: `xlsx` (Excel), `jspdf` + `jspdf-autotable` (PDF)
- **Other**: `libphonenumber-js` (phone normalization), `lucide-react` (icons)

## Features

- **Members** — registration with duplicate-phone warning, member list with search/status filter,
  full member detail view (membership + payment history).
- **Memberships** — plan-based registration, freeze/unfreeze, renewal (including lapsed renewals),
  derived (never stored) status via SQL views.
- **Payments** — append-only ledger: payments, FIFO allocation to outstanding charges with manual
  override support at the database level, unallocated credit, reversal-based corrections (no
  destructive edits to financial history). Gym-wide payments view with date/member filtering.
- **Reminders** — automated daily generation (payment-due, and expiry-due at 7/3/0/-1 days),
  surfaced as a to-do list with a WhatsApp click-to-chat link per reminder (never auto-sent — a
  human always reviews and sends manually) and a manual "mark sent" action.
- **Dashboard** — member status breakdown, gym-wide outstanding balance, today's collections,
  pending reminder count, memberships expiring in the next 7 days.
- **Reports** — date-ranged collections report, exportable to Excel and PDF.
- **Settings** — membership plan management (create/edit/deactivate; plans are never hard-deleted
  since historical memberships reference them).

## Project structure

```
src/
  components/       Shared UI (Modal, StatusBadge, ThemeToggle, ...)
  context/          AuthContext, ThemeContext
  features/
    members/        Member list + registration queries/mutations
    payments/        Gym-wide payments queries/mutations
    reminders/        Reminders queries/mutations
    dashboard/         Dashboard aggregate queries
    reports/           Report data + Excel/PDF export helpers
    settings/           Membership plan CRUD
  layouts/          AppLayout (nav shell)
  lib/              supabaseClient, phone normalization helpers
  pages/            One component per route
  routes/           ProtectedRoute / OnboardingRoute guards
  types/            Generated Supabase types (database.types.ts)
supabase/
  migrations/       All SQL migrations, applied in order
scripts/
  test-backend.mjs  End-to-end backend verification (signup → payments → reminders)
  seed-data.mjs     Seeds realistic member/payment/membership scenarios for dev/testing
```

## Local setup

**Prerequisites**: Node.js, a Supabase project, the Supabase CLI (`npm i -g supabase` or via
your package manager).

1. Clone the repo and install dependencies:
npm install
2. Create `.env.local` in the project root:
VITE_SUPABASE_URL=your-project-url
VITE_SUPABASE_ANON_KEY=your-anon-or-publishable-key
3. Link and push the database schema:
npx supabase login
npx supabase init
npx supabase link --project-ref <your-project-ref>
npx supabase db push --remote
4. Start the dev server:
npm run dev
5. Sign up through the app UI to create your gym (the first signup bootstraps a gym + owner via
   `create_gym_and_owner`). Add at least one membership plan under Settings before registering
   members.

## Scripts

**Backend verification** — exercises the full lifecycle (signup, registration, payment, freeze,
unfreeze, renewal, reminder generation) against a real (ideally disposable/dev) Supabase project:

SEED_EMAIL=you@example.com SEED_PASSWORD=yourpassword node --env-file=.env.test.local scripts/seed-data.mjs
Requires at least one membership plan to already exist in the target gym.

## Architecture notes

- **Multi-tenancy**: built tenant-ready (every table scoped by `gym_id`, RLS enforced via
  `current_gym_id()`) but currently single-gym, owner-only (no staff roles yet).
- **Financial integrity**: payments/charges/allocations are append-only. Corrections happen via
  reversal + new entries, never by editing or deleting historical rows. Overpayment becomes
  unallocated credit rather than a separate ledger concept.
- **Derived status**: membership and member status are never stored — they're computed on read via
  SQL views (`membership_status`, `member_status`) so there's no stale-status bug class to begin
  with.
- **RLS vs GRANTs**: every new table/function needs both an RLS policy AND an explicit table/
  function-level `GRANT` to the relevant Postgres role (`authenticated` and/or `service_role`) —
  Supabase does not grant these automatically for CLI-created objects. This has caused real bugs
  during development; check both whenever adding something new.

## Known v1 limitations (by design, not oversight)

- Single staff role (owner only) — no multi-staff permissions yet.
- No refund UI yet on the Member Detail page (the `create_refund` backend function exists but
  isn't wired to the frontend).
- Google Sheets export is not implemented (Excel and PDF are).
- No separate credit-refund or upcoming-membership-cancellation flow.
- Single Supabase project serves as both the development and production database — no staging
  environment split yet.

## Deployment

Frontend deploys to Vercel (auto-detects Vite; set `VITE_SUPABASE_URL` and
`VITE_SUPABASE_ANON_KEY` as environment variables in the Vercel project). After the first deploy,
update Supabase Authentication → URL Configuration with the deployed domain (Site URL + Redirect
URLs), or auth email links will redirect incorrectly. See the project's deployment runbook for the
full step-by-step.

## License

Proprietary — internal project, not for redistribution.