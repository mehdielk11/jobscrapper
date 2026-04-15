# 🛡️ FEATURE BRIEF — Admin Panel
## Job Offers Analyzer & Recommender
### Tech: React 18 + Vite + Supabase + TailwindCSS

> **Document type:** AI build prompt / feature specification  
> **Scope:** New admin user role + full admin dashboard  
> **Frontend:** React 18 with Vite, TailwindCSS, Recharts, React Router v6  
> **Backend/DB:** Supabase (PostgreSQL + Auth + RLS + Edge Functions)

---

## 1. WHAT IS THE ADMIN PANEL?

The admin panel is a **protected section of the app** accessible only to users with the `admin` role. It gives full operational control over the platform — managing scrapers, users, job data, NLP pipelines, and analytics — all from a single React dashboard.

It is a **separate route** (`/admin/*`) within the existing React + Vite app, rendered conditionally based on the authenticated user's role. Non-admin users who attempt to access any `/admin` route are silently redirected to the homepage.

The admin is the **only person** who can:
- Trigger and monitor scrapers
- Review and moderate scraped job offers
- Manage student accounts
- View platform-wide analytics
- Configure the skills taxonomy
- Monitor system health

---

## 2. ADMIN ROLE SYSTEM (Supabase)

### 2.1 Role Architecture

Supabase does not have a native role field — implement it via a `user_roles` table and a custom claim injected into the JWT.

**SQL to add to `schema.sql`:**

```sql
-- User roles table
create table if not exists user_roles (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade unique,
  role text not null default 'student' check (role in ('student', 'admin')),
  assigned_at timestamp with time zone default now()
);

-- RLS: only service role can write; authenticated users can read their own role
alter table user_roles enable row level security;

create policy "Users can read own role"
  on user_roles for select
  using (auth.uid() = user_id);

-- Admin check helper function
create or replace function public.is_admin()
returns boolean as $$
  select exists (
    select 1 from user_roles
    where user_id = auth.uid() and role = 'admin'
  );
$$ language sql security definer;
```

**To assign the first admin manually:**
```sql
-- Run this once in Supabase SQL Editor after creating your account
insert into user_roles (user_id, role)
values ('<your-auth-user-uuid>', 'admin');
```

### 2.2 Protecting Admin Routes in React

Create a `useAdminGuard` hook:

```typescript
// hooks/useAdminGuard.ts
// On mount: fetch user_roles for current user from Supabase
// If role !== 'admin': redirect to '/' immediately
// While loading: show a full-page spinner, never flash content
// Expose: { isAdmin: boolean, isLoading: boolean }
```

Wrap every admin page component with this hook. Never rely on frontend-only guards — all Supabase queries use RLS to enforce permissions server-side.

### 2.3 Admin Session vs Student Session

- Same Supabase auth flow (email + password)
- After login, app fetches `user_roles` and stores the role in a React context (`AuthContext`)
- The main navigation conditionally shows an **"Admin Panel"** link only when `role === 'admin'`
- Admin panel uses the **service role key** server-side (via Supabase Edge Functions) for operations that bypass RLS — never expose the service key in the frontend bundle

---

## 3. ADMIN PANEL LAYOUT & NAVIGATION

### 3.1 Shell Structure

The admin panel has its own layout shell, separate from the student-facing app:

```
/admin                    → redirect to /admin/dashboard
/admin/dashboard          → Overview Dashboard
/admin/scrapers           → Scraper Control Center
/admin/jobs               → Job Offers Management
/admin/students           → Student Account Management
/admin/skills             → Skills Taxonomy Editor
/admin/analytics          → Platform Analytics
/admin/settings           → System Settings
```

### 3.2 Layout Components

```
┌─────────────────────────────────────────────────────────────────┐
│  TOPBAR: Logo | "Admin Panel" badge | Notifications bell | Avatar│
├────────────────┬────────────────────────────────────────────────┤
│                │                                                 │
│   SIDEBAR      │              MAIN CONTENT AREA                 │
│                │                                                 │
│  📊 Dashboard  │   Page title + breadcrumb                      │
│  🕷️ Scrapers   │                                                 │
│  💼 Jobs       │   [Dynamic page content]                       │
│  👥 Students   │                                                 │
│  🏷️ Skills     │                                                 │
│  📈 Analytics  │                                                 │
│  ⚙️ Settings   │                                                 │
│                │                                                 │
│  ─────────     │                                                 │
│  ↩ Back to App │                                                 │
└────────────────┴────────────────────────────────────────────────┘
```

