// WebSocket connection - using API Gateway URL directly for now
// TODO: Update to wss://ws.softwarecompanyinabox.com once Route53 is configured
const wsUrl = 'wss://y4bhad7iq9.execute-api.us-east-1.amazonaws.com/prod';
let socket = null;
let reconnectTimer = null;
let reconnectDelay = 1000;

// Canvas and context will be initialized after DOM loads
let canvas = null;
let ctx = null;
let statusEl = null;

const WIDTH = 800;
const HEIGHT = 450;
const ACC = 0.5;
const FRIC = -0.12;
const GRAVITY = 0.8;

let players = {};
let enemies = [];
let platforms = [];
let zeldina = null;
let boss = null;
let myId = null;
let lives = 3;
let currentLevel = 0;

// New game state variables
let gameMode = 'platformer'; // 'platformer', 'board', 'minigame', 'medley'
let playerStats = {
    health: 100,
    maxHealth: 100,
    stamina: 100,
    maxStamina: 100,
    coins: 0,
    isMegaChicken: false,
    megaChickenTimer: 0,
    hasGoldenEgg: false,
    lastAttackTime: 0,
    attackCooldowns: {
        peck: 0, kick: 0, punch: 0, egg: 0, ko: 0, throw: 0
    }
};

class Vector {
    constructor(x, y) {
        this.x = x || 0;
        this.y = y || 0;
    }
}

class Player {
    constructor(id) {
        this.id = id;
        this.pos = new Vector(50, 400);
        this.vel = new Vector(0, 0);
        this.acc = new Vector(0, 0);
        this.jumping = false;
        this.smashing = false;
        this.invulnerable = 0;
        this.health = 100;
        this.maxHealth = 100;
        this.stamina = 100;
        this.maxStamina = 100;
        this.isMegaChicken = false;
        this.megaChickenTimer = 0;
        this.attacking = false;
        this.attackType = '';
        this.attackTimer = 0;
    }

    move(keys) {
        this.acc = new Vector(0, GRAVITY);

        if (keys.left) this.acc.x = -ACC;
        if (keys.right) this.acc.x = ACC;

        this.acc.x += this.vel.x * FRIC;
        this.vel.x += this.acc.x;
        this.vel.y += this.acc.y;
        this.pos.x += this.vel.x + 0.5 * this.acc.x;
        this.pos.y += this.vel.y + 0.5 * this.acc.y;

        if (this.pos.x > WIDTH - 20) this.pos.x = WIDTH - 20;
        if (this.pos.x < 20) this.pos.x = 20;
    }

    jump() {
        if (!this.jumping) {
            this.vel.y = -15;
            this.jumping = true;
        }
    }

    // New attack methods
    attack(type) {
        const now = Date.now();
        const cooldowns = {
            peck: 500, kick: 1000, punch: 800, egg: 2000, ko: 5000, throw: 3000
        };
        const staminaCosts = {
            peck: 10, kick: 15, punch: 12, egg: 20, ko: 30, throw: 25
        };
        
        if (this.id !== myId) return; // Only allow own player to attack
        
        if (now - playerStats.lastAttackTime < cooldowns[type]) return;
        if (playerStats.stamina < staminaCosts[type]) return;
        
        playerStats.lastAttackTime = now;
        playerStats.stamina -= staminaCosts[type];
        
        this.attacking = true;
        this.attackType = type;
        this.attackTimer = 30; // Animation frames
        
        // Send attack to server
        sendAttack(type);
    }

