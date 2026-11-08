# Signal — Causal Monitoring Console for NinjaOne

Signal turns NinjaOne's raw alerts into an operational picture: **what is actually broken, what is only a symptom, and what to do next**.

It is a Bun + TypeScript + React web app that connects to the **NinjaOne Public API 2.0** and adds:

- a hierarchical conditions explorer,
- a priority-tuned alert workspace,
- a causality engine that suppresses downstream noise (offline agent, failed switch, WAN outage),
- external outage signals for things NinjaOne cannot see,
- and a task workflow generated from real alerts.

> Demo mode is the default. The app is fully explorable without NinjaOne credentials.

## Quick start

```bash
bun install
bun run dev
# http://localhost:3000
```

Live mode:

```bash
cp .env.example .env
# set NINJA_MODE=live and your OAuth client credentials
bun run dev
```

## Documentation

| Document | Purpose |
| --- | --- |
| [docs/PRODUCT.md](docs/PRODUCT.md) | Product vision, personas, jobs, feature set |
| [docs/ROADMAP.md](docs/ROADMAP.md) | Delivery roadmap and milestones |
| [docs/TECHNOLOGY.md](docs/TECHNOLOGY.md) | Stack, architecture, security, operations |
| [docs/API_RESEARCH.md](docs/API_RESEARCH.md) | Official NinjaOne API research and constraints |
| [docs/CAUSALITY_ENGINE.md](docs/CAUSALITY_ENGINE.md) | Suppression rules, confidence and examples |
| [docs/UX.md](docs/UX.md) | Information architecture, responsive and a11y rules |
| [docs/CHANGELOG.md](docs/CHANGELOG.md) | Incremental delivery log |

## Scripts

```bash
bun run dev        # hot-reloading full-stack dev server
bun run build      # browser bundle in dist/
bun run start      # production server
bun run typecheck  # TypeScript
bun test           # unit tests (priority + causality)
bun run check      # typecheck + tests
```

## Status

This repository is built incrementally. Every step is committed; see `git log` and the changelog.