### 3.3 Design System (React + Tailwind)

- **Color palette:** Dark neutral base (`#0f0f11`, `#1a1a1f`) with electric indigo accent (`#6366f1`) and emerald for success states
- **Typography:** `Geist Mono` for data/numbers, `Sora` for headings, `Inter` for body
- **Component library:** Build on top of **shadcn/ui** (Radix primitives + Tailwind) for consistent, accessible components
- **Charts:** `Recharts` for all data visualizations
- **Icons:** `lucide-react`
- **Tables:** `@tanstack/react-table` v8 for sortable, filterable data tables
- **Toasts/alerts:** `react-hot-toast`
- **Date handling:** `date-fns`

---

## 4. PAGE SPECIFICATIONS

---

### PAGE 1 — `/admin/dashboard` — Overview Dashboard

**Purpose:** Single-glance platform health and KPI summary.

**Layout:** 4 stat cards + 2 charts + recent activity feed

#### Stat Cards (top row)
| Card | Metric | Sub-label |
|------|--------|-----------|
| 💼 | Total Jobs in DB | +N new today |
| 👥 | Registered Students | N active this week |
| 🏷️ | Skills in Taxonomy | N extracted from jobs |
| 🕷️ | Last Scrape | Timestamp + status badge |

#### Charts (middle row)
- **Left (60% width):** Line chart — Jobs scraped per day, last 30 days, one line per source (ReKrute, Indeed, LinkedIn, etc.)
- **Right (40% width):** Donut chart — Jobs distribution by source platform

#### Recent Activity Feed (bottom)
- Last 10 system events in reverse chronological order
- Each event: icon + message + timestamp
- Event types: `scraper_run`, `skill_extracted`, `student_registered`, `job_moderated`
- Pull from a `system_events` Supabase table (append-only log)

**Data sources:** All metrics fetched from Supabase on page load with `useEffect`. Add a manual **"Refresh"** button. No auto-polling for MVP.

---

### PAGE 2 — `/admin/scrapers` — Scraper Control Center

**Purpose:** Run, monitor, and debug all 6 scrapers individually or together.

#### Scraper Cards Grid (2×3 grid)

Each of the 6 scrapers (ReKrute, EmploiDiali, Emploi-public, MarocAnnonces, Indeed, LinkedIn) gets its own card showing:

- **Platform name + logo/favicon** (use `https://www.google.com/s2/favicons?domain=<url>&sz=32`)
- **Status badge:** `idle` (grey) / `running` (blue pulse) / `success` (green) / `failed` (red) / `rate-limited` (orange)
- **Last run:** relative timestamp (e.g. "2 hours ago")
- **Jobs found last run:** number
- **▶ Run** button — triggers this scraper only
- **View Logs** link — opens a slide-over panel with the last 50 log lines for this scraper

#### Global Controls (top of page)
- **"▶ Run All Scrapers"** button (primary, large) — triggers all 6 in parallel
- **"Jobs per source" slider:** 10 to 100, default 30
- **"Dry Run" toggle:** runs scrapers but does not save to DB (for testing)
- **Progress bar** shown while any scraper is running

#### Scraper Execution (How it works in React/Supabase)
- Admin clicks "Run" → React calls a **Supabase Edge Function** (`run-scraper`)
- Edge Function receives `{source: "rekrute", limit: 30}` and runs the Python scraper (or calls a separate FastAPI microservice)
- Progress is streamed back via **Supabase Realtime** — subscribe to a `scraper_logs` channel
- Logs appear in real-time in the slide-over panel

#### Log Slide-Over Panel
- Dark terminal-style panel sliding in from the right
- Monospace font (`Geist Mono`), line-by-line log output
- Color-coded: INFO (white), WARNING (yellow), ERROR (red)
- Auto-scrolls to bottom
- "Copy all logs" button

---

### PAGE 3 — `/admin/jobs` — Job Offers Management

**Purpose:** Browse, search, filter, moderate, and delete job offers in the database.

