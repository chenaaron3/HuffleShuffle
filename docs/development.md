# Development, Environment, Testing & Deployment

## Development Setup

### Prerequisites

- Node.js 20+ and npm
- PostgreSQL database
- AWS account (for SQS FIFO)
- LiveKit server (self-hosted or cloud)
- Pusher account
- Google OAuth credentials (for NextAuth)

### Installation

```bash
# Install dependencies
npm install

# Set up environment variables (see Environment Variables section)
cp env.example .env

# Run database migrations
npm run db:migrate

# Start development server
npm run dev
```

### Database Migrations

```bash
# Generate migration from schema changes
npm run db:generate

# Apply migrations
npm run db:migrate

# Push schema directly (dev only)
npm run db:push

# Open Drizzle Studio (database GUI)
npm run db:studio
```

### Raspberry Pi Setup

```bash
cd raspberrypi
npm install

# Configure environment
cp env.example .env
# Edit .env with device serial, table ID, etc.

# Run daemons (use PM2 or systemd for production)
npm run start
```

### Lambda Consumer Setup

```bash
cd lambda/consumer
npm install

# Configure environment
cp env.example .env

# Deploy to AWS Lambda
npm run deploy
# Or use serverless framework:
serverless deploy
```

## Environment Variables

### Server-Side (`src/env.js`)

```bash
# Authentication
AUTH_SECRET=                    # NextAuth secret (required in production)
AUTH_GOOGLE_ID=                 # Google OAuth client ID
AUTH_GOOGLE_SECRET=             # Google OAuth client secret

# Database
DATABASE_URL=                   # PostgreSQL connection string

# LiveKit
LIVEKIT_URL=                    # LiveKit server URL
LIVEKIT_API_KEY=                # LiveKit API key
LIVEKIT_API_SECRET=             # LiveKit API secret

# Pusher
PUSHER_APP_ID=                  # Pusher app ID
PUSHER_KEY=                     # Pusher key
PUSHER_SECRET=                  # Pusher secret
PUSHER_CLUSTER=                 # Pusher cluster (e.g., "us2")

# AWS SQS
AWS_REGION=                     # AWS region (e.g., "us-east-1")
AWS_ACCESS_KEY_ID=              # AWS access key
AWS_SECRET_ACCESS_KEY=          # AWS secret key
SQS_QUEUE_URL=                  # SQS FIFO queue URL

# Environment
NODE_ENV=development            # development | test | production
```

### Client-Side

```bash
NEXT_PUBLIC_PUSHER_KEY=         # Pusher public key
NEXT_PUBLIC_PUSHER_CLUSTER=     # Pusher cluster
```

### Raspberry Pi (`raspberrypi/.env`)

```bash
SCANNER_DEVICE=/dev/hidraw0     # HID barcode scanner device path
SQS_QUEUE_URL=                  # SQS FIFO queue URL
AWS_REGION=                     # AWS region
AWS_ACCESS_KEY_ID=              # AWS access key (for Pi device)
AWS_SECRET_ACCESS_KEY=          # AWS secret key
PUSHER_APP_ID=                  # Pusher app ID
PUSHER_KEY=                     # Pusher key
PUSHER_SECRET=                  # Pusher secret
PUSHER_CLUSTER=                 # Pusher cluster
LIVEKIT_URL=                    # LiveKit server URL
LIVEKIT_API_KEY=                # LiveKit API key
LIVEKIT_API_SECRET=             # LiveKit API secret
```

## Testing

```bash
# Run tests with database
npm test

# Run unit tests only (no database required)
SKIP_ENV_VALIDATION=1 npx vitest run src/test/table.redact.test.ts

# Type checking
npm run typecheck

# Linting
npm run lint

# Format checking
npm run format:check
```

### Unit Tests

- `src/test/table.redact.test.ts`: Tests for `redactSnapshotForUser` function (card visibility logic)

### Table scenario harness

