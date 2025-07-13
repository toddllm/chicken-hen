const AWS = require('aws-sdk');
const dynamodb = new AWS.DynamoDB.DocumentClient();
const apiGateway = new AWS.ApiGatewayManagementApi({
    endpoint: process.env.WEBSOCKET_ENDPOINT
});

const CONNECTIONS_TABLE = process.env.CONNECTIONS_TABLE || 'chicken-hen-connections';
const GAME_STATE_TABLE = process.env.GAME_STATE_TABLE || 'chicken-hen-game-state';

// Game constants
const WIDTH = 800;
const HEIGHT = 450;
const GRAVITY = 0.8;

// Attack damage values
const ATTACK_DAMAGE = {
    peck: 15,
    kick: 25,
    punch: 20,
    egg: 30,
    ko: 50,
    throw: 40
};

// Attack ranges
const ATTACK_RANGES = {
    peck: 30,
    kick: 30,
    punch: 35,
    egg: 200, // Ranged attack
    ko: 60,   // AoE attack
    throw: 50
};

// Level definitions
const levels = [
    // Level 1 - Greenfield
    {
        platforms: [
            { x: 0, y: HEIGHT - 20, w: WIDTH, h: 20, type: 'normal' },
            { x: 200, y: 300, w: 100, h: 20, type: 'moving' },
            { x: 400, y: 200, w: 100, h: 20, type: 'fading' }
        ],
        enemies: [
            { pos: { x: 600, y: 400 }, color: 'green', name: 'Gumpa', speed: 2, health: 30 },
            { pos: { x: 700, y: 400 }, color: 'blue', name: 'Stende', speed: -2, health: 30 }
        ],
        zeldina: { x: 700, y: HEIGHT - 60, rescued: false }
    },
    // Level 2 - Enchanted Desert
    {
        platforms: [
            { x: 0, y: HEIGHT - 20, w: WIDTH, h: 20, type: 'normal' },
            { x: 100, y: 350, w: 100, h: 20, type: 'normal' },
            { x: 300, y: 250, w: 100, h: 20, type: 'moving' }
        ],
        enemies: [
            { pos: { x: 500, y: 300 }, color: 'yellow', name: 'Turtle', speed: 1, health: 40 },
            { pos: { x: 600, y: 200 }, color: 'red', name: 'Fish', speed: -2, health: 35 }
        ],
        zeldina: { x: 700, y: HEIGHT - 60, rescued: false }
    },
    // Level 3 - Ranka
    {
        platforms: [
            { x: 0, y: HEIGHT - 20, w: WIDTH, h: 20, type: 'normal' },
            { x: 150, y: 320, w: 80, h: 20, type: 'moving' },
            { x: 450, y: 220, w: 120, h: 20, type: 'normal' }
        ],
        enemies: [
            { pos: { x: 400, y: 400 }, color: 'green', name: 'Dragon', speed: 3, health: 60 }
        ],
        zeldina: { x: 700, y: HEIGHT - 60, rescued: false }
    },
    // Level 4 - Ruins
    {
        platforms: [
            { x: 0, y: HEIGHT - 20, w: WIDTH, h: 20, type: 'normal' },
            { x: 250, y: 280, w: 100, h: 20, type: 'fading' },
            { x: 500, y: 180, w: 100, h: 20, type: 'normal' }
        ],
        enemies: [
            { pos: { x: 300, y: 400 }, color: 'red', name: 'Dungeon Creature', speed: 2, health: 50 },
            { pos: { x: 550, y: 180 }, color: 'blue', name: 'Gumpa', speed: -1, health: 30 }
        ],
        zeldina: { x: 700, y: HEIGHT - 60, rescued: false }
    }
];

// Game state
let gameState = {
    players: {},
    enemies: [],
    platforms: [],
    zeldina: null,
    boss: null,
    currentLevel: 0,
    projectiles: []
};

// Initialize game state
function initializeGameState() {
    loadLevel(0);
}

