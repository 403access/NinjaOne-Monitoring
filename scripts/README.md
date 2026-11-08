# QA scripts

These scripts use Playwright with the locally installed Google Chrome (`channel: "chrome"`). Start the app on port 3100 first:

```bash
PORT=3100 bun src/index.ts
```

| Script | Purpose |
| --- | --- |
| `node scripts/flow.mjs` | Opens drawers, causality tabs, task/device details, command palette, light theme and mobile views; fails on console errors. |
| `node scripts/interactions.mjs` | Creates a signal, bulk task, new task; tests condition search/grouping; tests live fallback; opens a mobile drawer. |
| `node scripts/screens.mjs` | Regenerates the screenshots in `docs/screenshots/`. |

The scripts are development tooling, not part of the production bundle.
