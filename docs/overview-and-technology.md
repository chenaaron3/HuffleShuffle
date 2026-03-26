# Overview & Technology Stack

## Overview

Huffle Shuffle is a real-time poker table management system that enables:

- **Live Poker Games**: Manage 8-seat poker tables with full Texas Hold'em rules
- **Card Scanning**: Physical card scanning via Raspberry Pi devices with barcode readers
- **Video Streaming**: Live video feeds from dealer camera and individual hand cameras per seat
- **Real-time Updates**: WebSocket-based updates using Pusher for table state synchronization
- **Role-based Access**: Separate dealer and player roles with different permissions
- **Blind Management**: Configurable blind levels with automatic progression timers

## Technology Stack

### Frontend

- **Next.js 15** (App Router) with React 19
- **TypeScript** for type safety
- **tRPC** for type-safe API calls
- **Zustand** for client-side state management
- **Tailwind CSS** for styling
- **Framer Motion** for animations
- **Recharts** for chart visualizations (side pot stacked charts)
- **LiveKit React Components** for video streaming
- **Pusher JS** for real-time events

### Backend

- **Next.js API Routes** (tRPC + REST)
- **Drizzle ORM** with PostgreSQL
- **NextAuth.js** for authentication (Google OAuth)
- **LiveKit Server SDK** for video room management
- **Pusher Server SDK** for device signaling
- **AWS SQS FIFO** for card scan message queue

### Infrastructure

- **PostgreSQL** database
- **AWS SQS FIFO** for message queuing
- **AWS Lambda** for card ingestion (optional, can use always-on worker)
- **LiveKit** for WebRTC video streaming
- **Pusher** for WebSocket signaling

### Raspberry Pi Components

- **Node.js** daemons for device management
- **libcamera-vid** for hand camera streaming
- **GStreamer** for dealer camera streaming
- **LiveKit CLI** for H.264 stream publishing
