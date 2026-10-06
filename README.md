# The Youth Matters (TYM)

Study abroad community: Q&A, country hubs, live chatrooms, an AI counsellor and paid mentor bookings.
Stack: React (Vite) · Python Flask + Flask-SocketIO · PostgreSQL · Redis · DigitalOcean.

## Run everything

```bash
python run.py           # installs what is missing, migrates, seeds, starts API + website
python run.py --reset   # same, with a fresh local database
```

Then open http://localhost:5173. The API runs on http://localhost:5000 (`/api/health`).

Needs Python 3.12+ and Node 20+. Settings live in one `.env` at the project root, shared by the
backend and the website (copy `.env.example` to `.env`; only `VITE_` variables reach the browser).
No Postgres install is required: if `.env` has no `DATABASE_URL`, `run.py` starts an embedded
PostgreSQL in `.pgdata/`. To use Docker instead, run `docker compose up -d`, set `DATABASE_URL`
in `.env`, and run `python run.py`.

## Layout

```
backend/            Flask API
  app/
    models/         SQLAlchemy models, one file per domain (user, post, comment, vote, ...)
    api/            One blueprint per SRS module, all under /api
    services/       Business logic: ranking, moderation, storage (Spaces), mailer
    sockets/        SocketIO events for chatrooms
  tests/            pytest
frontend/           Public website (React)
  src/
    components/     layout/, ui/, feed/, post/, home/
    pages/          One file per route; auth/ and static/ grouped
    data/sample.js  Demo data until the API is wired in (Phase 2)
    styles/         tokens.css (palette, type), base.css, pages.css
database/
  migrations/       Alembic (Flask-Migrate) migrations
  seed.py           Countries, categories, demo users/posts
docs/api.md         API route map and phase status
run.py              One-command local runner
```

`admin/` (admin panel, a separate React app) is added in Phase 3.

## Common tasks

```bash
cd backend
.venv/Scripts/python -m pytest -q                              # tests
.venv/Scripts/python -m flask db migrate -m "describe change"  # after editing models
cd ../frontend && npm run build                                # production build
```

## Payments (Razorpay)

Mentor sessions are paid through Razorpay. Put your keys in `.env` (`RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`);
test keys (`rzp_test_...`) work end to end with Razorpay's test cards and UPI. In the Razorpay dashboard add a
webhook to `https://<your-domain>/api/payments/razorpay/webhook` for `payment.captured` and `order.paid`, and put
its secret in `RAZORPAY_WEBHOOK_SECRET`. Without keys the booking calendar works and the pay step says payments
are not switched on yet.

## Blog articles

Each article is one file in `frontend/src/data/blogs/`, written as typed blocks (paragraphs, tables, stats,
checklists, FAQs). Add a file and it is published; reading time, table of contents and search metadata are built
from it.

## Phases

1. Structure, schema, Flask skeleton, full public frontend on sample data **(done)**
2. Core APIs: auth **(done: email code, Google, photo ID + live selfie 18+ check)**, posts, comments, votes, follows, feed, search, notifications
3. Admin panel: analytics, user and selfie review, bans, reports queue, categories
4. Real-time chat, AI Lounge, `@TYMAi`, 6-hour AI fallback, Hugging Face moderation, 3-strike system
5. Mentor availability, bookings, Razorpay payments, refunds and reviews **(done)**
6. DigitalOcean deployment: Gunicorn + Nginx + TLS, managed Postgres/Redis, Spaces, daily backups
