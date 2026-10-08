# Pantheon web

The landing page (`/`) and the product (`/app`): chat that streams each agent's step and
lights the matching brain region, compare mode, grants, proposals you approve or decline,
the real Cognee graph, connections, evals.

```bash
pnpm install
pnpm exec next dev          # http://localhost:3000, recorded mode (no API needed)
NEXT_PUBLIC_PANTHEON_API=http://localhost:8080 NEXT_PUBLIC_DEMO_KEY=dev pnpm exec next dev   # live, against api/
pnpm test                   # vitest
pnpm e2e                    # playwright, desktop and phone
```

Recorded mode replays `data/recorded.json`; regenerate it against a live API with
`API=http://localhost:8080 DEMO_KEY=dev node scripts/record.mjs`.

The API lives in `../api` (`uvicorn api.server:app --port 8080` from the repo root with
`DEMO_KEY=dev`). The Docker image for Fly is built with `../api/build_image.sh`.
