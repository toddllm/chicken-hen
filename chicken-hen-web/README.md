# Chicken Hen Multiplayer Adventure - Web Version

A multiplayer web-based version of the Chicken Hen Adventure game, deployed on AWS using Lambda, API Gateway WebSockets, DynamoDB, S3, and CloudFront.

## Architecture

- **Frontend**: HTML5 Canvas + JavaScript (vanilla)
- **WebSocket Server**: AWS Lambda + API Gateway WebSockets
- **Database**: DynamoDB (connections and game state)
- **Static Hosting**: S3 + CloudFront
- **Custom Domain**: ws.softwarecompanyinabox.com (WebSocket endpoint)

## Prerequisites

1. **AWS Account** with appropriate permissions
2. **AWS CLI** configured with credentials
3. **Node.js** (v18 or later)
4. **Serverless Framework** installed globally:
   ```bash
   npm install -g serverless
   ```
5. **Custom Domain Setup** (if using ws.softwarecompanyinabox.com):
   - ACM certificate for *.softwarecompanyinabox.com
   - Route53 hosted zone for softwarecompanyinabox.com

## Installation

1. Navigate to the web project directory:
   ```bash
   cd chicken-hen-web
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

## Deployment

### Quick Deploy (Production)

```bash
./scripts/deploy.sh
```

### Deploy to Different Stage

```bash
./scripts/deploy.sh dev
# or
npm run deploy:dev
```

### Manual Deployment Steps

1. **Deploy the serverless backend**:
   ```bash
   serverless deploy --stage prod
   ```

2. **Note the outputs** (S3 bucket name, CloudFront URL, WebSocket URL)

3. **Deploy static files**:
   ```bash
   aws s3 sync ./client s3://YOUR-S3-BUCKET-NAME/ --delete
   ```

4. **Create CloudFront invalidation** (if updating):
   ```bash
   aws cloudfront create-invalidation --distribution-id YOUR-DISTRIBUTION-ID --paths '/*'
   ```

### Custom Domain Setup

To set up ws.softwarecompanyinabox.com:

```bash
./scripts/setup-custom-domain.sh
```

This script will:
- Check if the custom domain exists in API Gateway
- Create API mapping for your WebSocket API
- Provide Route53 configuration details

## Game Features

- **Multiplayer Support**: Multiple players can join and play together
- **4 Levels**: Greenfield, Enchanted Desert, Ranka, and Ruins
- **Enemy Types**: Gumpa, Stende, Turtle, Fish, Dragon, Dungeon Creatures
- **Platform Types**: Normal, Moving, and Fading platforms
- **Boss Fight**: Defeat the boss after rescuing Zeldina
- **Real-time Synchronization**: All player movements and actions are synchronized
- **Collision Events**: Detect when a player crushes an enemy or takes damage

## Game Controls

- **Arrow Left/Right**: Move left/right
- **Space**: Jump
- **Down Arrow**: Smash (when jumping on enemies)

## Development

### Local Testing

For local development, you'll need to:

1. Set up a local WebSocket server (modify the server code to use ws library instead of AWS SDK)
2. Update the client to connect to localhost
3. Use a local DynamoDB instance or mock

### Project Structure

```
chicken-hen-web/
├── client/              # Frontend files
│   ├── index.html      # Main HTML file
│   └── game.js         # Game logic and WebSocket client
├── server/             # Backend files
│   └── websocket-handler.js  # Lambda WebSocket handler
├── scripts/            # Deployment scripts
│   ├── deploy.sh       # Main deployment script
│   └── setup-custom-domain.sh  # Custom domain setup
├── serverless.yml      # Serverless Framework configuration
├── package.json        # Node.js dependencies
└── README.md          # This file
```

## Monitoring

### View Lambda Logs

```bash
npm run logs
# or
serverless logs -f defaultHandler -t
```

### CloudWatch Metrics

Monitor your game through AWS CloudWatch:
- Lambda invocations and errors
- API Gateway requests
- DynamoDB read/write capacity
- CloudFront cache statistics

## Troubleshooting

### WebSocket Connection Issues

1. **Check CORS**: Ensure API Gateway allows your domain
2. **Check Route53**: Verify DNS records for ws.softwarecompanyinabox.com
3. **Check Certificate**: Ensure ACM certificate is valid and in us-east-1
4. **Check API Mapping**: Verify custom domain is mapped to your API

### Game State Issues

1. **Clear DynamoDB Tables**: Remove stale connections
2. **Check Lambda Logs**: Look for errors in CloudWatch
3. **Verify Permissions**: Ensure Lambda has DynamoDB access

### Deployment Issues

1. **Serverless Framework**: Update to latest version
2. **AWS Credentials**: Verify AWS CLI is configured
3. **Region Mismatch**: Ensure consistent region usage

## Cost Optimization

- **Lambda**: Billed per invocation and duration
- **API Gateway**: $1 per million WebSocket messages
- **DynamoDB**: Pay-per-request pricing
- **CloudFront**: Minimal cost for low traffic
- **S3**: Negligible for small static files

## Security Considerations

- **Input Validation**: Server validates all player actions
- **DynamoDB Encryption**: Tables use SSE
- **HTTPS Only**: CloudFront redirects HTTP to HTTPS
- **API Gateway**: Can add API keys or custom authorizers

## Future Enhancements

- [ ] Player authentication and profiles
- [ ] Leaderboards and statistics
- [ ] More levels and enemy types
- [ ] Power-ups and special abilities
- [ ] Mobile touch controls
- [ ] Sound effects and music
- [ ] Chat system
- [ ] Spectator mode

## License

MIT License - See LICENSE file for details