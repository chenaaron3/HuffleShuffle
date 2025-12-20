# Bot Poker Strategy Guide

## TLDR: How the Bot Plays (Beginner-Friendly)

**Think of the bot like a smart poker player who:**

1. **Knows the math** - It calculates how likely it is to win with its cards
2. **Compares odds** - It checks if calling a bet is worth it based on pot size
3. **Uses position** - It plays more aggressively when it acts last (better position)
4. **Makes smart decisions** - It folds bad hands, calls with decent hands, and raises with strong hands

### Simple Rules the Bot Follows:

**When to FOLD (give up):**

- Your hand is really weak (less than 2% chance to win)
- Someone bet a lot and your hand isn't good enough to call

**When to CALL/CHECK (stay in the hand):**

- Your hand has a decent chance to win
- The pot odds make it worth calling (you're getting good value)
- You're not strong enough to raise, but not weak enough to fold

**When to RAISE (bet more):**

- You have a strong hand (55%+ chance to win)
- You want to build the pot and charge opponents for staying in
- You're in a good position (acting last gives you an advantage)

**Position Matters:**

- **Late position (Button/Cutoff)**: Play more hands, be more aggressive
- **Early position**: Play fewer hands, be more careful
- **Blinds**: Most conservative, only play premium hands

**The Bottom Line:** The bot plays tight-aggressive poker. It doesn't gamble recklessly, but when it has a good hand, it bets to win money. It folds weak hands to save chips, and only calls or raises when the math makes sense.

---

## Overview

This document outlines the optimal poker strategy implemented by the Huffle Shuffle bot players. The strategy is based on fundamental poker mathematics, position theory, and game theory optimal (GTO) principles, adapted for practical play.

## Core Concepts

### Hand Equity

**Hand equity** represents the probability that your hand will win at showdown. It's calculated using Monte Carlo simulation against unknown opponent hands.

- **Win Percentage**: The likelihood of having the best hand at showdown
- **Tie Percentage**: The likelihood of splitting the pot
- **Effective Equity**: Win % + (Tie % / 2) - a single number representing expected value

The bot uses `pokersolver` (413+ GitHub stars) to calculate equity by running 100 Monte Carlo simulations, randomly assigning opponent hands and evaluating all possible outcomes.

**Example**: With pocket Aces pre-flop against 2 opponents, you have approximately 73% equity. This means you'll win about 73% of the time if all players see the showdown.

### Pot Odds

**Pot odds** represent the ratio of the current pot size to the amount you need to call. It tells you what percentage of the pot you need to win to make a call profitable.

**Formula**: `Pot Odds = (Amount to Call) / (Pot Size + Amount to Call) × 100`

**Example**:

- Pot: 100 chips
- Bet to call: 25 chips
- Pot Odds = 25 / (100 + 25) = 20%

This means you need to win at least 20% of the time for the call to be profitable.

### The Fundamental Theorem of Poker

**If your equity > pot odds, the call is profitable.**

However, the bot uses a more sophisticated approach that accounts for:

- **Implied Odds**: Future betting rounds where you can win more chips
- **Reverse Implied Odds**: Future betting rounds where you might lose more
- **Position**: Your position relative to the dealer button
- **Drawing Potential**: The ability to improve your hand on later streets

## Decision Framework

The bot makes decisions in a three-step process:

### Step 1: Fold Decision

**Never fold when checking** - If there's no bet to call, always check.

**Fold if**:

1. Equity is below absolute minimum (2%)
2. Equity is significantly worse than pot odds (by 8-13% depending on position)

**Position-Based Fold Thresholds**:

- **Late Position**: 13% margin - Most aggressive, rarely folds
- **Middle Position**: 10% margin - Moderate aggression
- **Early Position / Blinds**: 8% margin - More conservative

**Why the margin?** The margin accounts for:

- Implied odds on future streets
- Drawing potential (flush/straight draws)
- Bluffing opportunities
- Position advantage

**Example**:

- Equity: 25%
- Pot Odds: 30%
- Position: Late
- Adjusted Pot Odds: 30% - 13% = 17%
- Decision: **CALL** (25% > 17%)

### Step 2: Raise Decision

**Raise if**:

1. Equity is at least 55% (strong hand)
2. Position-adjusted equity thresholds are met:
   - **Late Position**: 50%+ equity
   - **Middle Position**: 60%+ equity
   - **Early Position**: 65%+ equity
3. Equity is significantly better than pot odds (20%+ margin)

**Why raise?**

- Build the pot with strong hands
- Charge opponents for drawing
- Take control of the betting action
- Exploit position advantage

### Step 3: Check/Call

**Default action** when:

- Not folding (equity is acceptable)
- Not raising (equity isn't strong enough)
- Simply maintaining pot odds with a call

## Position Strategy

Position is one of the most important factors in poker. The bot adjusts its strategy based on position relative to the dealer button.

### Position Definitions

- **Blinds**: Small blind and big blind (worst position)
- **Early Position**: First 2 positions after big blind (UTG, UTG+1)
- **Middle Position**: Next 2 positions (MP1, MP2)
- **Late Position**: Button and cutoff (best position)

### Position-Based Adjustments

#### Late Position (Button & Cutoff)

**Most Aggressive**:

- Fold margin: 13% (least likely to fold)
- Raise threshold: 50% equity (most likely to raise)
- Can play wider range of hands
- Can bluff more effectively
- Can control pot size

**Why?** You act last on every street, giving you maximum information.

#### Middle Position

**Moderate Aggression**:

- Fold margin: 10%
- Raise threshold: 60% equity
- Balanced approach
- Value bet strong hands
- Fold weak hands

#### Early Position / Blinds

**Most Conservative**:

- Fold margin: 8% (most likely to fold)
- Raise threshold: 65% equity (only raise premium hands)
- Tight range
- Value bet only strong hands
- Avoid marginal spots

**Why?** You act first on every street, giving opponents maximum information about your hand.

## Raise Sizing

The bot uses dynamic raise sizing based on hand strength and pot size.

### Raise Amount Calculation

**Base**: Pot-sized raise = Current max bet + Pot size

**Adjustments by Equity**:

- **70%+ Equity** (Very Strong): 1.5× pot-sized raise
  - Examples: Top set, nut flush, full house
  - Goal: Maximize value, charge draws heavily
- **60-70% Equity** (Strong): Pot-sized raise
  - Examples: Top pair top kicker, overpair, strong draws
  - Goal: Build pot while maintaining control
- **55-60% Equity** (Moderate): 0.75× pot-sized raise
  - Examples: Middle pair, weak draws, marginal hands
  - Goal: Smaller raise to control pot size

**Constraints**:

- Minimum raise: 2× current max bet (or 2× big blind if no bet)
- Maximum raise: Cannot exceed stack size
- Rounded to nearest big blind

### Why This Sizing?

1. **Strong hands** → Larger raises to maximize value
2. **Moderate hands** → Smaller raises to control pot and avoid big losses
3. **Pot control** → Adjust sizing to manage risk

## Stack-to-Pot Ratio (SPR)

SPR = Stack Size / Pot Size

The bot calculates SPR but primarily uses it for context. Lower SPR means:

- More commitment to the pot
- Less room for post-flop maneuvering
- More likely to go all-in

## Opponent Count

The bot adjusts equity calculations based on the number of active opponents:

- **More opponents** → Lower equity (more competition)
- **Fewer opponents** → Higher equity (less competition)

The equity calculation uses Monte Carlo simulation against the exact number of active opponents.

## Betting Rounds

### Pre-Flop

- No community cards
- Equity based solely on hole cards
- Position is critical
- Tighter ranges in early position

### Post-Flop (Flop, Turn, River)

- Community cards revealed
- Equity recalculated with board texture
- Drawing hands become more valuable
- Made hands can be more aggressive

## Strategy Summary

### When to Fold

1. Equity < 2% (absolute minimum)
2. Equity significantly worse than pot odds (8-13% margin based on position)
3. In early position with marginal hands facing aggression

### When to Call/Check

1. Equity is acceptable (above fold threshold)
2. Pot odds are favorable
3. Not strong enough to raise
4. Maintaining position and pot control

### When to Raise

1. Equity ≥ 55% (strong hand)
2. Position-adjusted thresholds met (50-65% depending on position)
3. Equity significantly better than pot odds (20%+ margin)
4. Can build pot with value hands

## Technical Implementation

### Equity Calculation

Uses `pokersolver` library (413+ GitHub stars):

- Monte Carlo simulation (100 iterations)
- Accounts for known cards (hole + board)
- Simulates unknown opponent hands by randomly assigning cards
- Evaluates all hands and determines winners
- Returns win % and tie %

### Decision Flow

```
1. Calculate hand equity (win % + tie % / 2)
2. Calculate pot odds
3. Determine position
4. Apply fold logic (with position margin)
5. If not folding, apply raise logic (with position thresholds)
6. If not raising, check/call
```

### Error Handling

- If equity calculation fails: Default to 15% equity (prevents auto-folding)
- If no opponents: Always check (edge case)
- If invalid cards: Return safe default

## Example Scenarios

### Scenario 1: Strong Hand in Late Position

- **Hand**: Pocket Aces (AA)
- **Position**: Button (Late)
- **Equity**: ~85% pre-flop
- **Pot**: 50 chips
- **Bet to call**: 10 chips
- **Pot Odds**: 16.7%

**Decision**: **RAISE**

- Equity (85%) >> Pot Odds (16.7%)
- Strong hand in best position
- Raise to 75-100 chips (pot-sized)

### Scenario 2: Drawing Hand in Middle Position

- **Hand**: 9♠ 8♠
- **Board**: 7♣ 6♥ 2♦ (open-ended straight draw)
- **Position**: Middle
- **Equity**: ~32%
- **Pot**: 100 chips
- **Bet to call**: 20 chips
- **Pot Odds**: 16.7%

**Decision**: **CALL**

- Equity (32%) > Adjusted Pot Odds (16.7% - 10% = 6.7%)
- Good drawing hand with implied odds
- Not strong enough to raise

### Scenario 3: Weak Hand in Early Position

- **Hand**: 7♣ 3♦
- **Board**: K♠ Q♥ J♦ (no pair, no draw)
- **Position**: UTG (Early)
- **Equity**: ~5%
- **Pot**: 50 chips
- **Bet to call**: 25 chips
- **Pot Odds**: 33.3%

**Decision**: **FOLD**

- Equity (5%) < Adjusted Pot Odds (33.3% - 8% = 25.3%)
- Weak hand, no drawing potential
- Early position disadvantage

## Advanced Concepts

### Implied Odds

The bot's fold margin (8-13%) accounts for implied odds - the ability to win more chips on future streets when you hit your draw.

**Example**: Calling with a flush draw might not be immediately profitable, but if you hit on the turn or river, you can win a much larger pot.

### Reverse Implied Odds

The bot is conservative with marginal made hands because of reverse implied odds - the risk of losing more chips when an opponent has a better hand.

**Example**: Calling with bottom pair might seem profitable, but if an opponent has top pair, you'll lose more chips on later streets.

### Pot Control

The bot uses smaller raise sizes with moderate hands to control pot size and avoid committing too many chips with marginal holdings.

## Conclusion

This strategy balances mathematical precision with practical poker wisdom. The bot:

- ✅ Makes mathematically sound decisions based on equity and pot odds
- ✅ Adjusts for position (most important factor after cards)
- ✅ Uses appropriate bet sizing for hand strength
- ✅ Accounts for implied odds and drawing potential
- ✅ Maintains a balanced, unexploitable approach

The strategy is designed to be profitable in the long run while remaining competitive and engaging for human players.
