---
name: write-table-scenario-test
description: Create or debug table scenario tests for the poker table harness. Use when adding a table scenario test, writing an e2e-style test for game flow, debugging failing harness tests, or when the user asks to add/run/fix a harness test or scenario test.
---

# Writing Table Scenario Tests

## Overview

Scenarios are declarative test scripts in `src/test/table.scenarios/`. The harness in `table.scenario.harness.test.ts` loads all `*.ts` files from that directory and runs each scenario as an `it()` test. Each scenario defines a sequence of steps: join, action, deal_hole, validate.

**Key files:**
- `src/test/scenario.types.ts` — step and scenario type definitions
- `src/test/scenario-step-handlers.ts` — step executors
- `src/test/table.scenario.harness.test.ts` — harness that runs scenarios

## Step Types

### 1. Join

Players sit at the table. Join order determines seat numbers (player1 → seat 0, player2 → seat 1, etc.).

```ts
{ type: "join", players: [{ key: "player1" }, { key: "player2" }] }
// Custom buy-in:
{ type: "join", players: [{ key: "player1", buyIn: 500 }] }
```

### 2. Action

Performed by a player or the dealer. Use `by` for who acts, `params` for action-specific data.

| Action       | by     | params                                  |
|--------------|--------|-----------------------------------------|
| START_GAME   | dealer | —                                        |
| DEAL_CARD    | dealer | `{ rank: "A", suit: "s" }` (rank: 2–9, T, J, Q, K, A; suit: s, h, c, d) |
| RAISE        | player | `{ amount: 50 }` (total bet)             |
| CHECK        | player | —                                        |
| FOLD         | player | —                                        |
| RESET_TABLE  | dealer | —                                        |

**Error testing:** Set `isError: true` to assert the action throws:

```ts
{ type: "action", action: "RAISE", by: "player1", params: { amount: 70 }, isError: true }
```

### 3. Deal hole (optional)

Alternative to per-card DEAL_CARD steps. Maps each player to exactly two cards. Skips eliminated players.

```ts
{ type: "deal_hole", hole: { player1: ["As", "Kh"], player2: ["Qd", "Jc"] } }
```

### 4. Validate

Assert game, table, or seat state.

```ts
{ type: "validate", game: { state: "BETTING" } }
{ type: "validate", game: { state: "DEAL_FLOP", potTotal: 350 } }
{ type: "validate", dealerButtonFor: "player1" }
```

## Critical: Betting Order (Heads-Up vs Full Ring)

**Heads-up (2 players):** Small blind acts first preflop.
- Dealer (button) = BB. Other player = SB.
- First to act = SB (player2 if dealer is player1).

**Full ring (3+ players):** UTG (first player after BB) acts first preflop.

If your scenario has the wrong first actor, you get `Not your turn`. When in doubt, check `src/server/api/game-logic.ts`:
- Preflop: `firstToActId = getNextActiveSeatId(orderedSeats, bigBlindSeatId)`
- Postflop: first to act = next active after dealer button

## Template

```ts
import type { Scenario } from "~/test/scenario.types";

const scenarios: Scenario[] = [
  {
    name: "descriptive test name",
    steps: [
      { type: "join", players: [{ key: "player1" }, { key: "player2" }] },
      { type: "action", action: "START_GAME", by: "dealer" },
      // Deal hole cards: 2 cards × N players (dealer deals in seat order)
      { type: "action", action: "DEAL_CARD", by: "dealer", params: { rank: "A", suit: "s" } },
      { type: "action", action: "DEAL_CARD", by: "dealer", params: { rank: "K", suit: "s" } },
      // ... more cards
      { type: "validate", game: { state: "BETTING" } },
      // Actions in turn order
      { type: "action", action: "RAISE", by: "player2", params: { amount: 50 } },
      { type: "action", action: "CHECK", by: "player1" },
      { type: "validate", game: { state: "DEAL_FLOP" } },
    ],
  },
];

export default scenarios;
```

## Adding a New Scenario

1. Create `src/test/table.scenarios/your-scenario.ts` or add to an existing file.
2. Export `Scenario[]` (array) or a single `Scenario` as `default`.
3. Run with targeted execution (see *Debugging and Targeted Test Execution* below) for faster iteration.

## Debugging and Targeted Test Execution

**Use targeted runs to reduce iteration time.** The full harness runs 10+ scenarios; isolate the failing test first.

### Run a single scenario by name

```bash
npm test -- src/test/table.scenario.harness.test.ts --run -t "partial test name"
```

Example: to debug only the 8-player elimination test:

```bash
npm test -- src/test/table.scenario.harness.test.ts --run -t "Player elimination: 8 players"
```

The `-t` flag matches the scenario `name` field (substring match).

### Run a single scenario file (by file path)

If you know the scenario file, run only tests whose names match that file's scenarios:

```bash
npm test -- src/test/table.scenario.harness.test.ts --run -t "player elimination"
```

### Use `npm test` (not raw vitest)

The project uses `scripts/test-with-db.sh`, which starts Docker DB and runs `db:push` before tests. Always use:

```bash
npm test -- src/test/table.scenario.harness.test.ts --run -t "name"
```

### Debugging tips

1. **Run the failing test in isolation first** — avoids cross-test pollution (e.g. "Table not found", "Dealer already assigned") from parallel or shared DB state.
2. **Check step order** — betting order (heads-up vs full ring) and turn order matter; wrong actor → "Not your turn".
3. **RAISE params are total bet** — `{ amount: 50 }` means total chips in (not the raise increment). Respect TDA min re-raise: `minRaiseTotal = maxBet + lastRaiseIncrement`.
4. **Inspect logs** — the harness logs each step (`Executing step: ...`). Match the error to the step being run.
5. **Run without `--run`** — omit `--run` for watch mode; vitest will re-run on file save (slower startup but useful for repeated edits).

### Quick reference: vitest flags

| Flag | Purpose |
|------|---------|
| `-t "pattern"` | Run tests whose name matches the pattern (substring) |
| `--run` | Single run, no watch (default for CI) |
| `--reporter=verbose` | Show each test name as it runs |

## Harness Config (fixed)

- Table: SB=5, BB=10, buy-in=300
- Dealer and players are pre-seeded with fixed IDs (e.g. `player1-scenario-vitest`)