// Load level
function loadLevel(levelIndex) {
    if (levelIndex >= levels.length) return false;
    
    const level = levels[levelIndex];
    gameState.currentLevel = levelIndex;
    gameState.platforms = JSON.parse(JSON.stringify(level.platforms));
    gameState.enemies = JSON.parse(JSON.stringify(level.enemies));
    gameState.zeldina = JSON.parse(JSON.stringify(level.zeldina));
    gameState.boss = null;
    gameState.projectiles = [];
    
    // Reset player positions and health
    for (let playerId in gameState.players) {
        gameState.players[playerId].pos = { x: 50, y: 400 };
        gameState.players[playerId].vel = { x: 0, y: 0 };
        gameState.players[playerId].lives = gameState.players[playerId].lives || 3;
        gameState.players[playerId].health = gameState.players[playerId].maxHealth || 100;
    }
    
    return true;
}

// Calculate distance between two points
function getDistance(pos1, pos2) {
    const dx = pos1.x - pos2.x;
    const dy = pos1.y - pos2.y;
    return Math.sqrt(dx * dx + dy * dy);
}

// Apply damage with PVP reduction
function applyDamage(target, damage, isPlayerAttacker = false) {
    let finalDamage = damage;
    
    // 50% damage reduction for PVP
    if (isPlayerAttacker && target.health !== undefined) {
        finalDamage = Math.floor(damage * 0.5);
    }
    
    // Critical hit chance (10%)
    if (Math.random() < 0.1) {
        finalDamage *= 2;
    }
    
    if (target.health !== undefined) {
        target.health -= finalDamage;
        if (target.health < 0) target.health = 0;
    }
    
    return finalDamage;
}

// Handle attack action
async function handleAttack(event) {
    const connectionId = event.requestContext.connectionId;
    const data = JSON.parse(event.body).data;
    const attacker = gameState.players[connectionId];
    
    if (!attacker) return { statusCode: 200, body: 'No attacker found' };
    
    const attackType = data.type;
    const attackPos = data.pos;
    const direction = data.direction;
    const damage = ATTACK_DAMAGE[attackType];
    const range = ATTACK_RANGES[attackType];
    
    // Apply Mega Chicken damage multiplier
    const finalDamage = attacker.isMegaChicken ? damage * 2 : damage;
    
    let hitTargets = [];
    
    // Check for player hits (PVP)
    for (let playerId in gameState.players) {
        if (playerId === connectionId) continue; // Don't hit yourself
        
        const target = gameState.players[playerId];
        const distance = getDistance(attackPos, target.pos);
        
        if (distance <= range) {
            const damageDealt = applyDamage(target, finalDamage, true);
            hitTargets.push({
                type: 'player',
                id: playerId,
                damage: damageDealt,
                pos: target.pos
            });
            
            // Check if player is eliminated
            if (target.health <= 0) {
                target.lives--;
                if (target.lives > 0) {
                    // Respawn
                    target.health = target.maxHealth || 100;
                    target.pos = { x: 50, y: 400 };
                    target.invulnerable = 180; // 3 seconds at 60 FPS
                } else {
                    // Player eliminated
                    delete gameState.players[playerId];
                    await broadcast({
                        type: 'playerEliminated',
                        playerId: playerId,
                        eliminatedBy: connectionId
                    });
                }
            }
        }
    }
    
    // Check for enemy hits
    for (let i = gameState.enemies.length - 1; i >= 0; i--) {
        const enemy = gameState.enemies[i];
        const distance = getDistance(attackPos, enemy.pos);
        
        if (distance <= range) {
            const damageDealt = applyDamage(enemy, finalDamage, false);
            hitTargets.push({
                type: 'enemy',
                damage: damageDealt,
                pos: enemy.pos
            });
            
            if (enemy.health <= 0) {
                // Enemy killed
                gameState.enemies.splice(i, 1);
                await broadcast({
                    type: 'enemyKilled',
                    data: enemy.pos
                });
                
                // Chance to drop Golden Egg
                if (Math.random() < 0.1) {
                    attacker.hasGoldenEgg = true;
                    await sendToConnection(connectionId, {
                        type: 'itemReceived',
                        item: 'goldenEgg'
                    });
                }
            }
        }
    }
    
    // Handle special attacks
    if (attackType === 'egg') {
        // Create projectile
        gameState.projectiles.push({
            pos: { x: attackPos.x, y: attackPos.y },
            vel: { x: direction * 10, y: -5 },
            damage: finalDamage,
            ownerId: connectionId,
            type: 'egg'
        });
    }
    
    // Broadcast attack event
    await broadcast({
        type: 'attackPerformed',
        data: {
            attackerId: connectionId,
            attackType: attackType,
            pos: attackPos,
            direction: direction,
            hits: hitTargets
        }
    });
    
    return { statusCode: 200, body: 'Attack processed' };
}