    update() {
        // Update invulnerability
        if (this.invulnerable > 0) {
            this.invulnerable--;
        }

        // Update attack animation
        if (this.attackTimer > 0) {
            this.attackTimer--;
            if (this.attackTimer <= 0) {
                this.attacking = false;
                this.attackType = '';
            }
        }

        // Update Mega Chicken timer
        if (this.isMegaChicken && this.megaChickenTimer > 0) {
            this.megaChickenTimer--;
            if (this.megaChickenTimer <= 0) {
                this.isMegaChicken = false;
                this.maxHealth = 100;
                if (this.health > 100) this.health = 100;
            }
        }

        // Health regeneration (5 HP per second when not in combat for 5 seconds)
        if (Date.now() - playerStats.lastAttackTime > 5000 && this.health < this.maxHealth) {
            this.health += 5/60; // 5 HP per second at 60 FPS
            if (this.health > this.maxHealth) this.health = this.maxHealth;
        }

        // Stamina regeneration (10 per second)
        if (this.stamina < this.maxStamina) {
            this.stamina += 10/60;
            if (this.stamina > this.maxStamina) this.stamina = this.maxStamina;
        }

        // Collision with platforms
        platforms.forEach(plat => {
            if (this.vel.y > 0 && 
                this.pos.y + 25 > plat.y && 
                this.pos.y < plat.y + plat.h &&
                this.pos.x + 20 > plat.x && 
                this.pos.x - 20 < plat.x + plat.w) {
                this.pos.y = plat.y - 25;
                this.vel.y = 0;
                this.jumping = false;
            }
        });

        // Keep player on ground
        if (this.pos.y > HEIGHT - 45) {
            this.pos.y = HEIGHT - 45;
            this.vel.y = 0;
            this.jumping = false;
        }
    }

    draw() {
        // Flash when invulnerable
        if (this.invulnerable > 0 && this.invulnerable % 10 < 5) {
            ctx.globalAlpha = 0.5;
        }

        // Mega Chicken glow effect
        if (this.isMegaChicken) {
            ctx.shadowColor = 'gold';
            ctx.shadowBlur = 20;
        }

        // Draw player name
        ctx.fillStyle = 'white';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(this.id === myId ? 'You' : `Player ${this.id.substr(0, 6)}`, this.pos.x, this.pos.y - 80);

        // Draw health bar
        const barWidth = 40;
        const barHeight = 4;
        const healthPercent = this.health / this.maxHealth;
        
        ctx.fillStyle = 'red';
        ctx.fillRect(this.pos.x - barWidth/2, this.pos.y - 70, barWidth, barHeight);
        ctx.fillStyle = 'green';
        ctx.fillRect(this.pos.x - barWidth/2, this.pos.y - 70, barWidth * healthPercent, barHeight);

        // Body size adjustment for Mega Chicken
        const size = this.isMegaChicken ? 60 : 40;
        const height = this.isMegaChicken ? 75 : 50;
        
        // Body
        ctx.fillStyle = this.id === myId ? 'green' : 'darkgreen';
        if (this.isMegaChicken) ctx.fillStyle = 'gold';
        ctx.fillRect(this.pos.x - size/2, this.pos.y - height, size, height);
        
        // Beak
        ctx.fillStyle = 'yellow';
        ctx.beginPath();
        ctx.moveTo(this.pos.x + size/2, this.pos.y - height*0.8);
        ctx.lineTo(this.pos.x + size/2 + 10, this.pos.y - height*0.7);
        ctx.lineTo(this.pos.x + size/2, this.pos.y - height*0.6);
        ctx.fill();
        
        // Muscles (arms)
        ctx.strokeStyle = 'red';
        ctx.lineWidth = this.isMegaChicken ? 8 : 5;
        ctx.beginPath();
        ctx.moveTo(this.pos.x - size/2, this.pos.y - height*0.6);
        ctx.lineTo(this.pos.x - size/2 - 15, this.pos.y - height*0.4);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(this.pos.x + size/2, this.pos.y - height*0.6);
        ctx.lineTo(this.pos.x + size/2 + 15, this.pos.y - height*0.4);
        ctx.stroke();

        // Attack animation
        if (this.attacking) {
            ctx.fillStyle = 'yellow';
            ctx.font = '16px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(this.attackType.toUpperCase() + '!', this.pos.x, this.pos.y - height - 10);
        }

        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;
        ctx.textAlign = 'left';
    }
}

