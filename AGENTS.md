# AGENTS.md

## Cursor Cloud specific instructions

### Services

| Service | Port / command | Notes |
|---------|----------------|-------|
| PostgreSQL (Docker) | `127.0.0.1:5433` → container `5432` | `docker compose up -d db` from repo root |
| Next.js dev | `http://127.0.0.1:3000` | `npm run dev` (tmux session recommended for long runs) |

Optional for most agent work: LiveKit, Pusher, AWS SQS, Lambda consumer (`lambda/consumer`), Pi daemons (`raspberrypi/`). See `docs/development.md`.

### Docker on Cloud VMs

This repo’s tests expect Docker for Postgres (`scripts/test-with-db.sh`). On a fresh VM, Docker may need a one-time install and socket access (`sudo usermod -aG docker $USER` or `chmod 666 /var/run/docker.sock` until re-login). Use `fuse-overlayfs` storage driver if overlay2 fails in nested VMs.

### Environment

- Copy `env.example` → `.env` and set `DATABASE_URL` to the compose DB:  
  `postgresql://postgres:postgres@127.0.0.1:5433/huffle_shuffle_test`
- Full `src/env.js` validation applies to `npm run dev` / `npm run build`. Tests use `SKIP_ENV_VALIDATION=1` and set `DATABASE_URL` in `scripts/test-with-db.sh`.
- Do **not** run full `npm test` without limiting headless bots: `headless-bot-game.runner.test.ts` defaults to **5000** hands when `HEADLESS_BOT_HANDS` is unset. For a quick check:  
  `HEADLESS_BOT_HANDS=2 npm test -- src/test/headless-bot-game.runner.test.ts --run`

### Standard commands (see `docs/development.md`)

| Task | Command |
|------|---------|
| Install deps | `npm install` (+ `npm install --prefix lambda/consumer` and `--prefix raspberrypi` if working in those trees) |
| DB schema (dev) | `npm run db:push` or `npm run db:migrate` |
| Lint | `npm run lint` |
| Typecheck | `npm run typecheck` |
| Tests + DB | `npm test` (starts compose DB; slow if headless runs 5000 hands) |
| Fast scenario smoke | `SKIP_ENV_VALIDATION=1 DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5433/huffle_shuffle_test npm run test:db -- src/test/table.scenario.harness.test.ts -t "betting round" --run` |
| Dev server | `npm run dev` |

### Lint / typecheck caveats

The repo may report existing ESLint and `tsc` issues unrelated to environment setup; treat `npm test` and targeted scenario tests as the primary “environment works” signal for game logic.
