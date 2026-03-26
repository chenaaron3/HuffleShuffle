# Key Components

## Frontend Components

### `src/pages/table/[id].tsx`

- Main table view page
- Manages LiveKit room connection
- Handles player actions and game state updates
- Coordinates Pusher subscriptions for real-time updates
- Requests camera and microphone permissions for players on page load
- Conditionally renders desktop or mobile layout based on screen size
- **Null handling**: Early returns if table ID is missing or table query is loading, ensuring child components always have valid table context

### `src/components/ui/seat-section.tsx`

- Renders 4 seats (left or right side)
- Displays player info, cards, chips, status indicators
- Handles seat selection and movement (move logic encapsulated in `SeatCard` component)
- Shows blind indicators and dealer button
- Supports `fullHeight` prop for mobile layouts
- **Uses selectors**: Derives all data from Zustand store via selector hooks (no prop drilling)

### `src/components/ui/dealer-camera.tsx`

- Dealer camera view with community cards overlay
- Pot and blinds display
- Player action controls (bet, fold, check, raise)
- Dealer controls (deal cards, reset table)
- Responsive sizing: `h-full` on mobile, `aspect-video` on desktop (`lg:` breakpoint)
- Supports `hidePlayerBettingControls` prop to hide controls on mobile (shown in betting tab instead)
- **Uses selectors**: Derives all data from Zustand store via selector hooks (no prop drilling)
- **Encapsulated mutations**: Uses `useActions()` hook for player actions, `LeaveTableButton` for leave functionality

### `src/components/ui/hand-camera.tsx`

- Player's hand camera view
- Connects to encrypted LiveKit room

### `src/components/ui/quick-actions.tsx`

- Quick betting controls (fold, check, call, raise)
- Disabled when not player's turn

### `src/components/ui/show-hand-control.tsx`

- "Show Hand" button shown at showdown when eligible (folded or single winner)
- Same position as raise controls (bottom right)
- Calls `VOLUNTEER_SHOW` action to reveal hand to others

### `src/components/ui/event-feed.tsx`

- Game event log (card deals, bets, folds, etc.)

### `src/components/ui/side-pot-details.tsx`

- Expandable component showing side pot breakdown during SHOWDOWN
- Displays stacked bar chart visualization of all side pots
- Shows each player's contribution to each pot level with color coding (yellow for winners, gray for non-winners)
- Left Y-axis shows bet level boundaries, right Y-axis shows pot amounts
- Uses `SidePotChart` component for visualization

### `src/components/ui/side-pot-chart.tsx`

- Stacked horizontal bar chart component for visualizing side pots
- Built with recharts library
- X-axis: Players who contributed to pots
- Left Y-axis: Cumulative bet level boundaries (with reference lines)
- Right Y-axis: Pot amounts displayed in middle of each pot section
- Color coding: Yellow segments for winners, gray segments for non-winners
- Only displayed during SHOWDOWN state

## Mobile Components (`src/components/ui/mobile/`)

Mobile-specific components organized in a dedicated folder for landscape mobile devices:

### `src/components/ui/mobile/table-layout.tsx`

- Wrapper component that conditionally renders desktop or mobile layout
- Uses `useIsMobileLandscape` hook to detect mobile landscape orientation (< 1024px width, width > height)
- Shows "Rotate Device" message for mobile portrait
- Non-invasive architecture - doesn't modify child components

### `src/components/ui/mobile/table-tabs.tsx`

- Tab navigation for mobile landscape view
- Two tabs: "Dealer" and "Betting"
- Toggle button on left middle of screen that switches between tabs
- Icon changes based on active tab (shows destination tab icon)
- Smooth transitions using Framer Motion

### `src/components/ui/mobile/betting-view.tsx`

- Mobile betting interface layout
- Top half: All 8 player seats in horizontal scrollable row
- Bottom half: Horizontal scrollable layout with:
  - Community cards (left)
  - Hand camera (middle)
  - Betting controls (right - `VerticalRaiseControls`, `ShowHandControl` at showdown, or `QuickActions`)
- Displays only when player is seated or it's their turn
- **Uses selectors**: Derives all data from Zustand store via selector hooks (minimal props: `handRoomName`, `quickAction`, `onQuickActionChange`)

### `src/components/ui/mobile/seat-section.tsx`

- Renders all 8 seats horizontally for mobile betting view
- Uses `SeatCard` component with `fullHeight={true}` prop
- Each seat card is half the height of mobile screen
- Scrollable horizontal layout with `overflow-x-auto`
- **Uses selectors**: Derives all data from Zustand store via selector hooks (no props needed)

### `src/components/ui/mobile/community-cards-display.tsx`

- Displays community cards in horizontal row
- Highlights winning cards during showdown
- Extracted from `DealerCamera` for mobile reuse
- Uses Framer Motion for card animations

### Mobile Hooks

- `src/hooks/use-is-mobile-landscape.ts`: Detects mobile devices in landscape orientation