// Handle Mega Chicken transformation
async function handleMegaTransform(event) {
    const connectionId = event.requestContext.connectionId;
    const player = gameState.players[connectionId];
    
    if (!player || !player.hasGoldenEgg) {
        return { statusCode: 200, body: 'Transformation failed' };
    }
    
    // Activate Mega Chicken
    player.isMegaChicken = true;
    player.megaChickenTimer = 1800; // 30 seconds at 60 FPS
    player.maxHealth = 200;
    player.health = 200;
    player.hasGoldenEgg = false; // Consume Golden Egg
    
    await broadcast({
        type: 'megaTransform',
        data: {
            playerId: connectionId,
            active: true
        }
    });
    
    return { statusCode: 200, body: 'Mega transformation activated' };
}

// Send message to specific connection
async function sendToConnection(connectionId, data) {
    try {
        await apiGateway.postToConnection({
            ConnectionId: connectionId,
            Data: JSON.stringify(data)
        }).promise();
    } catch (error) {
        if (error.statusCode === 410) {
            // Connection no longer exists, remove it
            await removeConnection(connectionId);
        }
        console.error('Error sending to connection:', error);
    }
}

// Broadcast to all connections
async function broadcast(data, excludeConnectionId = null) {
    const connections = await getActiveConnections();
    
    const sendPromises = connections
        .filter(conn => conn.connectionId !== excludeConnectionId)
        .map(conn => sendToConnection(conn.connectionId, data));
    
    await Promise.allSettled(sendPromises);
}

// Get active connections
async function getActiveConnections() {
    try {
        const result = await dynamodb.scan({
            TableName: CONNECTIONS_TABLE
        }).promise();
        return result.Items || [];
    } catch (error) {
        console.error('Error getting connections:', error);
        return [];
    }
}

// Add connection
async function addConnection(connectionId) {
    try {
        await dynamodb.put({
            TableName: CONNECTIONS_TABLE,
            Item: {
                connectionId,
                timestamp: Date.now()
            }
        }).promise();
    } catch (error) {
        console.error('Error adding connection:', error);
    }
}

// Remove connection
async function removeConnection(connectionId) {
    try {
        await dynamodb.delete({
            TableName: CONNECTIONS_TABLE,
            Key: { connectionId }
        }).promise();
        
        // Remove player from game
        if (gameState.players[connectionId]) {
            delete gameState.players[connectionId];
            await broadcast({
                type: 'playerLeft',
                playerId: connectionId
            });
        }
    } catch (error) {
        console.error('Error removing connection:', error);
    }
}

// Handle connect
async function handleConnect(event) {
    const connectionId = event.requestContext.connectionId;
    await addConnection(connectionId);
    return { statusCode: 200, body: 'Connected' };
}

// Handle disconnect
async function handleDisconnect(event) {
    const connectionId = event.requestContext.connectionId;
    await removeConnection(connectionId);
    return { statusCode: 200, body: 'Disconnected' };
}