#### Toolbar
- **Search bar:** Full-text search across title, company, description
- **Filters:** Source (multi-select dropdown), Location (text), Has Skills Extracted (toggle), Date range picker
- **Sort:** By date (default desc), by title, by company
- **"Export CSV"** button — downloads filtered results

#### Data Table (TanStack Table)

Columns:
| Column | Description |
|--------|-------------|
| Checkbox | Bulk select |
| Title | Truncated to 40 chars, click to expand |
| Company | |
| Location | |
| Source | Badge with platform color |
| Skills | Number of extracted skills (chip) |
| Scraped At | Relative date |
| Actions | 👁 View · 🗑 Delete |

- **Pagination:** 25 rows per page, server-side (Supabase `.range()`)
- **Bulk actions bar** (appears when rows selected): "Delete selected", "Re-run NLP on selected"
- **Row click → Job Detail Drawer:** slides in from right showing full description, all extracted skills as tags, source URL

#### Job Detail Drawer
- Full job description in a scrollable area
- Skills tags: each tag has an ✕ to manually remove a skill, + button to add a skill manually
- "Re-extract Skills" button: re-runs NLP for just this job
- "Flag as Duplicate" button: marks the job and hides it from recommendations
- "Delete" button with confirmation modal

#### Bulk NLP Runner
- Button: **"Extract Skills for All Unprocessed Jobs"**
- Shows a progress bar: `N / total jobs processed`
- Calls a Supabase Edge Function that runs the Python NLP pipeline

---

### PAGE 4 — `/admin/students` — Student Account Management

**Purpose:** View and manage all registered student accounts.

#### Stats Row
- Total registered students
- Students with profiles (have at least 1 skill)
- Students active in last 7 days (based on last sign-in from `auth.users`)
- Most common skills across all students (top 3 pills)

#### Students Table (TanStack Table)

Columns:
| Column | Description |
|--------|-------------|
| Avatar | First letter of name, colored |
| Name | Full name from `students` table |
| Email | From `auth.users` |
| Skills Count | Number of skills in their profile |
| Joined | Registration date |
| Last Active | Last sign-in from Supabase auth |
| Actions | 👁 View · 🚫 Suspend · 🗑 Delete |

- Clicking a student opens a **Student Detail Panel:**
  - Their full skill profile (all skill tags)
  - A mini recommendation preview (top 3 matched jobs for this student)
  - Account status toggle (active / suspended)
  - "Promote to Admin" button (with confirmation modal)
  - "Reset Password" button (sends Supabase password reset email)
  - "Delete Account" button (cascade-deletes student record + auth user)

#### Role Management
- Role column visible in table: `student` or `admin` badge
- Admins can promote/demote other users (except themselves)
- Any role change is logged to `system_events`

---

### PAGE 5 — `/admin/skills` — Skills Taxonomy Editor

**Purpose:** Manage the master skills list and synonyms dictionary that drives NLP extraction.

#### Layout: Split pane

**Left pane — Skills List**
- Searchable list of all skills in `nlp/skills_taxonomy.json` (read from Supabase storage or a `taxonomy` table)
- Each skill: name + edit ✏️ + delete 🗑 icon
- "Add Skill" button at top → inline input field appears
- Skills grouped by category: Technical, Soft Skills, Domain, Tools
- Drag-to-reorder within categories

**Right pane — Synonyms Map**
- Table: `Alias → Normalized Skill`
- Examples: `ML → Machine Learning`, `IA → Intelligence Artificielle`, `JS → JavaScript`
- Add / edit / delete rows inline
- "Save Changes" button at bottom triggers a Supabase upsert + regenerates the taxonomy JSON

#### Skill Analytics Panel (below split pane)
- **Top 20 most demanded skills** bar chart (from `job_skills` table)
- **Skills missing from taxonomy** — keywords that appeared frequently in job descriptions but are not in the taxonomy (surface these as suggestions with "Add to Taxonomy" button)

---

### PAGE 6 — `/admin/analytics` — Platform Analytics

**Purpose:** Data-driven insights about the Moroccan job market and platform usage.

#### Section A — Job Market Insights

