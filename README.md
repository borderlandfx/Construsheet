# ConstruSheet

Construction project management for the modern builder — APU cost analysis, budget tracking, and Gantt scheduling in one bilingual (ES/EN) web app.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/YOUR_USERNAME/construsheet&env=NEXT_PUBLIC_SUPABASE_URL,NEXT_PUBLIC_SUPABASE_ANON_KEY,SUPABASE_SERVICE_ROLE_KEY,ANTHROPIC_API_KEY,NEXT_PUBLIC_APP_URL&envDescription=See%20.env.example%20for%20details)

## Features

- **APU Editor** — line-item cost analysis (materials, labor, equipment) with overhead and profit margins
- **AI Generation** — describe a construction activity, get a full APU in seconds via Claude
- **Price Library** — built-in catalog of 40+ common materials, labor, and equipment rates
- **Budget Tab** — section-grouped budget with inline editing and real-time sync
- **Gantt Chart** — drag-and-drop timeline with resize handles and status cycling
- **PDF Export** — server-rendered PDF reports for both budget and Gantt views
- **CSV Export** — Gantt data as CSV for import into spreadsheets
- **Light / Dark mode** — toggle persisted across sessions
- **Bilingual** — full Spanish and English UI, PDF output, and AI prompts

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router) |
| Database | Supabase (Postgres + Realtime + Auth) |
| AI | Anthropic Claude (claude-sonnet-4-5) |
| PDF | @react-pdf/renderer v4 |
| Drag-and-drop | @dnd-kit |
| Styling | Tailwind CSS + CSS custom properties |
| Deployment | Vercel |

---

## Local Development Setup

### Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) account (free tier is fine)
- An [Anthropic](https://console.anthropic.com) API key

### Steps

**1. Clone the repository**

```bash
git clone https://github.com/YOUR_USERNAME/construsheet.git
cd construsheet
```

**2. Install dependencies**

```bash
npm install
```

**3. Copy the environment template and fill in your values**

```bash
cp .env.example .env.local
```

Edit `.env.local` with your real credentials (see [Environment Variables](#environment-variables) below).

**4. Set up the database**

See [Database Setup](#database-setup) — takes about 2 minutes.

**5. Start the dev server**

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Create an account and start a project.

---

## Database Setup

ConstruSheet uses Supabase. The entire schema lives in one file: `supabase/schema.sql`.

**Run it once in the Supabase SQL editor:**

1. Open [app.supabase.com](https://app.supabase.com) → select your project
2. Click **SQL Editor** in the left sidebar
3. Click **New query**
4. Paste the contents of `supabase/schema.sql`
5. Click **Run** (or press `Ctrl+Enter`)

That creates all tables (`profiles`, `projects`, `apu_items`, `budget_rows`, `gantt_tasks`), Row Level Security policies, triggers, and indexes.

**Authentication setup (required for login to work):**

1. Supabase dashboard → **Authentication** → **URL Configuration**
2. Set **Site URL** to your app URL:
   - Local: `http://localhost:3000`
   - Production: `https://your-app.vercel.app`
3. Add the same URL to **Redirect URLs**

---

## Environment Variables

Copy `.env.example` to `.env.local` for local development. For production, set these in the Vercel dashboard under **Settings → Environment Variables**.

| Variable | Where to find it | Secret? |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API | No |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API | No |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API | **Yes** |
| `ANTHROPIC_API_KEY` | console.anthropic.com → API Keys | **Yes** |
| `NEXT_PUBLIC_APP_URL` | Your deployed URL | No |

> The service role key and Anthropic key are used exclusively in server-side route handlers. They are never sent to the browser.

---

## Deploy to Vercel

### Option A — One-click deploy

Click the **Deploy with Vercel** button at the top of this README. You will be prompted to enter all environment variables during setup.

### Option B — Manual import

1. Push this repo to GitHub (see commands below)
2. Go to [vercel.com/new](https://vercel.com/new)
3. Import the GitHub repository
4. Vercel auto-detects Next.js — no build config changes needed
5. Add all environment variables under **Environment Variables**
6. Click **Deploy**

After the first deploy, set the Supabase **Site URL** and **Redirect URLs** to your `https://your-app.vercel.app` URL.

---

## Deployment Commands

See the [Deployment Commands](#exact-deployment-commands) section for copy-paste shell commands to push to GitHub and deploy.