// Handle join
async function handleJoin(event) {
    const connectionId = event.requestContext.connectionId;
    
    // Initialize game state if empty
    if (gameState.platforms.length === 0) {
        console.log('Initializing game state on first join');
        initializeGameState();
    }
    
    // Add player to game
    gameState.players[connectionId] = {
        pos: { x: 50, y: 400 },
        vel: { x: 0, y: 0 },
        jumping: false,
        lives: 3,
        health: 100,
        maxHealth: 100,
        stamina: 100,
        maxStamina: 100,
        isMegaChicken: false,
        megaChickenTimer: 0,
        hasGoldenEgg: false,
        invulnerable: 0,
        score: 0
    };
    
    // Send joined confirmation
    await sendToConnection(connectionId, {
        type: 'joined',
        playerId: connectionId
    });
    
    // Send current game state
    console.log('Sending game state:', JSON.stringify({
        platforms: gameState.platforms.length,
        enemies: gameState.enemies.length,
        players: Object.keys(gameState.players).length
    }));
    
    await sendToConnection(connectionId, {
        type: 'gameState',
        data: gameState
    });
    
    // Notify others
    await broadcast({
        type: 'playerUpdate',
        data: {
            id: connectionId,
            pos: gameState.players[connectionId].pos,
            vel: gameState.players[connectionId].vel,
            jumping: gameState.players[connectionId].jumping,
            health: gameState.players[connectionId].health,
            maxHealth: gameState.players[connectionId].maxHealth,
            isMegaChicken: gameState.players[connectionId].isMegaChicken
        }
    }, connectionId);
    
    return { statusCode: 200, body: 'Joined' };
}

// Handle move
async function handleMove(event) {
    const connectionId = event.requestContext.connectionId;
    const data = JSON.parse(event.body).data;
    
    if (gameState.players[connectionId]) {
        gameState.players[connectionId].pos = data.pos;
        gameState.players[connectionId].vel = data.vel;
        gameState.players[connectionId].jumping = data.jumping;
        
        // Check collisions
        await checkCollisions(connectionId);
        
        // Broadcast player update
        await broadcast({
            type: 'playerUpdate',
            data: {
                id: connectionId,
                pos: data.pos,
                vel: data.vel,
                jumping: data.jumping,
                health: gameState.players[connectionId].health,
                maxHealth: gameState.players[connectionId].maxHealth,
                isMegaChicken: gameState.players[connectionId].isMegaChicken
            }
        }, connectionId);
    }
    
    return { statusCode: 200, body: 'Moved' };
}

// Handle jump
async function handleJump(event) {
    const connectionId = event.requestContext.connectionId;
    
    if (gameState.players[connectionId] && !gameState.players[connectionId].jumping) {
        gameState.players[connectionId].vel.y = -15;
        gameState.players[connectionId].jumping = true;
        
        await broadcast({
            type: 'playerUpdate',
            data: {
                id: connectionId,
                pos: gameState.players[connectionId].pos,
                vel: gameState.players[connectionId].vel,
                jumping: true,
                health: gameState.players[connectionId].health,
                maxHealth: gameState.players[connectionId].maxHealth,
                isMegaChicken: gameState.players[connectionId].isMegaChicken
            }
        });
    }
    
    return { statusCode: 200, body: 'Jumped' };
}

