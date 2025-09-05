# Huffle Shuffle Lambda Consumer

This directory contains the AWS Lambda function for processing SQS messages from card scanners.

## Directory Structure

```
lambda/consumer/
├── consumer.ts          # Main Lambda function code
├── serverless.yml       # Serverless Framework configuration
├── tsconfig.json        # TypeScript configuration
├── package.json         # Dependencies and scripts
├── test-event.json      # Sample SQS event for local testing
├── env.example          # Environment variables template
└── README.md           # This file
```

## Quick Start

### 1. Install Dependencies

```bash
cd lambda/consumer
npm install
```

### 2. Set Environment Variables

```bash
cp env.example .env
# Edit .env with your actual values
```

### 3. Build the Function

```bash
npm run build
```

### 4. Deploy to AWS

```bash
npm run deploy
```

## Development

### Local Testing

Test the function locally with sample data:

```bash
npm run invoke:local
```

### Watch Mode

Rebuild automatically on file changes:

```bash
npm run build:watch
```

### View Logs

View CloudWatch logs for the deployed function:

```bash
npm run logs
```

## Scripts

- `npm run build` - Build the TypeScript to JavaScript
- `npm run build:watch` - Watch mode for development
- `npm run deploy` - Build and deploy to AWS
- `npm run deploy:prod` - Deploy to production stage
- `npm run remove` - Remove the function from AWS
- `npm run logs` - View CloudWatch logs
- `npm run invoke:local` - Test locally with sample event

## Configuration

### Environment Variables

Required environment variables:

- `DATABASE_URL` - PostgreSQL connection string (external database)
- `SQS_QUEUE_URL` - SQS queue URL
- `SQS_QUEUE_ARN` - SQS queue ARN
- `PUSHER_APP_ID` - Pusher application ID for real-time updates
- `PUSHER_KEY` - Pusher public key
- `PUSHER_SECRET` - Pusher secret key
- `PUSHER_CLUSTER` - Pusher cluster identifier

### Lambda Settings

- **Runtime**: Node.js 18.x
- **Memory**: 512 MB
- **Timeout**: 30 seconds
- **Concurrency**: 10 reserved

### SQS Event Source

- **Batch Size**: 5 messages per invocation
- **Batching Window**: 5 seconds maximum wait
- **Error Handling**: Failed messages return to queue for retry

## Architecture

The Lambda function:

1. Receives SQS messages in batches
2. Processes each message (card scan)
3. Updates device status in database
4. Deals cards using game logic
5. Sends real-time updates via Pusher
6. Deletes successfully processed messages
7. Returns failed message IDs for retry

## Dependencies

### Runtime Dependencies

- `@aws-sdk/client-sqs` - AWS SQS client
- `drizzle-orm` - Database ORM
- `postgres` - PostgreSQL driver
- `pusher` - Real-time messaging service
- `dotenv` - Environment variable loading

### Development Dependencies

- `@types/aws-lambda` - Lambda type definitions
- `serverless` - Serverless Framework
- `serverless-esbuild` - ESBuild bundling
- `typescript` - TypeScript compiler

## Troubleshooting

### Common Issues

1. **Import Paths**: The function uses relative imports to access shared code from `../../src/`
2. **Database Connection**: Ensure RDS security groups allow Lambda access
3. **SQS Permissions**: Verify IAM role has proper SQS permissions

### Performance

- Cold starts: ~200-500ms (acceptable for 1-second tolerance)
- Warm invocations: ~50-100ms
- Connection reuse: Database and SQS clients are reused across invocations

## Deployment

The function is deployed using the Serverless Framework with:

- Automatic SQS event source mapping
- IAM role with minimal required permissions
- CloudWatch logging and metrics
- Easy rollback capabilities

## Monitoring

- **CloudWatch Logs**: View execution logs and errors
- **CloudWatch Metrics**: Monitor invocation count, duration, errors
- **SQS Console**: Check queue depth and message processing
