#!/bin/bash

# Deploy script for Chicken Hen Game

set -e

echo "🚀 Starting deployment of Chicken Hen Game..."

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo "❌ AWS CLI is not installed. Please install it first."
    exit 1
fi

# Check if Serverless is installed
if ! command -v serverless &> /dev/null; then
    echo "❌ Serverless Framework is not installed. Please install it first."
    exit 1
fi

# Get the stage (default to prod)
STAGE=${1:-prod}
echo "📦 Deploying to stage: $STAGE"

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Deploy serverless backend
echo "🔧 Deploying WebSocket API..."
serverless deploy --stage $STAGE

# Get the outputs
echo "📝 Getting deployment outputs..."
OUTPUTS=$(serverless info --stage $STAGE --verbose)

# Extract the S3 bucket name and CloudFront distribution ID
S3_BUCKET=$(echo "$OUTPUTS" | grep -o 'S3BucketName: [^ ]*' | cut -d' ' -f2)
CLOUDFRONT_URL=$(echo "$OUTPUTS" | grep -o 'StaticSiteURL: [^ ]*' | cut -d' ' -f2)
WEBSOCKET_URL=$(echo "$OUTPUTS" | grep -o 'WebSocketURL: [^ ]*' | cut -d' ' -f2)

echo "📦 S3 Bucket: $S3_BUCKET"
echo "🌐 CloudFront URL: https://$CLOUDFRONT_URL"
echo "🔌 WebSocket URL: $WEBSOCKET_URL"

# Deploy static files to S3 with cache headers
echo "📤 Uploading static files to S3..."
# HTML files - no cache
aws s3 sync ./client s3://$S3_BUCKET/ --delete \
    --exclude '.DS_Store' \
    --exclude '*.sh' \
    --exclude '*.js' \
    --cache-control "no-cache, no-store, must-revalidate" \
    --content-type "text/html"

# JavaScript files - cache with version
aws s3 sync ./client s3://$S3_BUCKET/ --delete \
    --exclude '.DS_Store' \
    --exclude '*.sh' \
    --exclude '*.html' \
    --cache-control "public, max-age=31536000" \
    --content-type "application/javascript"

# Get CloudFront distribution ID
DISTRIBUTION_ID=$(aws cloudfront list-distributions --query "DistributionList.Items[?Origins.Items[0].DomainName=='$S3_BUCKET.s3.amazonaws.com'].Id" --output text)

# Create CloudFront invalidation
if [ ! -z "$DISTRIBUTION_ID" ]; then
    echo "🔄 Creating CloudFront invalidation..."
    aws cloudfront create-invalidation --distribution-id $DISTRIBUTION_ID --paths '/*'
fi

echo "✅ Deployment complete!"
echo ""
echo "🎮 Your game is available at:"
echo "   https://$CLOUDFRONT_URL"
echo ""
echo "🔌 WebSocket endpoint:"
echo "   $WEBSOCKET_URL"
echo ""
echo "📝 Note: Update the WebSocket URL in your Route53 settings if needed"