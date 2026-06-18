# CFMFHE Analytics

A hosted, login-protected analytics dashboard for **Come Follow Me FHE**. It
consolidates order & membership data from two stores (WooCommerce +
Shopify), email/SMS (Klaviyo), and traffic (GA4) into one place, with an
AI "Ask Anything" interface powered by Claude.

> **Status: Phase 1 (Foundation) + Overview dashboard.** The app runs on a
> built-in **sample dataset** until the live Google Sheets sync is connected;
> Klaviyo, GA4, and the AI layer are stubbed as upcoming phases. Each data
> source degrades gracefully ("source disconnected" / "sample data") rather
> than crashing.

## Tech stack

- **Next.js 14** (App Router) · **TypeScript** · **Tailwind CSS**
- **Recharts** for charts · **react-day-picker** for the date picker
- **NextAuth** (credentials) for login · **Zustand** for filter state
- **Google Sheets API**, **Klaviyo**, **GA4**, **Anthropic** clients (lib/)

## Getting started

```bash
pnpm install
pnpm dev
```

Open http://localhost:3000. In development a demo user is seeded:
`admin@cfmfhe.com` / `cfmfhe-demo`. Configure real users via `DASHBOARD_USERS`
(see `.env.example`).

## Configuration

Copy `.env.example` to `.env.local` and fill in what you have. Nothing is
required to run on sample data except `NEXTAUTH_SECRET` for production. Live
order data turns on automatically once the Google Sheets vars are set.

Analysis thresholds, pricing, key dates, and the Google Sheets **column
mapping** all live in `lib/config.ts` so they can be tuned without touching
component code (the sheet headers are finalized once the sync setup completes).

## What's built

- Branded login + 30-day sessions, route protection via middleware
- Sidebar nav, persistent **store filter** + **date-range picker** with quick
  selects, custom calendar, and **compare mode** (previous period / year)
- Order normalization, product classification, and free-trial detection
- **Overview dashboard**: 7 KPI cards (with compare deltas), 12-month revenue
  (new vs returning), new-vs-churned members with net line, and plan-mix donut
- January seasonality is flagged on charts, not hidden

## Roadmap

See the project brief. Phases 2–6 add the Membership deep-dives (funnel,
cohorts, LTV), Klaviyo & GA4 dashboards, the Products view, and the AI
Ask-Anything layer.

## Deploy

Deploys to Vercel (Next.js auto-detected; `vercel.json` included). Set the
environment variables in the Vercel project, then deploy.