- Scenarios live in `src/test/table.scenarios/*.ts`; `src/test/table.scenario.harness.test.ts` loads them via glob (do not add `it()` cases in the harness file for new flows).
- Validate step supports `firstToActFor: PlayerKey` to assert `games.assignedSeatId` (see `src/test/scenario.types.ts`, `scenario-step-handlers.ts`).
- Agent guidance: `.cursor/skills/write-table-scenario-test/SKILL.md` (step types, betting order, debugging).

## Deployment

### Next.js Application

Deploy to Vercel, Railway, or any Node.js hosting:

```bash
npm run build
npm start
```

### Lambda Consumer

Deploy using Serverless Framework from the repo root (runs build + `serverless deploy` in `lambda/consumer`; requires env vars / `.env` as documented there):

```bash
npm run lambda:deploy
# production stage:
npm run lambda:deploy:prod
```

Or from `lambda/consumer` only:

```bash
cd lambda/consumer
npm run deploy
```

Or use AWS SAM, CDK, or direct Lambda deployment.

### Database

Use managed PostgreSQL (AWS RDS, Railway, Supabase, etc.) or self-hosted.

### Infrastructure Checklist

- [ ] PostgreSQL database with connection string
- [ ] AWS SQS FIFO queue created
- [ ] AWS IAM credentials for SQS access
- [ ] LiveKit server running (or cloud account)
- [ ] Pusher app created
- [ ] Google OAuth app configured
- [ ] Environment variables set in hosting platform
- [ ] Lambda function deployed (or always-on worker)
- [ ] Raspberry Pi devices configured and running

## Project Structure

```
huffle-shuffle/
├── src/
│   ├── app/                    # Next.js app router (API routes)
│   ├── components/             # React components
│   │   ├── ui/                 # UI components (seats, cards, etc.)
│   │   │   ├── mobile/         # Mobile-specific components
│   │   │   │   ├── betting-view.tsx
│   │   │   │   ├── community-cards-display.tsx
│   │   │   │   ├── seat-section.tsx
│   │   │   │   ├── table-layout.tsx
│   │   │   │   ├── table-tabs.tsx
│   │   │   │   └── index.ts
│   │   │   └── ...
│   │   ├── livekit/            # LiveKit-specific components
│   │   └── table-setup/        # Table configuration modals
│   ├── hooks/                  # React hooks
│   │   ├── use-table-selectors.ts  # Table state selectors
│   │   ├── use-table-query.ts     # Table data fetching
│   │   ├── use-is-mobile-landscape.ts  # Mobile landscape detection
│   │   └── ...
│   ├── pages/                  # Next.js pages
│   │   └── table/[id].tsx     # Main table view
│   ├── server/
│   │   ├── api/
│   │   │   ├── routers/        # tRPC routers
│   │   │   │   └── table.ts    # Table router
│   │   │   ├── game-logic.ts   # Shared game logic
│   │   │   ├── game-utils.ts   # Game utilities
│   │   │   ├── hand-solver.ts  # Poker hand evaluation
│   │   │   └── game-helpers.ts # Betting helpers
│   │   ├── db/
│   │   │   └── schema.ts       # Drizzle schema
│   │   ├── livekit.ts          # LiveKit client
│   │   └── signal.ts           # Pusher signaling
│   ├── stores/                 # Zustand stores
│   ├── utils/                  # Utility functions
│   └── types/                  # TypeScript types
├── raspberrypi/                # Raspberry Pi daemons
│   ├── scanner-daemon.ts       # Card scanner
│   ├── hand-daemon.ts          # Hand camera
│   ├── dealer-daemon.ts        # Dealer camera
│   └── ...
├── lambda/
│   └── consumer/               # AWS Lambda consumer
│       └── consumer.ts         # SQS message processor
├── drizzle/                    # Database migrations
├── docs/                       # Deep-dive documentation (this folder)
└── public/                     # Static assets
```