class Enemy {
    constructor(x, y, color, name) {
        this.pos = new Vector(x, y);
        this.speed = Math.random() > 0.5 ? 2 : -2;
        this.color = color;
        this.name = name;
    }

    update() {
        this.pos.x += this.speed;
        if (this.pos.x > WIDTH - 10 || this.pos.x < 10) {
            this.speed *= -1;
        }
    }

    draw() {
        ctx.fillStyle = this.color;
        ctx.fillRect(this.pos.x - 10, this.pos.y - 10, 20, 20);
        
        // Enemy name
        ctx.fillStyle = 'white';
        ctx.font = '10px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(this.name, this.pos.x, this.pos.y - 15);
        ctx.textAlign = 'left';
    }
}

class Platform {
    constructor(x, y, w, h, type = 'normal') {
        this.x = x;
        this.y = y;
        this.w = w;
        this.h = h;
        this.type = type;
        this.direction = 1;
        this.speed = 2;
        this.alpha = 255;
        this.fading = false;
    }

    update() {
        if (this.type === 'moving') {
            this.x += this.speed * this.direction;
            if (this.x + this.w > WIDTH || this.x < 0) {
                this.direction *= -1;
            }
        } else if (this.type === 'fading' && this.fading) {
            this.alpha -= 5;
            if (this.alpha <= 0) {
                // Remove platform
                const index = platforms.indexOf(this);
                if (index > -1) platforms.splice(index, 1);
            }
        }
    }

    draw() {
        if (this.type === 'fading') {
            ctx.globalAlpha = this.alpha / 255;
        }
        
        ctx.fillStyle = this.type === 'moving' ? 'orange' : 
                       this.type === 'fading' ? 'purple' : 'red';
        ctx.fillRect(this.x, this.y, this.w, this.h);
        
        ctx.globalAlpha = 1;
    }
}

// Zeldina draw function
function drawZeldina(x, y, rescued) {
    if (rescued) {
        ctx.globalAlpha = 0.5;
    }
    
    // Body
    ctx.fillStyle = '#8B4513';
    ctx.fillRect(x - 10, y - 20, 20, 40);
    
    // Hair
    ctx.fillStyle = 'yellow';
    ctx.fillRect(x - 10, y - 30, 20, 10);
    
    // Eyes
    ctx.fillStyle = 'red';
    ctx.beginPath();
    ctx.arc(x - 5, y - 10, 2, 0, Math.PI * 2);
    ctx.arc(x + 5, y - 10, 2, 0, Math.PI * 2);
    ctx.fill();
    
    // Crown
    ctx.fillStyle = 'yellow';
    ctx.fillRect(x - 15, y - 40, 30, 10);
    ctx.fillStyle = 'red';
    ctx.beginPath();
    ctx.arc(x, y - 35, 3, 0, Math.PI * 2);
    ctx.fill();
    
    // Wings
    ctx.strokeStyle = 'blue';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x - 10, y);
    ctx.lineTo(x - 30, y - 10);
    ctx.moveTo(x - 10, y);
    ctx.lineTo(x - 30, y + 10);
    ctx.moveTo(x + 10, y);
    ctx.lineTo(x + 30, y - 10);
    ctx.moveTo(x + 10, y);
    ctx.lineTo(x + 30, y + 10);
    ctx.stroke();
    
    ctx.globalAlpha = 1;
}

// Boss draw function
function drawBoss(x, y, health) {
    // Body
    ctx.fillStyle = 'darkred';
    ctx.fillRect(x - 50, y - 50, 100, 100);
    
    // Health bar
    ctx.fillStyle = 'red';
    ctx.fillRect(x - 50, y - 70, 100, 10);
    ctx.fillStyle = 'green';
    ctx.fillRect(x - 50, y - 70, (health / 5) * 100, 10);
    
    // Eyes
    ctx.fillStyle = 'yellow';
    ctx.beginPath();
    ctx.arc(x - 20, y - 20, 10, 0, Math.PI * 2);
    ctx.arc(x + 20, y - 20, 10, 0, Math.PI * 2);
    ctx.fill();
    
    // Label
    ctx.fillStyle = 'white';
    ctx.font = '16px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('BOSS', x, y + 70);
    ctx.textAlign = 'left';
}

