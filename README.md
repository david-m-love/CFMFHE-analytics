# CFMFHE Analytics

A hosted, login-protected analytics dashboard for **Come Follow Me FHE**. It
consolidates order & membership data from two stores (WooCommerce +
Shopify), email/SMS (Klaviyo), and traffic (GA4) into one place, with an
AI "Ask Anything" interface powered by Claude.

> **Status: Phase 1 (Foundation) + Overview dashboard.** The app runs on a
> built-in **sample dataset** with **no login and no env vars required**, so
> it can be previewed and deployed immediately. Live data (Google Sheets,
> Klaviyo, GA4) and the AI layer are wired in later phases. Each data source
> degrades gracefully ("source disconnected" / "sample data") rather than
> crashing. (Authentication is intentionally off during preview; it returns
> in a later phase.)

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

Open http://localhost:3000. No login — the dashboard loads straight away on
sample data.

## Configuration

Copy `.env.example` to `.env.local` and fill in what you have. **Nothing is
required** to run or deploy on sample data. Live order data turns on
automatically once the Google Sheets vars are set.

Analysis thresholds, pricing, key dates, and the Google Sheets **column
mapping** all live in `lib/config.ts` so they can be tuned without touching
component code (the sheet headers are finalized once the sync setup completes).

## What's built

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
