# PHH (Poker Hand History) Test Simulation

This directory contains infrastructure for testing poker game logic using `.phh` (Poker Hand History) files.

## Overview

The PHH simulation framework:

1. **Parses** `.phh` files (Python-like poker hand history format)
2. **Converts** them to internal test scenario format
3. **Validates** the hands (no duplicate cards, stack conservation, etc.)
4. **Executes** them as automated tests against the game logic
5. **Verifies** finishing stacks match expected outcomes

## Directory Structure

```
src/test/simulation/
├── README.md                    # This file
├── phh-parser.ts               # Parser for .phh file format
├── phh-to-scenario.ts          # Converter from PHH to test scenarios
├── run-phh-tests.test.ts       # Test runner (loaded by Vitest)
└── hands/                      # Directory containing .phh files
    └── *.phh                   # Individual poker hand history files
```

## PHH File Format

PHH files use Python-like syntax to describe poker hands. Example:

```python
variant = 'NT'  # No-Limit Texas Hold'em
ante_trimming_status = false
antes = [0, 120000, 0, 0, 0]
blinds_or_straddles = [40000, 80000, 0, 0, 0]
min_bet = 80000
starting_stacks = [7380000, 2500000, 5110000, 10170000, 4545000]
actions = [
  'd dh p1 7s4s',      # Deal hole cards to player 1
  'd dh p2 Js8h',      # Deal hole cards to player 2
  'p3 f',              # Player 3 folds
  'p4 cbr 170000',     # Player 4 bets/raises to 170,000
  'p2 cc',             # Player 2 calls/checks
  'd db JcTs2d',       # Deal flop
  'p2 cc',             # Player 2 checks
  'd db As',           # Deal turn
  'd db Qs'            # Deal river
]
finishing_stacks = [7340000, 3775000, 5110000, 8935000, 4545000]
```

### Action Types

- `d dh pN XxYy` - Deal hole cards to player N (e.g., `d dh p1 AsKd`)
- `d db XxYy...` - Deal board cards (flop=3 cards, turn=1 card, river=1 card)
- `pN f` - Player N folds
- `pN cc` - Player N calls/checks
- `pN cbr AMOUNT` - Player N bets/raises to AMOUNT
- `pN sm XxYy` - Player N shows/mucks cards (showdown)

### Card Notation

- Ranks: `2`-`9`, `T` (ten), `J` (jack), `Q` (queen), `K` (king), `A` (ace)
- Suits: `c` (clubs), `d` (diamonds), `h` (hearts), `s` (spades)
- Examples: `As` (ace of spades), `7h` (seven of hearts), `Td` (ten of diamonds)

## Adding New Tests

1. Create a new `.phh` file in `src/test/simulation/hands/`
2. Follow the PHH format (see example above)
3. Run tests: `npm test run-phh-tests`

The test runner will automatically discover and run all `.phh` files.

## Validation

The framework performs several validations:

### Format Validation

- ✅ Required fields present (variant, stacks, actions, etc.)
- ✅ Valid card notation (ranks and suits)
- ✅ No duplicate cards dealt
- ✅ Player numbers within valid range (p1-p8)
- ✅ Stack conservation (total chips remain constant)

### Execution Validation

- ✅ Scenario converts to valid test steps
- ✅ Game logic executes without errors
- ✅ **Finishing stacks match expected values**

## Supported Variants

Currently only **No-Limit Texas Hold'em** is supported:

- `variant = 'NT'` or `variant = 'NL'`

Other variants (Pot-Limit Omaha, etc.) will throw an error.

## Running Tests

```bash
# Run all PHH tests (warning: may be thousands of tests!)
npm test run-phh-tests

# Run only WSOP hands
PHH_FILTER=wsop npm test run-phh-tests

# Run only Pluribus hands from specific directory
PHH_FILTER=pluribus/100 npm test run-phh-tests

# Run a specific file
PHH_FILTER=pluribus/100/0.phh npm test run-phh-tests

# Run all files in pluribus/ subdirectories
PHH_FILTER=pluribus npm test run-phh-tests

# Run with watch mode
npm test -- --watch run-phh-tests
```

### Performance Note

The `hands/pluribus/` directory contains **5,000+ hand histories**. Running all tests takes hours. Use the `PHH_FILTER` environment variable to test specific subsets during development.

## Troubleshooting

### No .phh files found

- Ensure `.phh` files are in `src/test/simulation/hands/`
- Check file extension is `.phh` (not `.txt` or `.phh.txt`)

### Parse errors

- Verify Python-like syntax (quotes, brackets, commas)
- Check all required fields are present
- Ensure card notation is valid (e.g., `As` not `A♠`)

### Validation errors

- Check for duplicate cards
- Verify starting_stacks and finishing_stacks have same length
- Ensure player numbers match (p1-p5 for 5 players)
- Verify stack conservation (total chips in = total chips out)

### Execution errors

- Review action sequence (may indicate game logic bug)
- Check if actions match Texas Hold'em rules
- Verify blinds/antes are reasonable for stack sizes

## Implementation Details

### Architecture

```
.phh file
    ↓ (phh-parser.ts)
PHHData object
    ↓ (phh-to-scenario.ts)
Scenario object
    ↓ (run-phh-tests.test.ts)
Test execution via scenario-step-handlers.ts
    ↓
✅ Pass / ❌ Fail
```

### Key Files

- **phh-parser.ts**: Low-level parser for Python-like syntax
- **phh-to-scenario.ts**: Converts PHH actions to test steps
- **run-phh-tests.test.ts**: Vitest test file that orchestrates execution
- **scenario-step-handlers.ts**: (existing) Executes individual test steps

### Limitations

- Only Texas Hold'em is currently supported
- Showdown cards (`sm` actions) are ignored (showdown is automatic)
- All-in situations must be handled by game logic
- Side pots must be calculated correctly by game logic

## Future Enhancements

- [ ] Support for Pot-Limit Omaha
- [ ] Support for other poker variants
- [ ] Hand strength validation at showdown
- [ ] Support for tournament-specific features
- [ ] More detailed error messages with line numbers
- [ ] CLI tool for validating .phh files independently
