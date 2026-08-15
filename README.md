# Market Petronio API

NestJS marketplace API (catalog, orders, proximity). Spec: `specs/001-project-definitions-en.md`.

## Setup

```bash
pnpm install
cp .env.local .env   # then replace placeholders with real values
pnpm start:dev
```

- API: `http://localhost:3000/api`
- Swagger: `http://localhost:3000/docs`

`.env.local` is the committed list of required variables. Put secrets in `.env` (gitignored); it overrides `.env.local`.
