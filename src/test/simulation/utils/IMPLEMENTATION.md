# PHH Test Implementation Summary

## Overview

Created a complete PHH (Poker Hand History) testing framework that:

1. Parses `.phh` files (Python-like poker hand history format)
2. Converts them to internal test scenario format
3. **Correctly derives and sets the dealer button position from blinds**
4. Executes hands as automated integration tests
5. Validates finishing stacks match expected outcomes

## Dealer Button Logic

### Problem

PHH files don't explicitly state the dealer button position, but it can be derived from the `blinds_or_straddles` array.

### Solution

The dealer button is **the position immediately before the small blind** (in clockwise/circular order).

Example from WSOP hand:

```python
blinds_or_straddles = [40000, 80000, 0, 0, 0]
```

- p1 (index 0) = Small Blind (40000)
- p2 (index 1) = Big Blind (80000)
- p3-p5 = No blind (0)

Therefore:

- **Dealer button = p5** (position before p1, wrapping around)

### Implementation

1. **`getDealerButtonPlayer()`** in `phh-to-scenario.ts`:
   - Finds the small blind position (first non-zero blind)
   - Calculates button position as (SB position - 1) with circular wrapping
   - Returns 1-indexed player number

2. **`setupDealerButton()`** in `run-phh-tests.test.ts`:
   - Creates a dummy "previous game" record
   - Sets the button on the seat **before** the target position
   - When START_GAME is called, game logic automatically progresses button forward
   - This ensures the button lands on the correct player

3. **Validation step** added after START_GAME:
   - Verifies the dealer button is on the correct player's seat
   - Uses existing `dealerButtonFor` validation in scenario types

## Files Created

- **`phh-parser.ts`**: Parses Python-like PHH syntax
- **`phh-to-scenario.ts`**: Converts PHH to test scenarios + derives dealer button
- **`run-phh-tests.test.ts`**: Vitest test runner + dealer button setup
- **`README.md`**: User documentation
- **`hands/*.phh`**: Directory for PHH files

## Files Modified

- **`scenario.types.ts`**: Added optional `metadata` field to Scenario type

## How It Works

```
1. Parse .phh file
   ↓
2. Extract blinds_or_straddles: [40000, 80000, 0, 0, 0]
   ↓
3. Derive button position: p5 (before p1)
   ↓
4. Create scenario with metadata: { dealerButtonPlayer: "player5" }
   ↓
5. Players join table
   ↓
6. Create dummy game with button at p4
   ↓
7. START_GAME called → button auto-progresses to p5 ✓
   ↓
8. Validate button is at p5 ✓
   ↓
9. Execute hand actions
   ↓
10. Validate finishing stacks ✓
```

## Testing

Run PHH tests:

```bash
npm test run-phh-tests
```

The test will:

- ✅ Validate PHH format (no duplicate cards, stack conservation, etc.)
- ✅ Convert to scenario with correct dealer button
- ✅ Execute hand through game logic
- ✅ Verify dealer button position after START_GAME
- ✅ Verify finishing stacks match expected values

## Example Output

```
=== Running scenario: 2023 World Series of Poker Event #43 - Hand 1 ===
Step 1/X: join
Setting up dealer button for player5
  Creating dummy game with button at seat 4
Step 2/X: action (START_GAME)
Step 3/X: validate (dealer button)
✓ Dealer button correctly positioned at player5
...
✓ Scenario completed successfully
```

## Edge Cases Handled

- **Heads-up** (2 players): Button is also small blind
- **No blinds**: Defaults to last player
- **Wraparound**: Button before player1 wraps to last player
- **Multiple hands**: Button progression works correctly

## Validation Performed

### Format Validation

- Required fields present
- Valid card notation (ranks/suits)
- No duplicate cards dealt
- Player numbers in valid range (p1-p8)
- Stack conservation (total chips constant)
- Array lengths match player count

### Execution Validation

- Dealer button in correct position
- Game logic executes without errors
- Finishing stacks match expected values

## Future Enhancements

- [ ] Support for ante distributions
- [ ] Support for straddles
- [ ] Multiple streets/hands in one PHH file
- [ ] Hand history replay UI
- [ ] Support for other poker variants (PLO, etc.)
