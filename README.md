# The Youth Matters (TYM)

TYM is a community for students who are planning to study abroad. The idea is simple: the best advice
comes from someone who made the same move last year. So students ask questions, people who have been
through it answer, and when a question needs more than a reply, there is a mentor to book or an AI
assistant to ask.

Study Abroad is the first subject, with communities for the United Kingdom, United States, Canada,
Australia, Ireland and Germany. Career, Education, Entrepreneurship and Life & Experiences will follow
on the same structure: **subject → country → questions and chat rooms → mentors**.

## Contents

- [What is in it](#what-is-in-it)
- [How it is built](#how-it-is-built)
- [Run it on your computer](#run-it-on-your-computer)
- [Settings](#settings)
- [How the main parts work](#how-the-main-parts-work)
- [Project layout](#project-layout)
- [API at a glance](#api-at-a-glance)
- [Working on the code](#working-on-the-code)
- [Going live](#going-live)
- [What is done and what is next](#what-is-done-and-what-is-next)

## What is in it

**For students**

- **Ask and answer.** Post a question with up to four photos, pick a country and a topic, and get
  threaded answers. Vote, save, share, and mark the answer that helped. While you type a title, TYM
  shows similar questions that already have answers.
- **A feed that fits you.** Sort by Hot, Top, New or Unanswered. Join the countries you care about and
  your dashboard fills with their questions.
- **Chat rooms.** One room per country and one open room. Messages are saved, and typing `@TYMAi` gets
  a quick answer from the assistant.
- **Ask TYM AI.** Private one-to-one help with SOPs, visas and shortlists. Conversations are saved so
  you can come back to them.
- **Mentors.** Browse verified student mentors, see their open times in your own time zone, pay through
  Razorpay and meet on a video call. You can cancel for a refund and leave a review afterwards.
- **Your profile.** Photo, cover, bio, university, course and intake, plus everything you asked,
  answered and saved.
- **Notifications.** A bell for answers, replies, mentions and upvotes.
- **Guides.** Long-form blog articles with checklists, tables and FAQs.

**For mentors**

- **Apply in one page.** Photo, studies, profile, session length and price, weekly hours on a timetable,
  a CV and proof of enrolment or degree.
- **Go live on approval.** Once the team approves, the profile is listed and bookable straight away.

**For safety**

- **18+ only.** Every account reads a date of birth from a photo ID. The photo itself is never stored.
- **Members only where it matters.** Visitors can read a preview. Asking, chatting, the AI and booking
  need a verified account.
- **Reports.** Any question, answer or profile can be reported to the team.

The design is monochrome and editorial: serif headlines, black-and-white photography, and layouts that
work from a 320px phone to a wide desktop.

## How it is built

| Part | Technology |
|---|---|
| Website | React 18, Vite, React Router, plain CSS with design tokens |
| API | Python 3.12, Flask, SQLAlchemy, Alembic migrations, JWT sign-in, rate limiting |
| Database | PostgreSQL (full-text search), Redis in production for rate limits |
| Age check | RapidOCR reads the date of birth from a photo ID |
| AI assistant | Claude, through the Anthropic API |
| Payments | Razorpay (orders, checkout, webhooks, refunds) |
| Email | Resend |
| Uploads | DigitalOcean Spaces in production, a local folder in development |
| Hosting | DigitalOcean with Gunicorn and Nginx |

## Run it on your computer

You need **Python 3.12+**, **Node.js 20+** and **Docker Desktop** (for the database).

**1. Get the code and create your settings file**

```bash
git clone https://github.com/theyouthmatters26/The-Youth-Matters.git
cd The-Youth-Matters
cp .env.example .env          # Windows: copy .env.example .env
```

You can leave every value in `.env` blank to start. The defaults are enough to run locally.

**2. Start the database**

```bash
docker compose up -d
```

This starts PostgreSQL and Redis with the login the API expects by default. If you would rather use
your own PostgreSQL, put its address in `DATABASE_URL` and skip this step.

**3. Start the API**

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate         # macOS and Linux: source .venv/bin/activate
pip install -r requirements-dev.txt
flask --app wsgi db upgrade    # creates the tables
python ../database/seed.py     # adds demo countries, questions, chat and mentors
python wsgi.py
```

The API is now on **http://localhost:5000**. `http://localhost:5000/api/health` should say `ok`.

**4. Start the website** (in a second terminal)

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173**.

**Demo accounts.** Every seeded account uses the password `tym-demo-2026`.

| Account | Use it to |
|---|---|
| `aisha.k@example.com` | See the site as a student |
| `priya.s@example.com` | See the site as a mentor |
| `tym.team@example.com` | Act as the team, for example to approve mentor applications |

Until email is switched on, the sign-up page shows the 6-digit code on screen so you can finish signing
up locally.

## Settings

Everything is set in one `.env` file at the project root, shared by the API and the website. It is never
committed. Only names that start with `VITE_` are sent to the browser.

**Nothing here is required to run locally.** Fill a setting in when you want that feature to be real.

| Setting | What it is for | If you leave it blank |
|---|---|---|
| `SECRET_KEY`, `JWT_SECRET_KEY` | Long random strings that sign sessions. Changing them signs everyone out. | A development key is used. Always set these in production. |
| `DATABASE_URL` | Where PostgreSQL lives, for example `postgresql+psycopg://user:pass@host:5432/tym`. | The `docker compose` database is used. |
| `REDIS_URL` | Redis, for rate limits across several servers. | Rate limits are kept in memory. |
| `CORS_ORIGINS` | Website addresses allowed to call the API, separated by commas. | `http://localhost:5173` |
| `SPACES_ENDPOINT`, `SPACES_REGION`, `SPACES_KEY`, `SPACES_SECRET`, `SPACES_BUCKET` | DigitalOcean Spaces for photos and documents. | Files are kept in `backend/instance/private`. |
| `RESEND_API_KEY` | Sends email: sign-up codes, booking confirmations, contact messages. | No email is sent. |
| `MAIL_FROM` | The "from" name and address on those emails. | `The Youth Matters <no-reply@theyouthmatters.org>` |
| `CONTACT_EMAIL` | Where the contact form and mentor applications are sent. | `hello@theyouthmatters.org` |
| `GOOGLE_CLIENT_ID`, `VITE_GOOGLE_CLIENT_ID` | Google sign-in. The same client ID goes in both. | The Google button says it is not switched on yet. |
| `GOOGLE_CLIENT_SECRET` | Not used by the sign-in flow. | Nothing changes. |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` | Mentor session payments. Test keys (`rzp_test_...`) work end to end without real money. | Bookings cannot be paid for. |
| `RAZORPAY_WEBHOOK_SECRET` | Lets Razorpay confirm a payment even if the browser closes early. | Payments are confirmed from the browser only. |
| `ANTHROPIC_API_KEY` | Lets TYM AI write its own answers with Claude. | TYM AI replies with what students in the community already said. |
| `AI_MODEL` | Which Claude model to use. | `claude-opus-5-5` |
| `VITE_SITE_URL` | Your public address, used in links for search engines. | The address the site is opened on. |
| `FLASK_APP` | Only needed if you run `flask` commands without `--app wsgi`. | Nothing changes. |

### Switching on Google sign-in

1. In Google Cloud Console, create an **OAuth client ID** of type **Web application**.
2. Under **Authorized JavaScript origins** add `http://localhost:5173` and `http://localhost`. Add your
   real domain when you go live. Leave the redirect URIs empty.
3. Paste the client ID into both `GOOGLE_CLIENT_ID` and `VITE_GOOGLE_CLIENT_ID`, then restart the API and
   the website.

While the Google app is in testing, only the test users you add there can sign in.

## How the main parts work

**Signing up and the age check.** Create an account, confirm a 6-digit email code (or use Google), then
take or upload a photo of a passport, driving licence or national ID. The API reads the date of birth,
turns away anyone under 18 and verifies everyone else straight away. The photo is read in memory and
never saved. Until this step is done the account can look around but not take part.

**Questions and answers.** Posts and answers are plain text, cleaned on the way in. Each person gets one
vote per post or answer, and scores are updated in the database in a single step so two votes at once
cannot lose one. "Hot" balances score against age, the same way Reddit does. The person who asked can
mark the answer that helped, and it moves to the top.

**Chat rooms.** Messages are saved in the database and the page checks for new ones every few seconds.
A message that mentions `@TYMAi` gets a reply from the assistant in the same room.

**TYM AI.** Every answer starts from the community: the API finds the closest answered questions for the
right country. With an Anthropic key, Claude writes the reply using those answers and the student's
profile, and links to the questions it drew on. Without a key, TYM AI shows those community answers
directly, so it is still useful on a fresh install.

**Becoming a mentor.** A signed-in, verified member fills in the application. The CV and proof of study
are stored privately and only the team can open them. When the team approves, the application becomes a
live mentor profile with bookable times.

**Booking and paying.** The calendar shows a mentor's open times in the visitor's own time zone.
Choosing a time holds it for 15 minutes and creates a Razorpay order. The API checks Razorpay's
signature before confirming. The database refuses double bookings, and if a slot was taken while a
payment was pending, the money is refunded automatically. Students can cancel up to 24 hours before for
a full refund.

**Blog.** Each article is one file in `frontend/src/data/blogs/`. Reading time, the table of contents
and the search-engine details are worked out from it.

## Project layout

```
backend/                       The API (Flask)
  app/
    api/                       One file per area, all served under /api
    models/                    Database tables, one file per area
    services/                  The logic behind the routes
      identity.py                Reads the date of birth from a photo ID
      tymai.py                   The AI assistant: finds community answers, asks Claude
      payments.py                Razorpay orders, signatures and refunds
      availability.py            Weekly hours into bookable times, time-zone safe
      content.py, images.py      Cleans text, resizes photos and strips their location data
      notify.py, mailer.py       In-app notifications and email
      ranking.py, storage.py     Hot ranking, file storage
  tests/                       pytest
  wsgi.py                      Starts the API
frontend/                      The website (React + Vite)
  public/                      Images, logo, robots.txt, sitemap.xml
  src/
    components/                auth, blog, feed, home, layout, mentors, post, ui
    pages/                     One file per page
    data/blogs/                One file per blog article
    lib/                       API client, sign-in session, formatting, page titles
    styles/                    tokens.css (colours, type, spacing), base.css, pages.css
database/
  migrations/                  Database changes, in order
  seed.py                      Demo countries, people and mentors (safe to run again)
  demo_posts.py, demo_chat.py  Demo questions, answers and chat messages
docker-compose.yml             Local PostgreSQL and Redis
.env.example                   The list of settings, all blank
```

## API at a glance

Every route is under `/api`. Signed-in requests send `Authorization: Bearer <token>`, and tokens are
renewed with `POST /auth/refresh`. Sensitive routes are rate limited.

| Area | Routes |
|---|---|
| Health | `GET /health` |
| Accounts | `POST /auth/register`, `/auth/resend-code`, `/auth/verify-email`, `/auth/login`, `/auth/google`, `/auth/refresh`, `/auth/forgot-password`, `/auth/reset-password`, and `GET /auth/me` |
| Age check | `POST /verify/document` |
| Profiles | `GET /users/<username>`, `GET /users/<username>/comments`, `PATCH /users/me`, `POST` or `DELETE /users/me/avatar`, `POST` or `DELETE /users/me/cover`, `GET /users/me/communities` |
| Communities | `GET /subjects`, `GET /subjects/<subject>/communities`, `GET /subjects/<subject>/communities/<country>`, `POST` or `DELETE /communities/<id>/follow`, `GET /categories` |
| Questions | `GET` or `POST /posts`, `GET`, `PATCH` or `DELETE /posts/<id>`, `POST` or `DELETE /posts/<id>/save`, `POST /posts/<id>/helpful`, `GET /feed` |
| Answers | `GET` or `POST /posts/<id>/comments`, `PATCH` or `DELETE /comments/<id>` |
| Votes | `PUT /votes` |
| Notifications | `GET /notifications`, `GET /notifications/unread`, `POST /notifications/read` |
| Reports | `POST /reports` |
| Search | `GET /search?q=` |
| Chat rooms | `GET /chat/rooms`, `GET` or `POST /chat/rooms/<room>/messages`, `DELETE /chat/messages/<id>` |
| TYM AI | `GET /ai/conversations`, `GET` or `DELETE /ai/conversations/<id>`, `POST /ai/messages` |
| Mentors | `GET /mentors`, `GET /mentors/<id>`, `GET /mentors/<id>/availability` |
| Mentor applications | `GET` or `POST /mentor-application`. For the team: `GET /admin/mentor-applications`, `GET /admin/mentor-applications/<id>/files/<cv or proof>`, `POST /admin/mentor-applications/<id>/decision` |
| Bookings | `GET` or `POST /bookings`, `POST /bookings/<id>/verify`, `POST /bookings/<id>/cancel`, `POST /bookings/<id>/review` |
| Payments | `POST /payments/razorpay/webhook` |
| Uploads | `GET /media/<key>` (post photos, profile photos and covers only) |
| Blog | `GET /blogs`, `GET /blogs/<slug>` |
| Contact | `POST /contact` |

## Working on the code

```bash
# Run the API tests
cd backend
python -m pytest -q

# After changing a database model, record the change and apply it
flask --app wsgi db migrate -m "describe the change"
flask --app wsgi db upgrade

# Build the website for production
cd ../frontend
npm run build
```

A few habits that keep the code consistent:

- **One place for response shapes.** Everything the API returns is built in
  `backend/app/api/serializers.py`.
- **One place for design values.** Colours, type sizes, spacing and corner sizes come from
  `frontend/src/styles/tokens.css`.
- **Styles sit near what they style.** Page styles are in `frontend/src/styles/pages.css`, component
  styles next to their component.
- **Plain words.** Copy is British English in sentence case, without exclamation marks.

## Going live

1. On DigitalOcean, create a managed PostgreSQL, a managed Redis and a Spaces bucket.
2. Fill in `.env` on the server: strong `SECRET_KEY` and `JWT_SECRET_KEY`, the database and Redis
   addresses, the Spaces keys, live Resend and Razorpay keys, the Anthropic key, and `VITE_SITE_URL`.
3. Build the website with `npm run build` and serve `frontend/dist` with Nginx. Send unknown addresses to
   `index.html`, and pass `/api` and `/socket.io` through to the API.
4. Apply the database changes with `flask --app wsgi db upgrade`.
5. Start the API:
   ```bash
   gunicorn -k geventwebsocket.gunicorn.workers.GeventWebSocketWorker -w 1 --bind 0.0.0.0:8000 wsgi:app
   ```
6. In Razorpay, add a webhook to `https://<your-domain>/api/payments/razorpay/webhook` for the
   `payment.captured` and `order.paid` events, and put its secret in `RAZORPAY_WEBHOOK_SECRET`.
7. In Google Cloud Console, add your domain to the sign-in client's JavaScript origins.
8. Update the domain in `frontend/public/robots.txt` and `sitemap.xml` if it is not
   `theyouthmatters.org`.

## What is done and what is next

**Done**

- The public website: home, country pages, mentors, blog, help pages
- Accounts: email code, Google sign-in, and the 18+ check from a photo ID
- Community: questions with photos, threaded answers, votes, saving, reports, notifications
- Profiles with photo and cover uploads, and a personal dashboard
- Chat rooms with saved messages and `@TYMAi`
- Ask TYM AI with saved conversations
- Mentor applications with team approval
- Mentor booking, Razorpay payments, refunds and reviews

**Next**

- A team panel for reviewing mentor applications, reports and accounts (the routes exist, the screens do not)
- A mentor portal for changing hours and prices, and for payouts
- Instant chat over sockets, in place of checking every few seconds
- Email and push notifications for answers and replies
- Automatic moderation and a strike system
- Production deployment, backups and monitoring

---

© 2026 The Youth Matters. All rights reserved.
