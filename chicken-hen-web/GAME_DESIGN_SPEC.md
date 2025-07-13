# Chicken Hen Game Design Specification

## Overview
This document outlines the implementation details for the new features and mechanics to be added to the Chicken Hen multiplayer web game.

## 1. Mega Chicken Hen Transformation

### Activation Requirements
- **Password**: "CLUCK-POWER"
- **Key Item**: "Golden Egg" (collected from boss drops or special spaces)
- **Activation**: Press 'M' key when both requirements are met

### Mega Chicken Hen Stats
- **Size**: 2x normal chicken size
- **Health**: 200 HP (vs normal 100 HP)
- **Damage Multiplier**: 2x for all attacks
- **Duration**: 30 seconds or until health depletes
- **Visual**: Glowing golden aura, larger sprite, muscle definition

## 2. Main Menu Game Board

### Board Layout
The main menu transforms into a board game with the following space types arranged in a circular path (20 spaces total):

1. **Start Space** - Where all players begin
2. **Routes** (3 spaces) - Choose between 2 paths for next 3 turns
3. **Chance** (3 spaces) - Random event (gain/lose coins, teleport, etc.)
4. **Bad** (2 spaces) - Negative effect (lose health, skip turn, etc.)
5. **Good** (2 spaces) - Positive effect (heal, bonus coins, etc.)
6. **Dash** (2 spaces) - Move forward 1-3 extra spaces
7. **Back** (2 spaces) - Move backward 1-3 spaces
8. **Enemy** (2 spaces) - Fight a random enemy
9. **Boss** (1 space) - Fight a mini-boss
10. **Luck** (1 space) - Roll dice twice on next turn
11. **Skill** (1 space) - Temporary skill boost for minigames
12. **Talent** (1 space) - Unlock a special ability for current session
13. **Mini Boss** (1 space) - Fight a stronger enemy with rewards
14. **Dungeon Space** (1 space) - "Try to save Zeldina from a powerful boss monster"

### Board Navigation
- **Movement**: Roll dice (1-6) by pressing SPACE
- **Space Selection**: Automatic based on dice roll
- **Turn Order**: Players take turns in join order
- **Win Condition**: First to complete 3 laps or defeat the dungeon boss

### Dungeon Space Details
When landing on the dungeon space:
- Teleports player to a special boss arena
- Boss: "Shadow Rooster" with 500 HP
- Must defeat boss to rescue Zeldina
- Success: Gain "Hero" status and bonus rewards
- Failure: Return to board with half health

## 3. Fixed Damage System & PVP

### Health System
- **Base Health**: 100 HP per player
- **Lives**: 3 lives (lose a life when HP reaches 0)
- **Regeneration**: 5 HP per second when not in combat for 5 seconds

### PVP Mechanics
- **Friendly Fire**: Always enabled
- **Damage Reduction**: 50% damage reduction between players (to prevent griefing)
- **Respawn**: 3-second invulnerability after respawn
- **Score System**: +10 points for player elimination, -5 for being eliminated

## 4. Attack System

### Attack Types and Controls

| Attack | Key | Damage | Range | Cooldown | Description |
|--------|-----|--------|-------|----------|-------------|
| **Peck** | Q | 15 HP | Melee | 0.5s | Quick forward peck |
| **Kick** | E | 25 HP | Melee | 1s | Powerful backward kick |
| **Punch** | R | 20 HP | Melee | 0.8s | Side punch with knockback |
| **Egg Throw** | F | 30 HP | Ranged | 2s | Throws explosive egg projectile |
| **KO Move** | G | 50 HP | Melee | 5s | Spinning tornado attack (AoE) |
| **Throw Enemy** | T | 40 HP | Grab | 3s | Grab and throw enemy/player |

### Attack Mechanics
- **Combo System**: Chain 3 different attacks for 1.5x damage
- **Critical Hits**: 10% chance for 2x damage
- **Blocking**: Hold SHIFT to reduce damage by 50% (drains stamina)
- **Stamina**: 100 stamina, attacks cost 10-20, regenerates 10/second

### Throw Mechanic Details
1. Press T near enemy/player (within 50 pixels)
2. If successful, enemy is grabbed for 1 second
3. Use arrow keys to aim throw direction
4. Press T again to throw (or auto-throws after 1 second)
5. Thrown entity takes damage and can damage others on impact

## 5. Minigame: Egg Collector

### Activation
- Triggered randomly on "Skill" spaces
- Can be initiated by pressing 'N' in lobby

### Gameplay
- **Duration**: 60 seconds
- **Objective**: Collect falling eggs while avoiding rotten eggs
- **Controls**: Left/Right arrows to move basket
- **Scoring**: 
  - Golden Egg: 10 points
  - Regular Egg: 5 points
  - Rotten Egg: -10 points
- **Rewards**: Top scorer gets 50 coins and temporary speed boost

## 6. Chicken Hen Medley Mode

### Description
A special game mode that combines all mechanics into a fast-paced battle royale.

### Features
- **Arena**: Shrinking circular arena (starts at 1000x1000, shrinks over 5 minutes)
- **Power-ups**: Spawn every 30 seconds
  - Attack Boost (2x damage for 15 seconds)
  - Speed Boost (1.5x movement for 20 seconds)
  - Shield (Absorbs 100 damage)
  - Mega Transform (Instant Mega Chicken for 10 seconds)
- **Win Condition**: Last chicken standing
- **Respawns**: Disabled (elimination mode)

### Special Mechanics
- All attacks available from start
- Double stamina regeneration
- Environmental hazards (fire pits, spikes) spawn over time
- Boss enemies spawn at 2-minute intervals

## 7. Error Fixes Required

### Current Issues to Address
1. **Collision Detection**: Improve player-to-player collision to prevent overlapping
2. **Network Lag**: Implement client-side prediction for smoother movement
3. **Platform Sync**: Fix moving platforms not syncing properly between clients
4. **Enemy Spawning**: Prevent enemies from spawning inside platforms
5. **Score Persistence**: Save player scores and stats between sessions

### Implementation Priority
1. Fix collision detection (Critical)
2. Implement new attack system (High)
3. Add main menu board game (High)
4. Create Mega Chicken transformation (Medium)
5. Add minigame (Medium)
6. Implement Medley mode (Low)

## 8. Visual and Audio Enhancements

### Visual Updates
- Attack animations (sprite sheets for each attack)
- Damage numbers floating above hit targets
- Health bars above all players
- Board game UI overlay for main menu
- Particle effects for special attacks

### Audio Requirements
- Attack sound effects (peck, kick, punch, etc.)
- Background music for each game mode
- Victory/defeat jingles
- Dice roll and board movement sounds
- Mega transformation activation sound

## 9. Technical Implementation Notes

### Client-Side (game.js)
- Add new input handlers for attacks (Q, E, R, F, G, T)
- Implement board game logic and UI
- Add health bar rendering
- Create attack animation system
- Implement client-side prediction

### Server-Side (websocket-handler.js)
- Add new message types for attacks
- Implement damage calculation with PVP modifiers
- Add board game state management
- Create minigame logic
- Implement Medley mode arena shrinking

### Database Requirements
- Player stats table (wins, losses, coins, unlocks)
- Leaderboard table
- Session state for board game progress

## 10. Testing Requirements

### Smoke Tests
1. All attacks deal correct damage
2. PVP damage reduction works
3. Board game spaces trigger correct events
4. Mega transformation activates/deactivates properly
5. Minigame starts and completes correctly
6. Medley mode arena shrinks on schedule
7. No memory leaks during extended play
8. Proper cleanup on player disconnect 