# SaaS Starter

A production-ready Next.js SaaS starter with authentication, Stripe billing, role-based access, and an admin dashboard.

## Stack

- **Framework** — Next.js 15 (App Router)
- **Auth** — NextAuth.js (Credentials + GitHub OAuth)
- **Database** — PostgreSQL via Prisma
- **Payments** — Stripe (Checkout + Webhooks)
- **Styling** — Tailwind CSS
- **Validation** — Zod

## Features

- Email/password and GitHub OAuth login
- Stripe subscription billing with webhook handling
- Admin and user roles with protected routes
- Account settings (name, email, password)
- Admin user management dashboard

## Getting Started

### 1. Clone and install

```bash
git clone https://github.com/your-username/saas-starter.git
cd saas-starter
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Fill in the values in `.env`:

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `NEXTAUTH_SECRET` | Random secret (`openssl rand -base64 32`) |
| `NEXTAUTH_URL` | App URL (e.g. `http://localhost:3000`) |
| `GITHUB_ID` | GitHub OAuth App client ID |
| `GITHUB_SECRET` | GitHub OAuth App client secret |
| `STRIPE_SECRET_KEY` | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret |
| `NEXT_PUBLIC_STRIPE_PRO_PRICE_ID` | Stripe price ID for the Pro plan |

### 3. Set up the database

```bash
npx prisma migrate dev
npx prisma db seed
```

### 4. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Stripe Webhooks (local)

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

## Deployment

Deploy to Vercel with one click or any Node.js-compatible host. Make sure to add all environment variables and set up the Stripe webhook endpoint pointing to `/api/stripe/webhook`.

## License

MIT