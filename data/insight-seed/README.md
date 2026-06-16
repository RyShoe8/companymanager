# Insight vendor seed data

One CSV per Insights category. Filename is mapped to category slug:

- `hosting.csv` or `Nucleas Affiliates - Hosting.csv` → slug `hosting`

## Required columns

| Field | Accepted headers |
|-------|------------------|
| Company name | `Company`, `Company name`, `Name` |
| URL | `URL`, `Company URL`, `Link` |
| Description | `Description`, `One-sentence description` |
| Starter price | `Starter price`, `Pricing`, `Price` |

## Run

```bash
npm run seed:insights
```

Uses `MONGODB_URI` from `.env.local`. Safe to re-run after CSV edits.