// Handle smash
async function handleSmash(event) {
    const connectionId = event.requestContext.connectionId;
    const player = gameState.players[connectionId];
    
    if (!player) return { statusCode: 200, body: 'No player' };
    
    // Check enemy smash
    for (let i = gameState.enemies.length - 1; i >= 0; i--) {
        const enemy = gameState.enemies[i];
        const dx = Math.abs(player.pos.x - enemy.pos.x);
        const dy = Math.abs(player.pos.y - enemy.pos.y);
        
        if (dx < 30 && dy < 30 && player.vel.y > 0) {
            // Enemy killed
            gameState.enemies.splice(i, 1);
            await broadcast({
                type: 'enemyKilled',
                data: enemy.pos
            });
        }
    }
    
    // Check boss smash
    if (gameState.boss) {
        const dx = Math.abs(player.pos.x - gameState.boss.x);
        const dy = Math.abs(player.pos.y - gameState.boss.y);
        
        if (dx < 70 && dy < 70 && player.vel.y > 0) {
            gameState.boss.health--;
            
            if (gameState.boss.health <= 0) {
                // Boss defeated
                gameState.boss = null;
                gameState.currentLevel++;
                
                if (gameState.currentLevel >= levels.length) {
                    // Game won!
                    await broadcast({ type: 'gameWin' });
                } else {
                    // Next level
                    loadLevel(gameState.currentLevel);
                    await broadcast({
                        type: 'levelComplete',
                        data: {
                            level: gameState.currentLevel,
                            ...gameState
                        }
                    });
                }
            } else {
                await broadcast({
                    type: 'bossUpdate',
                    data: gameState.boss
                });
            }
        }
    }
    
    return { statusCode: 200, body: 'Smashed' };
}

// Check collisions
async function checkCollisions(playerId) {
    const player = gameState.players[playerId];
    if (!player || player.invulnerable > 0) return;
    
    // Enemy collisions
    for (const enemy of gameState.enemies) {
        const dx = Math.abs(player.pos.x - enemy.pos.x);
        const dy = Math.abs(player.pos.y - enemy.pos.y);
        
        if (dx < 30 && dy < 30 && player.vel.y <= 0) {
            // Player hit
            applyDamage(player, 25, false);
            player.invulnerable = 120; // 2 seconds at 60 FPS
            
            if (player.health <= 0) {
                player.lives--;
                if (player.lives > 0) {
                    // Respawn
                    player.health = player.maxHealth;
                    player.pos = { x: 50, y: 400 };
                    player.vel = { x: 0, y: 0 };
                } else {
                    // Remove player
                    delete gameState.players[playerId];
                    await broadcast({
                        type: 'playerLeft',
                        playerId
                    });
                }
            }
            
            await sendToConnection(playerId, {
                type: 'playerDamaged',
                damage: 25,
                health: player.health
            });
            return;
        }
    }
    
    // Zeldina interaction
    if (gameState.zeldina && !gameState.zeldina.rescued) {
        const dx = Math.abs(player.pos.x - gameState.zeldina.x);
        const dy = Math.abs(player.pos.y - gameState.zeldina.y);
        
        if (dx < 30 && dy < 30) {
            gameState.zeldina.rescued = true;
            
            // Spawn boss
            gameState.boss = {
                x: WIDTH / 2,
                y: 100,
                health: 5
            };
            
            await broadcast({ type: 'zeldinaRescued' });
            await broadcast({
                type: 'bossSpawned',
                data: gameState.boss
            });
        }
    }
}

// Lambda handler
exports.handler = async (event) => {
    const routeKey = event.requestContext.routeKey;
    
    try {
        switch (routeKey) {
            case '$connect':
                return await handleConnect(event);
                
            case '$disconnect':
                return await handleDisconnect(event);
                
            case '$default':
                const body = JSON.parse(event.body);
                const action = body.action;
                
                switch (action) {
                    case 'join':
                        return await handleJoin(event);
                    case 'move':
                        return await handleMove(event);
                    case 'jump':
                        return await handleJump(event);
                    case 'smash':
                        return await handleSmash(event);
                    case 'attack':
                        return await handleAttack(event);
                    case 'megaTransform':
                        return await handleMegaTransform(event);
                    default:
                        return { statusCode: 400, body: 'Unknown action' };
                }
                
            default:
                return { statusCode: 400, body: 'Unknown route' };
        }
    } catch (error) {
        console.error('Handler error:', error);
        return { statusCode: 500, body: 'Internal server error' };
    }
};

// Initialize game on cold start
initializeGameState();