1. **Top 10 most demanded skills** — horizontal bar chart
2. **Jobs by city/region** — bar chart (Casablanca, Rabat, Marrakech, etc.)
3. **Jobs by sector/domain** — donut chart (IT, Finance, Marketing, Engineering...)
4. **Scraping trend** — area chart: jobs scraped per week, last 3 months
5. **Source comparison** — grouped bar chart: ReKrute vs EmploiDiali vs LinkedIn etc., jobs per month

#### Section B — Student Engagement

1. **New registrations per week** — line chart
2. **Profile completion rate** — gauge chart (% of users who have ≥1 skill)
3. **Most popular student skills** — word cloud (using `react-wordcloud` or SVG-rendered)
4. **Skills gap heatmap** — matrix of student skills vs job requirements: which skills are students missing most?

#### Section C — Recommendation Quality

1. **Match score distribution** — histogram: how often do students get >70% / 40–70% / <40% matches?
2. **Average match score per student** — table of top 10 and bottom 10 students by avg score

#### Filters (applied globally to section A)
- Date range picker
- Source platform multi-select
- City filter

---

### PAGE 7 — `/admin/settings` — System Settings

**Purpose:** Configure global app behavior.

#### Sections

**Scraper Settings**
- Default jobs-per-source limit (number input, saved to Supabase `app_config` table)
- Scraper delay between requests in seconds (slider 0.5s–5s)
- Auto-scrape schedule toggle + cron expression input (e.g. `0 6 * * *` = daily at 6am)
  - When enabled, a Supabase Edge Function is called on a schedule via `pg_cron`

**NLP Settings**
- Toggle: Auto-run NLP after each scrape
- Minimum keyword confidence threshold (slider 0.3–0.9)
- Language mode: French only / English only / Both

**Auth Settings**
- Toggle: Allow new student registrations (if off, invite-only)
- Toggle: Require email confirmation before login

**Danger Zone**
- "Clear All Jobs" button (with double-confirmation: type "DELETE" in input)
- "Reset All Student Skills" button
- "Drop and Recreate All Tables" button (super-admin only, disabled by default)

---

## 5. SHARED ADMIN COMPONENTS

### 5.1 `AdminGuard` HOC
```tsx
// Wraps any admin page. Redirects non-admins. Shows spinner while checking role.
// Usage: <AdminGuard><DashboardPage /></AdminGuard>
```

### 5.2 `StatCard`
```tsx
// Props: title, value, delta, deltaType ('up'|'down'|'neutral'), icon, loading
// Shows skeleton state while loading
```

### 5.3 `DataTable`
```tsx
// Built on TanStack Table
// Props: columns, data, loading, pagination, onRowClick, onSelectionChange
// Includes: search, sort, pagination controls, empty state, loading skeleton
```

### 5.4 `SlideOverPanel`
```tsx
// Slides in from right. Props: isOpen, onClose, title, width ('sm'|'md'|'lg')
// Traps focus for accessibility. Closes on Escape key and backdrop click.
```

### 5.5 `ConfirmModal`
```tsx
// Reusable destructive action confirmation.
// Props: isOpen, onConfirm, onCancel, title, message, confirmLabel, variant ('danger'|'warning')
// Optional: requireTyping (string) — user must type a phrase to confirm
```

### 5.6 `LiveLogTerminal`
```tsx
// Dark terminal-style component
// Props: logs (array of {level, message, timestamp}), isStreaming
// Auto-scrolls. Color-codes by level. "Copy" button.
```

### 5.7 `AdminBreadcrumb`
```tsx
// Shows current path: Admin > Scrapers > ReKrute
// Auto-generated from React Router location
```

---

## 6. SUPABASE ADDITIONS NEEDED

### New Tables

```sql
-- System event log (append-only)
create table system_events (
  id uuid primary key default uuid_generate_v4(),
  event_type text not null,
  message text,
  metadata jsonb,
  actor_id uuid references auth.users(id),
  created_at timestamp with time zone default now()
);

-- Scraper run history
create table scraper_runs (
  id uuid primary key default uuid_generate_v4(),
  source text not null,
  status text not null check (status in ('running', 'success', 'failed', 'rate_limited')),
  jobs_found integer default 0,
  jobs_saved integer default 0,
  error_message text,
  started_at timestamp with time zone default now(),
  finished_at timestamp with time zone
);

-- App configuration key-value store
create table app_config (
  key text primary key,
  value jsonb not null,
  updated_at timestamp with time zone default now(),
  updated_by uuid references auth.users(id)
);

-- Seed default config
insert into app_config (key, value) values
  ('scraper_limit_per_source', '30'),
  ('scraper_delay_seconds', '1.5'),
  ('nlp_confidence_threshold', '0.5'),
  ('auto_run_nlp', 'true'),
  ('allow_registrations', 'true'),
  ('nlp_language', '"both"');
```

