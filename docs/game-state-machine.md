# Game State Machine

The game progresses through these states:

1. **INITIAL**: Table created, no game started
2. **GAME_START**: Game initialization (collecting blinds)
3. **DEAL_HOLE_CARDS**: Dealing two cards to each active player
4. **BETTING**: Pre-flop betting round
5. **DEAL_FLOP**: Dealing three community cards
6. **BETTING**: Post-flop betting round
7. **DEAL_TURN**: Dealing fourth community card
8. **BETTING**: Post-turn betting round
9. **DEAL_RIVER**: Dealing fifth community card
10. **BETTING**: Post-river betting round
11. **SHOWDOWN**: Evaluating hands and determining winners
12. **RESET_TABLE**: Resetting for next hand

## State Transitions

- **DEAL_HOLE_CARDS → BETTING**: When all active players have 2 cards
- **BETTING → DEAL_FLOP**: When betting round completes (all active bets equal, all active players acted)
- **DEAL_FLOP → BETTING**: After 3 community cards dealt
- **BETTING → DEAL_TURN**: When betting round completes
- **DEAL_TURN → BETTING**: After 4th community card dealt
- **BETTING → DEAL_RIVER**: When betting round completes
- **DEAL_RIVER → BETTING**: After 5th community card dealt
- **BETTING → SHOWDOWN**: When betting round completes
- **SHOWDOWN → RESET_TABLE**: After winners determined and chips distributed
- **RESET_TABLE → DEAL_HOLE_CARDS**: When dealer starts new hand

## Betting Rules (TDA)

- **Minimum re-raise**: Each raise must add at least the size of the previous raise. Min total = `maxBet + lastRaiseIncrement`.
- **First raise of round**: Min increment = big blind.
- **All-in**: A player may go all-in for less than a full raise; this does not reopen action for players who have already acted.

## Key Logic Files

- `src/server/api/game-logic.ts`: Core game state machine and card dealing
- `src/server/api/hand-solver.ts`: Poker hand evaluation and winner determination
- `src/server/api/game-utils.ts`: Helper functions for seat rotation, betting validation; `mergeBetsIntoPotGeneric` adds street `currentBet` into `potTotal` (side pots are rebuilt at showdown from cumulative bets in `hand-solver.ts`, including **dead carry** for orphan bet layers)
- `src/server/api/game-helpers.ts`: Betting action execution, bot integration
- `src/server/api/blind-timer.ts`: Blind level progression logic
