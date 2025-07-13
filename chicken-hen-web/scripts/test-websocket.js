const WebSocket = require('ws');

const wsUrl = 'wss://y4bhad7iq9.execute-api.us-east-1.amazonaws.com/prod';
console.log('🔌 Testing WebSocket connection to:', wsUrl);

const ws = new WebSocket(wsUrl);

ws.on('open', () => {
    console.log('✅ Connected to WebSocket server');
    
    // Send join message
    console.log('📤 Sending join message...');
    ws.send(JSON.stringify({
        action: 'join',
        data: {}
    }));
    
    // Test move after 2 seconds
    setTimeout(() => {
        console.log('📤 Sending move message...');
        ws.send(JSON.stringify({
            action: 'move',
            data: {
                pos: { x: 100, y: 200 },
                vel: { x: 5, y: 0 },
                jumping: false
            }
        }));
    }, 2000);
    
    // Test jump after 4 seconds
    setTimeout(() => {
        console.log('📤 Sending jump message...');
        ws.send(JSON.stringify({
            action: 'jump',
            data: {}
        }));
    }, 4000);
    
    // Close connection after 6 seconds
    setTimeout(() => {
        console.log('👋 Closing connection...');
        ws.close();
        process.exit(0);
    }, 6000);
});

ws.on('message', (data) => {
    const message = JSON.parse(data.toString());
    console.log('📥 Received:', message.type);
    if (message.type === 'joined') {
        console.log('   Player ID:', message.playerId);
    } else if (message.type === 'gameState') {
        console.log('   Players:', Object.keys(message.data.players).length);
        console.log('   Enemies:', message.data.enemies.length);
        console.log('   Platforms:', message.data.platforms.length);
    }
});

ws.on('error', (error) => {
    console.error('❌ WebSocket error:', error.message);
    process.exit(1);
});

ws.on('close', () => {
    console.log('🔌 Connection closed');
});