### New Edge Functions

| Function | Trigger | Purpose |
|----------|---------|---------|
| `run-scraper` | HTTP POST | Runs one or all scrapers, streams logs via Realtime |
| `run-nlp` | HTTP POST | Runs NLP extraction on unprocessed jobs |
| `delete-user` | HTTP POST | Deletes auth user + cascade (requires service key) |
| `export-jobs-csv` | HTTP GET | Generates and returns CSV of filtered jobs |
| `check-admin` | HTTP GET | Returns `{isAdmin: boolean}` for the calling user |

---

## 7. REACT FILE STRUCTURE (Admin section)

```
src/
├── admin/
│   ├── AdminApp.tsx              ← Admin router shell with sidebar layout
│   ├── AdminGuard.tsx            ← Role check + redirect HOC
│   │
│   ├── pages/
│   │   ├── DashboardPage.tsx
│   │   ├── ScrapersPage.tsx
│   │   ├── JobsPage.tsx
│   │   ├── StudentsPage.tsx
│   │   ├── SkillsPage.tsx
│   │   ├── AnalyticsPage.tsx
│   │   └── SettingsPage.tsx
│   │
│   ├── components/
│   │   ├── layout/
│   │   │   ├── AdminSidebar.tsx
│   │   │   ├── AdminTopbar.tsx
│   │   │   └── AdminBreadcrumb.tsx
│   │   ├── shared/
│   │   │   ├── StatCard.tsx
│   │   │   ├── DataTable.tsx
│   │   │   ├── SlideOverPanel.tsx
│   │   │   ├── ConfirmModal.tsx
│   │   │   ├── LiveLogTerminal.tsx
│   │   │   └── PageHeader.tsx
│   │   └── domain/
│   │       ├── ScraperCard.tsx
│   │       ├── JobDetailDrawer.tsx
│   │       ├── StudentDetailPanel.tsx
│   │       ├── SkillTagEditor.tsx
│   │       └── TaxonomyEditor.tsx
│   │
│   └── hooks/
│       ├── useAdminGuard.ts
│       ├── useScraperRun.ts
│       ├── useRealtimeLogs.ts
│       └── useAppConfig.ts
│
├── router.tsx                    ← Add /admin/* routes here
└── contexts/
    └── AuthContext.tsx           ← Add role field to user context
```

---

## 8. ROUTING SETUP (`src/router.tsx`)

```tsx
// Add to existing React Router setup:

import { AdminGuard } from '@/admin/AdminGuard'
import { AdminApp } from '@/admin/AdminApp'

// Inside <Routes>:
<Route
  path="/admin/*"
  element={
    <AdminGuard>
      <AdminApp />
    </AdminGuard>
  }
/>
```

Inside `AdminApp.tsx`, use nested `<Routes>` for all admin sub-pages.

---

## 9. DEPENDENCIES TO ADD

```bash
npm install @tanstack/react-table recharts react-hot-toast date-fns lucide-react
npm install @radix-ui/react-dialog @radix-ui/react-dropdown-menu @radix-ui/react-tabs
npm install @radix-ui/react-slider @radix-ui/react-switch @radix-ui/react-tooltip
```

If not already installed:
```bash
npm install @supabase/supabase-js
npm install react-router-dom
```

Optional but recommended:
```bash
npm install react-wordcloud      # for skills word cloud on analytics page
npm install @dnd-kit/core        # for drag-to-reorder in taxonomy editor
```

---

## 10. SECURITY CHECKLIST