// Input handling
let keys = { left: false, right: false, space: false, down: false, shift: false };
let attackKeys = { q: false, e: false, r: false, f: false, g: false, t: false, m: false };

document.addEventListener('keydown', e => {
    e.preventDefault();
    if (e.key === 'ArrowLeft') keys.left = true;
    if (e.key === 'ArrowRight') keys.right = true;
    if (e.key === ' ') keys.space = true;
    if (e.key === 'ArrowDown') keys.down = true;
    if (e.key === 'Shift') keys.shift = true;
    
    // Attack keys
    if (e.key.toLowerCase() === 'q' && !attackKeys.q) {
        attackKeys.q = true;
        if (players[myId]) players[myId].attack('peck');
    }
    if (e.key.toLowerCase() === 'e' && !attackKeys.e) {
        attackKeys.e = true;
        if (players[myId]) players[myId].attack('kick');
    }
    if (e.key.toLowerCase() === 'r' && !attackKeys.r) {
        attackKeys.r = true;
        if (players[myId]) players[myId].attack('punch');
    }
    if (e.key.toLowerCase() === 'f' && !attackKeys.f) {
        attackKeys.f = true;
        if (players[myId]) players[myId].attack('egg');
    }
    if (e.key.toLowerCase() === 'g' && !attackKeys.g) {
        attackKeys.g = true;
        if (players[myId]) players[myId].attack('ko');
    }
    if (e.key.toLowerCase() === 't' && !attackKeys.t) {
        attackKeys.t = true;
        if (players[myId]) players[myId].attack('throw');
    }
    if (e.key.toLowerCase() === 'm' && !attackKeys.m) {
        attackKeys.m = true;
        tryMegaTransform();
    }
});

document.addEventListener('keyup', e => {
    e.preventDefault();
    if (e.key === 'ArrowLeft') keys.left = false;
    if (e.key === 'ArrowRight') keys.right = false;
    if (e.key === ' ') keys.space = false;
    if (e.key === 'ArrowDown') keys.down = false;
    if (e.key === 'Shift') keys.shift = false;
    
    // Attack keys
    if (e.key.toLowerCase() === 'q') attackKeys.q = false;
    if (e.key.toLowerCase() === 'e') attackKeys.e = false;
    if (e.key.toLowerCase() === 'r') attackKeys.r = false;
    if (e.key.toLowerCase() === 'f') attackKeys.f = false;
    if (e.key.toLowerCase() === 'g') attackKeys.g = false;
    if (e.key.toLowerCase() === 't') attackKeys.t = false;
    if (e.key.toLowerCase() === 'm') attackKeys.m = false;
});

// WebSocket functions
function connectWebSocket() {
    statusEl.textContent = 'Connecting to server...';
    
    socket = new WebSocket(wsUrl);
    
    socket.onopen = () => {
        console.log('Connected to WebSocket server');
        statusEl.textContent = 'Connected';
        reconnectDelay = 1000;
        
        // Send join message
        socket.send(JSON.stringify({
            action: 'join',
            data: {}
        }));
    };
    
    socket.onmessage = (event) => {
        const message = JSON.parse(event.data);
        handleMessage(message);
    };
    
    socket.onclose = () => {
        console.log('Disconnected from server');
        statusEl.textContent = 'Disconnected - Reconnecting...';
        socket = null;
        myId = null;
        
        // Exponential backoff reconnection
        reconnectTimer = setTimeout(() => {
            reconnectDelay = Math.min(reconnectDelay * 2, 30000);
            connectWebSocket();
        }, reconnectDelay);
    };
    
    socket.onerror = (error) => {
        console.error('WebSocket error:', error);
        statusEl.textContent = 'Connection error';
    };
}

