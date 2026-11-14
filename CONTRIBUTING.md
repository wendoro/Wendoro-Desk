# Contributing to WENDORO (`Wendoro-Desk`)

Thank you for contributing to **WENDORO**, an open-source, multi-industry Business Operating System built by **BakeWeb**.

## Architectural Standards

Every pull request must uphold these invariants:

1. **Universal Core**: Never hardcode retail, manufacturing, electronics, or textile assumptions into `core`, `identity`, `organization`, or `finance`. Vertical extensions belong in Layer C Industry Packages.
2. **Strict Multi-Tenancy**: Every tenant-owned database table must include `tenant_id` (and `company_id` where relevant), foreign keys, indexes, and PostgreSQL Row-Level Security (RLS) policies in `src/db/migrations/`.
3. **Monetary Precision**: Financial columns must use PostgreSQL `NUMERIC(19, 4)` and string-safe formatting (`src/lib/utils.ts`). Never use JavaScript floating-point arithmetic for monetary totals.
4. **Portable Infrastructure**: Domain services must depend on interfaces in `src/core/contracts/platform.ts` rather than coupling directly to a single cloud vendor.
5. **Security & Secrets**: Never commit `.env*`, `firebase-applet-config.json`, `bun.lock`, or real credentials.

## Local Development Workflow

```bash
git clone https://github.com/wendoro/Wendoro-Desk.git
cd Wendoro-Desk
npm ci
npm run dev
```

Before opening a pull request:
```bash
npm run lint
npm run build
```

If you modify `firestore.rules`:
```bash
npx eslint firestore.rules
```