- [ ] All admin routes wrapped in `AdminGuard` — redirect non-admins at component level
- [ ] All Supabase queries inside admin pages use RLS — even if the frontend guard is bypassed, the DB rejects unauthorized reads/writes
- [ ] Service role key is **never** in the React bundle — only used inside Edge Functions
- [ ] "Danger Zone" actions require typing a confirmation phrase, not just clicking OK
- [ ] Role changes are logged to `system_events` with the actor's user ID
- [ ] `is_admin()` SQL function used in RLS policies for all admin-only tables
- [ ] Admin panel is only linked/visible when `role === 'admin'` in `AuthContext`
- [ ] Password reset and account deletion go through Supabase Edge Functions (server-side), not direct client calls

---

## 11. FIRST PROMPTS TO BUILD THE ADMIN PANEL

Use these in order in Antigravity (Planning Mode, Claude Sonnet model):

---

**Prompt 1 — Foundation**
```
@PRD_JobOffers_MVP.md

Set up the admin panel foundation:
1. Create src/admin/ folder structure as defined in the feature spec
2. Implement AdminGuard.tsx — fetches user role from Supabase user_roles table,
   redirects to '/' if not admin, shows full-page spinner while loading
3. Add the admin role SQL to schema.sql (user_roles table + is_admin() function + RLS policies)
4. Add /admin/* routes to the existing React Router setup
5. Update AuthContext to include the user's role field
```

**Prompt 2 — Layout Shell**
```
Implement the AdminApp.tsx layout shell with:
- Dark sidebar (bg #0f0f11) with navigation links for all 7 admin pages
- Each nav item: icon (lucide-react) + label + active state highlight
- Topbar: "Admin Panel" badge, notifications bell icon, user avatar with dropdown (Profile / Back to App / Sign Out)
- AdminBreadcrumb component auto-generated from current route
- Responsive: sidebar collapses to icon-only on md screens, hidden on mobile (hamburger toggle)
- Use Sora font for headings, Geist Mono for data, Inter for body
- Color scheme: dark base (#0f0f11, #1a1a1f) with indigo accent (#6366f1)
```

**Prompt 3 — Dashboard Page**
```
Implement /admin/dashboard with:
- 4 StatCard components (total jobs, registered students, skills in taxonomy, last scrape status)
- Line chart (Recharts): jobs scraped per day last 30 days, one colored line per source
- Donut chart (Recharts): job distribution by source
- Recent activity feed from system_events Supabase table (last 10 events)
- All data fetched from Supabase on mount, loading skeletons while fetching
- Manual Refresh button
```

**Prompt 4 — Scrapers Page**
```
Implement /admin/scrapers with:
- 6 scraper cards in a 2x3 grid, one per platform
- Each card: platform name + favicon, status badge, last run time, jobs found count, Run button
- "Run All Scrapers" primary button at top with jobs-per-source slider (10-100)
- Dry Run toggle
- LiveLogTerminal slide-over panel: dark terminal, monospace font, color-coded by log level, auto-scroll
- Scraper execution calls a Supabase Edge Function 'run-scraper'
- Real-time log streaming via Supabase Realtime channel 'scraper_logs'
- Status updates reflected on cards in real-time
```

**Prompt 5 — Jobs Management Page**
```
Implement /admin/jobs with:
- TanStack Table v8 with server-side pagination (25 rows, Supabase .range())
- Columns: checkbox, title, company, location, source badge, skills count, scraped_at, actions
- Toolbar: full-text search, source filter, has-skills toggle, date range, export CSV button
- Row click → JobDetailDrawer (slide-over): full description, skill tags with add/remove, Re-extract Skills button
- Bulk actions bar when rows selected: delete selected, re-run NLP on selected
- ConfirmModal for all destructive actions
```

**Prompt 6 — Students, Skills, Analytics, Settings Pages**
```
Implement the remaining 4 admin pages:

1. /admin/students: Students table with TanStack Table, StudentDetailPanel slide-over,
   role promotion/demotion, password reset and delete actions

2. /admin/skills: Split-pane taxonomy editor — searchable skills list (left) + synonyms
   table (right) + top skills bar chart below

3. /admin/analytics: 3 sections (Job Market, Student Engagement, Recommendations Quality)
   with Recharts charts as specified — bar, donut, area, histogram, word cloud

4. /admin/settings: Grouped settings form with toggle switches, sliders, number inputs —
   reads/writes from Supabase app_config table — Danger Zone section at bottom with
   requireTyping confirmation modals
```