// Handle incoming messages
function handleMessage(message) {
    switch (message.type) {
        case 'joined':
            myId = message.playerId;
            players[myId] = new Player(myId);
            console.log('Joined game with ID:', myId);
            break;
            
        case 'gameState':
            console.log('Game state received:', {
                platforms: message.data.platforms.length,
                enemies: message.data.enemies.length,
                players: Object.keys(message.data.players).length
            });
            updateGameState(message.data);
            console.log('After update - platforms:', platforms.length, 'enemies:', enemies.length);
            break;
            
        case 'playerUpdate':
            updatePlayer(message.data);
            break;
            
        case 'playerLeft':
            delete players[message.playerId];
            break;
            
        case 'enemyKilled':
            // Remove enemy
            enemies = enemies.filter(e =>
                !(e.pos.x === message.data.x && e.pos.y === message.data.y)
            );
            break;

        case 'enemyCrushed':
            console.log('Enemy crushed:', message.enemy);
            break;

        case 'playerDamaged':
            if (message.health !== undefined && players[myId]) {
                players[myId].health = message.health;
                players[myId].invulnerable = 120; // Match server invulnerability
            }
            break;

        case 'zeldinaRescued':
            if (zeldina) zeldina.rescued = true;
            break;
            
        case 'bossSpawned':
            boss = message.data;
            break;
            
        case 'bossUpdate':
            if (boss) {
                boss.health = message.data.health;
                if (boss.health <= 0) boss = null;
            }
            break;
            
        case 'levelComplete':
            currentLevel = message.data.level;
            loadLevel(message.data);
            break;
            
        case 'gameWin':
            alert('Congratulations! You won the game!');
            break;
            
        case 'playerDied':
            if (message.playerId === myId) {
                lives--;
                players[myId].invulnerable = 120; // 2 seconds at 60 FPS
                if (lives <= 0) {
                    alert('Game Over!');
                    location.reload();
                }
            }
            break;
    }
}

// Update game state from server
function updateGameState(state) {
    // Update other players
    for (let id in state.players) {
        if (id !== myId) {
            if (!players[id]) {
                players[id] = new Player(id);
            }
            players[id].pos = new Vector(state.players[id].pos.x, state.players[id].pos.y);
            players[id].vel = new Vector(state.players[id].vel.x, state.players[id].vel.y);
        }
    }
    
    // Remove disconnected players
    for (let id in players) {
        if (id !== myId && !state.players[id]) {
            delete players[id];
        }
    }
    
    // Update enemies
    enemies = state.enemies.map(e => {
        const enemy = new Enemy(e.pos.x, e.pos.y, e.color, e.name);
        enemy.speed = e.speed;
        return enemy;
    });
    
    // Update platforms
    platforms = state.platforms.map(p => {
        return new Platform(p.x, p.y, p.w, p.h, p.type);
    });
    
    // Update zeldina
    zeldina = state.zeldina;
    
    // Update boss
    boss = state.boss;
}

// Update individual player
function updatePlayer(data) {
    if (data.id !== myId && players[data.id]) {
        players[data.id].pos = new Vector(data.pos.x, data.pos.y);
        players[data.id].vel = new Vector(data.vel.x, data.vel.y);
        players[data.id].jumping = data.jumping;
    }
}

// Load level
function loadLevel(levelData) {
    platforms = levelData.platforms.map(p => 
        new Platform(p.x, p.y, p.w, p.h, p.type)
    );
    enemies = levelData.enemies.map(e => 
        new Enemy(e.pos.x, e.pos.y, e.color, e.name)
    );
    zeldina = levelData.zeldina;
    boss = null;
    
    // Reset player position
    if (players[myId]) {
        players[myId].pos = new Vector(50, 400);
        players[myId].vel = new Vector(0, 0);
    }
}

