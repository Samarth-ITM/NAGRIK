# Nagrik (नागरिक)

> Civic Intelligence & Grievance Coordination Platform for Sector 4, Kharghar, Navi Mumbai.

Nagrik is a Telegram-first civic reporting and accountability platform. Citizens report local public-infrastructure problems via a guided Telegram bot. Reports are stored as individual citizen submissions and linked, after human review, to a physical spot. A web application provides a public information layer, a private super-admin control centre, and organisation-specific authority dashboards.

---

## Technical Stack

- **Framework:** Next.js (App Router) + TypeScript + React
- **Styling:** Tailwind CSS + Accessible Components
- **Hosting Target:** Vercel
- **Database & Storage:** Supabase (Postgres, Auth, Storage, RLS)
- **Reporting Interface:** Telegram Bot API Webhook
- **Geospatial Engine:** Deterministic Haversine distance anchor matching (no AI)
- **AI (Optional):** Google Gemini (server-side, reviewer-triggered, advisory only)

---

## Repository Structure

```text
nagrik/
├── docs/
│   ├── docs/                  # Read-only source specifications (PRD, TRD)
│   └── build-reports/         # Phase execution and verification reports
├── public/                    # Static assets & favicon
├── src/
│   ├── app/                   # Next.js App Router (public, auth, dashboard, api)
│   ├── components/            # UI, layout, and shared components
│   ├── features/              # Feature modules (auth, reports, issues, etc.)
│   ├── lib/                   # Supabase, Telegram, Gemini, Geospatial, Taxonomy
│   └── types/                 # Shared domain TypeScript interfaces
├── supabase/
│   ├── migrations/            # SQL migration scripts
│   └── seed/                  # Seed scripts for isolated demo tenant
├── scripts/                   # Operational and utility scripts
├── tests/                     # Reserved for Phase 7 automated testing
├── AGENTS.md                  # Permanent agent execution rules
└── .env.example               # Safe environment variable template
```

---

## Getting Started

### 1. Prerequisites
- Node.js >= 20
- npm >= 10

### 2. Setup
```bash
# Clone the repository
git clone <repo-url>
cd NAGRIK

# Install dependencies
npm install

# Copy environment template
cp .env.example .env.local
```

### 3. Development
```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) for the public landing skeleton and [http://localhost:3000/api/health](http://localhost:3000/api/health) for the health check endpoint.

### 4. Build & Lint
```bash
npm run lint
npm run build
```

---

## Governance & Phase Status
Nagrik is implemented across 8 disciplined phases:
1. **PHASE 1:** Foundation and repository architecture (`VERIFIED`)
2. **PHASE 2:** Public website and illustrative experience
3. **PHASE 3:** Database, authentication, roles and dashboards
4. **PHASE 4:** Civic reporting, physical issue matching, evidence and resolution workflow
5. **PHASE 5:** Telegram bot and citizen reporting integration
6. **PHASE 6:** Optional Gemini integration
7. **PHASE 7:** Full testing, security and system validation
8. **PHASE 8:** Deployment and production verification
