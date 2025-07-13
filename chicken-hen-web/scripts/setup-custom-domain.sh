#!/bin/bash

# Script to set up custom domain for WebSocket API

set -e

echo "🌐 Setting up custom domain for WebSocket API..."

DOMAIN="ws.softwarecompanyinabox.com"
STAGE=${1:-prod}
REGION="us-east-1"

# Check if domain already exists
echo "🔍 Checking if custom domain exists..."
EXISTING_DOMAIN=$(aws apigatewayv2 get-domain-names --region $REGION --query "Items[?DomainName=='$DOMAIN'].DomainName" --output text 2>/dev/null || echo "")

if [ -z "$EXISTING_DOMAIN" ]; then
    echo "❌ Custom domain $DOMAIN not found in API Gateway"
    echo "📝 Please ensure you have:"
    echo "   1. A certificate for *.softwarecompanyinabox.com in ACM"
    echo "   2. Proper Route53 hosted zone for softwarecompanyinabox.com"
    echo ""
    echo "🔧 To create the custom domain manually:"
    echo "   1. Go to API Gateway console"
    echo "   2. Navigate to Custom domain names"
    echo "   3. Create domain name: $DOMAIN"
    echo "   4. Select your ACM certificate"
    echo "   5. Add API mapping to your WebSocket API"
else
    echo "✅ Custom domain $DOMAIN found!"
    
    # Get API ID
    API_ID=$(serverless info --stage $STAGE --verbose | grep -o 'WebSocketURL: wss://[^.]*' | cut -d'/' -f3)
    
    if [ ! -z "$API_ID" ]; then
        echo "🔗 WebSocket API ID: $API_ID"
        
        # Check if mapping exists
        MAPPING=$(aws apigatewayv2 get-api-mappings --domain-name $DOMAIN --query "Items[?ApiId=='$API_ID'].ApiMappingId" --output text 2>/dev/null || echo "")
        
        if [ -z "$MAPPING" ]; then
            echo "📝 Creating API mapping..."
            aws apigatewayv2 create-api-mapping \
                --domain-name $DOMAIN \
                --api-id $API_ID \
                --stage $STAGE \
                --region $REGION
            echo "✅ API mapping created!"
        else
            echo "✅ API mapping already exists!"
        fi
        
        # Get the domain configuration
        DOMAIN_CONFIG=$(aws apigatewayv2 get-domain-name --domain-name $DOMAIN --region $REGION)
        REGIONAL_DOMAIN=$(echo $DOMAIN_CONFIG | jq -r '.DomainNameConfigurations[0].ApiGatewayDomainName')
        HOSTED_ZONE_ID=$(echo $DOMAIN_CONFIG | jq -r '.DomainNameConfigurations[0].HostedZoneId')
        
        echo ""
        echo "📝 Route53 Configuration:"
        echo "   Record Name: $DOMAIN"
        echo "   Record Type: A (Alias)"
        echo "   Alias Target: $REGIONAL_DOMAIN"
        echo "   Hosted Zone ID: $HOSTED_ZONE_ID"
        echo ""
        echo "🔧 To update Route53 manually:"
        echo "   1. Go to Route53 console"
        echo "   2. Select your hosted zone for softwarecompanyinabox.com"
        echo "   3. Create/Update A record for 'ws'"
        echo "   4. Enable 'Alias' and select the API Gateway domain"
    fi
fi

echo "✅ Custom domain setup complete!"