// Send player state to server
function sendPlayerState() {
    if (socket && socket.readyState === WebSocket.OPEN && players[myId]) {
        socket.send(JSON.stringify({
            action: 'move',
            data: {
                pos: players[myId].pos,
                vel: players[myId].vel,
                jumping: players[myId].jumping
            }
        }));
    }
}

// Send jump action
function sendJump() {
    if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({
            action: 'jump',
            data: {}
        }));
    }
}

// Send smash action
function sendSmash() {
    if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({
            action: 'smash',
            data: {}
        }));
    }
}

// New functions for attack system
function sendAttack(type) {
    if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({
            action: 'attack',
            data: {
                type: type,
                pos: players[myId].pos,
                direction: keys.left ? -1 : 1
            }
        }));
    }
}

function tryMegaTransform() {
    const password = prompt("Enter password for Mega Chicken transformation:");
    if (password === "CLUCK-POWER" && playerStats.hasGoldenEgg) {
        if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({
                action: 'megaTransform',
                data: {}
            }));
        }
    } else {
        console.log("Invalid password or missing Golden Egg!");
    }
}

// Game loop
let lastTime = 0;
let frameCount = 0;
function gameLoop(timestamp) {
    const deltaTime = timestamp - lastTime;
    lastTime = timestamp;
    frameCount++;
    
    // Clear canvas
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    
    // Draw frame counter to verify rendering
    ctx.fillStyle = 'yellow';
    ctx.font = '10px Arial';
    ctx.fillText(`Frame: ${frameCount}`, WIDTH - 80, 15);
    // Debug: Draw number of platforms
    ctx.fillStyle = 'white';
    ctx.fillText(`Platforms: ${platforms.length}`, 10, 30);
    
    // Draw platforms with debug
    platforms.forEach((plat, index) => {
        plat.update();
        plat.draw();
        // Debug text on each platform
        ctx.fillStyle = 'white';
        ctx.font = '8px Arial';
        ctx.fillText(`P${index}`, plat.x + 5, plat.y + 15);
    });
    
    // Update and draw enemies
    enemies.forEach(en => {
        en.update();
        en.draw();
    });
    
    // Draw Zeldina
    if (zeldina) {
        drawZeldina(zeldina.x, zeldina.y, zeldina.rescued);
    }
    
    // Draw Boss
    if (boss) {
        drawBoss(boss.x, boss.y, boss.health);
    }
    
    // Update my player
    if (players[myId]) {
        const player = players[myId];
        
        // Handle input
        if (keys.space && !player.jumping) {
            player.jump();
            sendJump();
        }
        if (keys.down) {
            sendSmash();
        }
        
        // Update physics
        player.move(keys);
        player.update();
        
        // Send state to server
        sendPlayerState();
    }
    
    // Draw all players
    for (let id in players) {
        players[id].draw();
    }
    
    // Draw UI
    ctx.fillStyle = 'white';
    ctx.font = '20px Arial';
    ctx.fillText(`Lives: ${lives}`, 10, 30);
    ctx.fillText(`Level: ${currentLevel + 1}`, 10, 60);
    
    // Draw player count
    const playerCount = Object.keys(players).length;
    ctx.fillText(`Players: ${playerCount}`, WIDTH - 120, 30);
    
    requestAnimationFrame(gameLoop);
}

// Initialize game when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing game...');
    
    // Get DOM elements
    canvas = document.getElementById('gameCanvas');
    ctx = canvas.getContext('2d');
    statusEl = document.getElementById('status');
    
    if (!canvas || !ctx) {
        console.error('Failed to get canvas or context!');
        return;
    }
    
    console.log('Canvas initialized:', canvas.width, 'x', canvas.height);
    
    // Start the game
    connectWebSocket();
    requestAnimationFrame(gameLoop);
});

// Handle page visibility
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        // Pause updates when tab is hidden
    } else {
        // Resume updates when tab is visible
    }
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (socket) {
        socket.close();
    }
    if (reconnectTimer) {
        clearTimeout(reconnectTimer);
    }
});