### `src/components/ui/media-permissions-modal.tsx`

- Self-contained modal component for requesting camera and microphone permissions
- Automatically shows for players when joining a table (checks if permissions already granted)
- Manages its own state and permission request logic
- Provides "Allow" and "Skip" options
- Explains why permissions are needed and what happens if skipped
- Requests permissions before LiveKit connects
- Allows page to continue loading even if permissions are denied
- LiveKit handles connection gracefully with or without media permissions

## Backend Components

### `src/server/api/game-logic.ts`

**Core game logic shared between tRPC and ingest worker:**

- `dealCard(tx, tableId, game, cardCode)`: Deals card to seat or community
- `dealRandomCard(tx, tableId, game)`: Picks and deals a random undealt card (has access to all player hands and community cards)
- `createNewGame(tx, table, seats, previousGame)`: Initializes new hand (checks `wasReset` flag to determine button position)
- `resetGame(tx, game, seats, resetBalance, wasReset)`: Resets table for next hand (sets `wasReset` flag if manually reset)
- `ensureHoleCardsProgression()`: Advances to betting after all hole cards dealt
- `ensurePostflopProgression()`: Starts betting round after flop/turn/river
- `startBettingRound()`: Transitions to BETTING state
- `collectBigAndSmallBlind()`: Collects blinds at game start
- `notifyTableUpdate()`: Sends Pusher event to update clients

### `src/server/api/hand-solver.ts`

**Poker hand evaluation and showdown logic:**

**Exported functions:**

- `solvePokerHand(cards)`: Evaluates single hand using pokersolver library
- `findPokerWinners(hands)`: Determines winners among multiple PokerHandResult objects
- `evaluateBettingTransition()`: Checks if betting round should complete, triggers showdown if needed

**Showdown process (internal functions):**

- `evaluateContenderHands()`: Evaluates poker hands for all contenders (active + all-in players)
- `initializeHandTracking()`: Initializes tracking structures for winnings and hand info
- `distributeSidePots()`: Distributes side pots to winners based on hand rankings
- `updateSeatsWithWinnings()`: Updates database with hand evaluation results and winnings
- `updateEliminationStatus()`: Marks players with 0 chips as eliminated
- `validateMoneyConservation()`: Validates that sum of startingBalance equals sum of final buyIn (ensures no money creation/destruction)
- `completeShowdown()`: Orchestrates the complete showdown process

**Key features:**

- Only evaluates contenders (active + all-in players) - folded and eliminated players are excluded
- Handles ties correctly when multiple players have the same winning hand
- Validates money conservation to ensure no money is created or destroyed during pot distribution
- Throws error if side pot has no eligible contenders (prevents money loss)

### `src/server/api/game-helpers.ts`

**Betting actions and helpers:**

- `executeBettingAction()`: Processes RAISE, CHECK, FOLD actions
- `createSeatTransaction()`: Creates seat with encryption
- `removePlayerSeatTransaction()`: Removes player and refunds
- `triggerBotActions()`: Auto-actions for bot players

### `src/server/api/blind-timer.ts`

**Blind level management:**

- `computeBlindState(table)`: Calculates effective blinds based on timer
- Supports blind progression over time

## State Management

### `src/stores/table-store.ts`

- Zustand store for table snapshot
- Updated via `useTableQuery` hook
- Provides reactive state for components

### `src/hooks/use-table-selectors.ts`

- Selector hooks for computed values:
  - `useTableSnapshot()`: Raw snapshot
  - `usePaddedSeats()`: Seats array padded to maxSeats (for rendering)
  - `useOriginalSeats()`: Actual seats only (for calculations)
  - `useGameState()`: Current game state
  - `useBettingActorSeatId()`: Current player to act
  - `useTotalPot()`: Total pot amount
  - `useCommunityCards()`: Community cards array
  - `useTableId()`: Table ID (guaranteed string, throws if null - null case handled at page level)
  - `useIsPlayerTurn(userId)`: Whether it's the given user's turn
  - `useIsDealerRole()`: Whether current user is a dealer
  - `useTurnStartTime()`: When current player's turn started
  - And more...

### `src/hooks/use-table-realtime-pusher.ts`

- Subscribes to Pusher `TABLE_UPDATED` on the table channel; debounces `table.get` refetch and event-feed delta refresh
- Uses a **module-level** timer per `tableId` so duplicate `channel.bind` / back-to-back events still coalesce to one refetch
- Used by `src/pages/table/[id].tsx` (global Pusher disconnect on page unmount remains in the page)

### `src/hooks/use-actions.ts`

- Wrapper hook around `api.table.action.useMutation`
- Handles `onSuccess`/`onError` internally
- Updates Zustand store automatically on success
- Returns `mutate` function and `isPending` state
- Used by components that need to perform table actions (e.g., `DealerCamera`, `ActionButtons`, `VerticalRaiseControls`)
