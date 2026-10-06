# The Youth Matters (TYM)

A community for students planning to study abroad. Ask questions and get answers from people who made the
move last year, join country communities and live chatrooms, get private help from an AI counsellor, and book
paid one-to-one sessions with verified student mentors.

Study Abroad is the first subject, with communities for the United Kingdom, United States, Canada, Australia,
Ireland and Germany. Career, Education, Entrepreneurship and Life & Experiences follow on the same
structure: **Subject → Country → Chat rooms and discussions → Mentors and content**.

---

## Contents

- [Features](#features)
- [Tech stack](#tech-stack)
- [Quick start](#quick-start)
- [Configuration](#configuration)
- [Project structure](#project-structure)
- [How the key flows work](#how-the-key-flows-work)
- [API reference](#api-reference)
- [Development](#development)
- [Deployment](#deployment)
- [Roadmap](#roadmap)

---

## Features

| Area | What it does |
|---|---|
| **Community** | Questions and answers per country and topic, Hot / Top / New sorting, voting, threaded answers. Visitors see a preview, members see everything. |
| **Country pages** | A page per destination with its discussions, live chatroom, mentors who studied there and a link to the official visa rules. |
| **Chatrooms** | Live rooms per country, with `@TYMAi` for quick answers. Members only. |
| **AI Lounge** | Private one-to-one help with SOPs, visas and shortlists. Members only. |
| **Sign-up and 18+ check** | Email and password with a 6-digit email code, or Google. The date of birth is read from a photo ID (OCR); 18 or over verifies the account. The photo is never stored. |
| **Mentors** | Profiles with photos, topics, languages and reviews. A booking calendar shows times in your own time zone. |
| **Payments** | Razorpay checkout with a 15 minute slot hold, signature verification, webhook confirmation, refunds on cancellation and receipts. |
| **My TYM** | Your profile, questions and answers, plus upcoming and past mentor sessions (join link, add to calendar, cancel, review). |
| **Blog** | Long-form guides with a reading progress bar, table of contents, interactive checklists, FAQs and structured data for search engines. |
| **Contact** | Contact form and mentor applications, emailed to the team. |

Design: a monochrome, editorial look (Newsreader serif headlines, Geist text, black-and-white photography),
responsive from 320px phones to wide desktops.

## Tech stack

| Layer | Technology |
|---|---|
| Website | React 18, Vite, React Router, plain CSS with design tokens, lucide-react icons |
| API | Python 3.12, Flask, Flask-SQLAlchemy, Flask-Migrate (Alembic), Flask-JWT-Extended, Flask-SocketIO, Flask-Limiter |
| Database | PostgreSQL (full-text search, partial unique indexes), Redis for rate limits and sockets in production |
| Age check | RapidOCR (ONNX) reads the date of birth from a photo ID |
| Payments | Razorpay (Orders API, Checkout, webhooks, refunds) |
| Email | Resend |
| Files | DigitalOcean Spaces (S3 compatible), local folder in development |
| Hosting | DigitalOcean: Gunicorn + gevent, Nginx, TLS, managed PostgreSQL and Redis |

## Quick start

Requirements: **Python 3.12+** and **Node.js 20+**. No PostgreSQL install is needed.

```bash
git clone https://github.com/theyouthmatters26/The-Youth-Matters.git
cd The-Youth-Matters
cp .env.example .env        # then set SECRET_KEY and JWT_SECRET_KEY to long random strings
python run.py
```

Open **http://localhost:5173**. The API runs on **http://localhost:5000** (`GET /api/health`).

`run.py` does everything in one command:

1. Creates the Python virtual environment and installs backend packages (again whenever `requirements.txt` changes).
2. Installs the website packages.
3. Starts an embedded PostgreSQL in `.pgdata/` (or uses `DATABASE_URL` from `.env` if you set one).
4. Applies database migrations and seeds demo content: countries, communities, posts, six mentors with
   weekly hours and reviews.
5. Starts the API and the website, and stops both cleanly with `Ctrl+C`.

```bash
python run.py --reset       # start again with a fresh local database
```

**Demo login:** `aisha.k@example.com` / `tym-demo-2026` (every seeded `@example.com` account uses the same password).

In development, when no email provider is configured, the sign-up page shows the 6-digit code on screen so
you can finish signing up locally.

## Configuration

All settings live in one `.env` file at the project root, shared by the API and the website. Copy
`.env.example` to start. Only variables starting with `VITE_` are sent to the browser. `.env` is never
committed.

| Variable | Purpose |
|---|---|
| `SECRET_KEY`, `JWT_SECRET_KEY` | Long random strings. Changing them signs everyone out. |
| `DATABASE_URL` | Leave empty for the embedded local database; set it for Docker or a real server. |
| `REDIS_URL` | Leave empty in development (rate limits in memory); set it in production. |
| `CORS_ORIGINS` | Allowed website origins, comma separated. |
| `SPACES_*` | DigitalOcean Spaces for uploads. Empty key = files stay in `backend/instance/private`. |
| `RESEND_API_KEY`, `MAIL_FROM` | Email sending (codes, booking confirmations). |
| `CONTACT_EMAIL` | Where the contact form and mentor applications are sent. |
| `GOOGLE_CLIENT_ID`, `VITE_GOOGLE_CLIENT_ID` | Google sign-in (same OAuth client ID in both). |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` | Razorpay API keys. Test keys (`rzp_test_...`) work end to end. |
| `RAZORPAY_WEBHOOK_SECRET` | Secret of the Razorpay webhook (see [Deployment](#deployment)). |
| `ANTHROPIC_API_KEY`, `AI_MODEL` | Claude API key for TYMAi (Ask TYM AI and `@TYMAi` in chat rooms). Without a key, TYMAi answers from what the community already said. The model defaults to `claude-opus-5-5`. |

## Project structure

```
backend/                     Flask API
  app/
    api/                     One blueprint per module, all under /api
                             (auth, verify, posts, comments, mentors, bookings, contact, ...)
    models/                  SQLAlchemy models, one file per domain
    services/                Business logic
      identity.py              Reads the date of birth from a photo ID (OCR)
      payments.py              Razorpay orders, signatures, refunds
      availability.py          Weekly hours -> bookable slots (time zone and DST safe)
      ranking.py, moderation.py, storage.py, mailer.py
    sockets/                 SocketIO events for chatrooms
  tests/                     pytest
  wsgi.py                    Entry point for Gunicorn
frontend/                    Website (React + Vite)
  public/                    Images, logo, robots.txt, sitemap.xml
  src/
    components/              layout/, ui/, auth/, mentors/, blog/, feed/, home/, post/
    pages/                   One file per route; auth/ and static/ grouped
    data/blogs/              One file per blog article (add a file to publish it)
    data/sample.js           Demo content for pages not yet on the API
    lib/                     API client, auth session, page metadata (SEO), formatting
    styles/                  tokens.css (palette, type, spacing), base.css, pages.css
database/
  migrations/                Alembic migrations
  seed.py                    Reference data and demo content (safe to re-run)
run.py                       One-command local runner
docker-compose.yml           Optional local PostgreSQL + Redis
.env.example                 Settings template
```

## How the key flows work

**Sign-up and age verification.** Account → 6-digit email code → photo ID. The member takes a photo of
their passport, driving licence or national ID, or uploads one. The API reads the date of birth (passport
machine-readable zone first, then the date-of-birth field), refuses under-18s and verifies everyone else
straight away. The photo is only read in memory and never stored; the account keeps the date of birth. The
account stays limited until this step is done.

**Members-only access.** Visitors can read the home page, country pages (first two discussions), mentor
profiles, the blog and the help pages. The AI Lounge, chatrooms, asking questions, notifications and booking
need a verified account. Visitors are sent to log in and brought back to where they were going.

**Booking and payment.** The calendar shows each mentor's open times in the visitor's time zone. Choosing a
time holds the slot for 15 minutes and creates a Razorpay order. After checkout the API verifies Razorpay's
signature before confirming. The webhook confirms the same payment if the browser closes early. A database
constraint prevents double booking; if a slot was taken while a payment was pending, the money is refunded
automatically. Students can cancel up to 24 hours before for a full refund, and review the session afterwards.

**Blog.** Each article is a file in `frontend/src/data/blogs/`, written as typed blocks (paragraphs, tables,
stats, steps, checklists, FAQs). Reading time, the table of contents, page title, description, canonical URL
and structured data (Article, FAQ, breadcrumbs) are built from it automatically.

## API reference

All routes are under `/api`. Response shapes are defined once in `backend/app/api/serializers.py`.

| Area | Routes |
|---|---|
| Health | `GET /health` |
| Auth | `POST /auth/register`, `/auth/resend-code`, `/auth/verify-email`, `/auth/login`, `/auth/google`, `/auth/refresh`, `/auth/forgot-password`, `/auth/reset-password`, `GET /auth/me` |
| Age check | `POST /verify/document` (photo ID, verifies the account when 18+) |
| Communities | `GET /subjects`, `GET /subjects/<subject>/communities`, `GET /subjects/<subject>/communities/<country>`, `GET /categories` |
| Posts | `GET /posts?sort=hot\|top\|new&subject=&country=&category=&page=`, `GET /posts/<id>`, `GET /posts/<id>/comments` |
| Search | `GET /search?q=` |
| Mentors | `GET /mentors?country=&university=&course=`, `GET /mentors/<id>`, `GET /mentors/<id>/availability` |
| Bookings | `POST /bookings`, `POST /bookings/<id>/verify`, `GET /bookings`, `POST /bookings/<id>/cancel`, `POST /bookings/<id>/review` |
| Payments | `POST /payments/razorpay/webhook` |
| Blog | `GET /blogs`, `GET /blogs/<slug>` |
| Contact | `POST /contact` |

Authentication uses JWT bearer tokens (`Authorization: Bearer <access>`), refreshed with `POST /auth/refresh`.
Sensitive routes are rate limited.

## Development

```bash
# Backend tests
cd backend
.venv/Scripts/python -m pytest -q          # Windows   (macOS/Linux: .venv/bin/python)

# After changing a model, create and apply a migration
.venv/Scripts/python -m flask db migrate -m "describe the change"
.venv/Scripts/python -m flask db upgrade

# Production build of the website
cd ../frontend
npm run build
```

Conventions:

- Page-level styles live in `frontend/src/styles/pages.css`; component styles sit next to their component.
- Colours, type sizes, spacing and radii come from `frontend/src/styles/tokens.css`.
- Response shapes come from `serializers.py` only, so every endpoint returns the same structures.
- Copy is plain British English in sentence case, without exclamation marks.

## Deployment

1. Create a managed PostgreSQL and Redis and a Spaces bucket on DigitalOcean, and fill `.env` with their
   details, strong secrets, Resend and Razorpay live keys, and `VITE_SITE_URL` (your public domain).
2. Build the website with `npm run build` and serve `frontend/dist` with Nginx (send unknown routes to
   `index.html`, proxy `/api` and `/socket.io` to the API).
3. Run the database migrations: `flask db upgrade`.
4. Start the API with Gunicorn:
   ```bash
   gunicorn -k geventwebsocket.gunicorn.workers.GeventWebSocketWorker -w 1 --bind 0.0.0.0:8000 wsgi:app
   ```
5. In the Razorpay dashboard add a webhook to `https://<your-domain>/api/payments/razorpay/webhook` for the
   `payment.captured` and `order.paid` events, and put its secret in `RAZORPAY_WEBHOOK_SECRET`.
6. Update the domain in `frontend/public/robots.txt` and `sitemap.xml` if it is not `theyouthmatters.org`.

## Roadmap

| Phase | Scope | Status |
|---|---|---|
| 1 | Structure, database schema, API skeleton, full public website | Done |
| 2 | Accounts (email code, Google, photo ID 18+ check) | Done |
| 2 | Posting questions and answers, voting, following, feed, notifications on the API | Next |
| 3 | Admin panel: analytics, verification reviews, bans, reports queue, categories | Planned |
| 4 | Real-time chat, AI Lounge, `@TYMAi`, 6-hour AI fallback, AI moderation, 3-strike system | Planned |
| 5 | Mentor availability, bookings, Razorpay payments, refunds and reviews | Done |
| 5 | Mentor portal (manage hours, prices and payouts) | Planned |
| 6 | DigitalOcean deployment, backups and monitoring | Planned |

---

© 2026 The Youth Matters. All rights reserved.
