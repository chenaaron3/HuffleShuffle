---
name: query-aws-logs
description: >-
  Queries AWS CloudWatch Logs for this project via the AWS CLI (filter-log-events,
  get-log-events). Use when the user asks to pull Lambda logs, CloudWatch logs,
  ingest errors, or debug production/dev failures from logs; or when investigating
  SQS consumer, money conservation, or scanner ingest issues.
---

# Query AWS Logs (Huffle Shuffle)

## Preconditions

- Run commands in the user’s environment (they need `aws` CLI and valid credentials: profile, `AWS_*`, or SSO).
- Default **region** for this project’s Lambda: **`us-east-1`** (see `lambda/consumer/serverless.yml`).
- Do **not** paste secrets or full ARNs unnecessarily; redact if sharing output.

Optional sanity check:

```bash
aws sts get-caller-identity --region us-east-1
```

## Ingest Lambda log group

Serverless deploy creates:

| Pattern | Example (stage `dev`) |
|--------|------------------------|
| `/aws/lambda/huffle-shuffle-ingest-{stage}-ingest` | `/aws/lambda/huffle-shuffle-ingest-dev-ingest` |

Replace `{stage}` with the deploy stage (`dev`, `prod`, etc.).

## Filter recent events (most common)

`--start-time` / `--end-time` are **milliseconds since Unix epoch**.

Last 24 hours, search for a substring (e.g. errors mentioning conservation):

```bash
aws logs filter-log-events --region us-east-1 \
  --log-group-name "/aws/lambda/huffle-shuffle-ingest-dev-ingest" \
  --filter-pattern "conservation" \
  --start-time $(($(date +%s)*1000 - 86400000)) \
  --limit 50
```

Other useful patterns: `ERROR`, a **Lambda request id**, an **SQS message id**, or `[lambda]`.

**Money conservation (full diagnostic in one log event):** the ingest Lambda emits a single `console.log` whose message starts with **`[conservation_diagnostic] full_report`** (see `src/server/api/money-conservation-diagnostics.ts`). Filter:

```bash
--filter-pattern "full_report"
```

## Pull a narrow time window from one stream

1. Get stream name from `filter-log-events` output (`logStreamName`), or list streams:

```bash
aws logs describe-log-streams --region us-east-1 \
  --log-group-name "/aws/lambda/huffle-shuffle-ingest-dev-ingest" \
  --order-by LastEventTime --descending --limit 5
```

2. **Shell escaping:** stream names contain `$LATEST`; quote and escape **dollar** for zsh/bash:

```bash
aws logs filter-log-events --region us-east-1 \
  --log-group-name "/aws/lambda/huffle-shuffle-ingest-dev-ingest" \
  --log-stream-names '2026/03/26/[$LATEST]xxxxxxxx' \
  --start-time 1774569200000 \
  --end-time 1774569300000
```

Use single quotes around `--log-stream-names` so `$LATEST` is not expanded.

## Follow-up in repo

Ingest path: `lambda/consumer/consumer.ts` → shared `game-logic` / `hand-solver`. Money conservation failures throw from `validateMoneyConservation` in `src/server/api/hand-solver.ts`; CloudWatch may include **`logConservationErrorDiagnostics`** output (full seat/pot dump) in the same invocation—pull the **full stream slice** around the error timestamp, not only the ERROR line.

## Other log groups

If debugging **Next.js / hosting** or other AWS resources, discover names with:

```bash
aws logs describe-log-groups --region us-east-1 --log-group-name-prefix "/aws/lambda/"
```

Then use the same `filter-log-events` / `get-log-events` pattern with the chosen group.
