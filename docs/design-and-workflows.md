# Design Decisions & Common Workflows

## Key Design Decisions

1. **Shared Game Logic**: `game-logic.ts` is used by both tRPC API and Lambda consumer to ensure consistency
2. **SQS FIFO**: Chosen over AMQP for cost-effectiveness (95% cost reduction) and simpler architecture
3. **RSA Encryption**: Per-table keypairs for securing LiveKit room names
4. **State Machine**: Explicit game states with clear transitions
5. **Side Pots**: JSONB storage for complex side pot calculations
6. **Redaction**: Cards hidden from other players except in SHOWDOWN or when all remaining players are all-in (enables "runout" card reveal)
7. **Zustand Store**: Lightweight state management for table snapshot
8. **Selector Hooks**: Computed values derived from store for performance, eliminates prop drilling
9. **Mobile-first Responsive Design**: Separate mobile components with conditional rendering, maintaining desktop functionality
10. **Guaranteed Table Context**: `useTableId()` hook guarantees string return (throws if null), null case handled at page level - components never need null checks
11. **Component Encapsulation**: Components encapsulate their own mutations and state (e.g., `SeatCard` handles move seat logic, `LeaveTableButton` handles leave mutations)

## Common Tasks

### Adding a New Game Action

1. Add action type to `ActionType` enum in `table.ts`
2. Add handler in `tableRouter.action` mutation
3. Implement logic in `game-helpers.ts` or `game-logic.ts`
4. Update frontend components to trigger action

### Adding a New Database Field

1. Update schema in `src/server/db/schema.ts`
2. Generate migration: `npm run db:generate`
3. Review migration in `drizzle/` directory
4. Apply migration: `npm run db:migrate`

### Debugging Card Scanning

1. Check Raspberry Pi logs: `pm2 logs scanner-daemon`
2. Check SQS queue messages in AWS Console
3. Check Lambda logs: `serverless logs -f consumer`
4. Verify device registration in database: `SELECT * FROM pi_devices WHERE serial = '...'`

### Testing Without Hardware

Use test mode in scanner daemon or send test messages directly to SQS queue.

## Contributing

When contributing to this project:

1. Follow TypeScript best practices
2. Use Drizzle ORM for all database operations
3. Keep game logic in `game-logic.ts` (shared between API and consumer)
4. Update `README.md` (Project Status / navigation) and the relevant `docs/*.md` file when adding features or changing contracts
5. Write tests for game logic changes
6. Ensure state machine transitions are valid
7. Handle edge cases (all-in players, eliminated players, etc.)

## License

[Add license information]
