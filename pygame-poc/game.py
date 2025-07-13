import pygame
from pygame.locals import *
import sys
import random

pygame.init()
vec = pygame.math.Vector2

HEIGHT = 450
WIDTH = 800
ACC = 0.5
FRIC = -0.12
GRAVITY = 0.8
FPS = 60

FramePerSec = pygame.time.Clock()
displaysurface = pygame.display.set_mode((WIDTH, HEIGHT))
pygame.display.set_caption("Chicken Hen Adventure")

# Colors
BLACK = (0, 0, 0)
WHITE = (255, 255, 255)
RED = (255, 0, 0)
GREEN = (0, 255, 0)
BLUE = (0, 0, 255)
YELLOW = (255, 255, 0)

class Player(pygame.sprite.Sprite):
    def __init__(self):
        super().__init__()
        self.surf = pygame.Surface((40, 50))
        self.surf.fill(GREEN)  # Green for chicken body
        self.rect = self.surf.get_rect()
        self.pos = vec((50, 400))
        self.vel = vec(0, 0)
        self.acc = vec(0, 0)
        self.jumping = False
        self.smashing = False
        self.invulnerable = 0

    def move(self):
        self.acc = vec(0, GRAVITY)

        pressed_keys = pygame.key.get_pressed()
        if pressed_keys[K_LEFT]:
            self.acc.x = -ACC
        if pressed_keys[K_RIGHT]:
            self.acc.x = ACC

        self.acc.x += self.vel.x * FRIC
        self.vel += self.acc
        self.pos += self.vel + 0.5 * self.acc

        if self.pos.x > WIDTH:
            self.pos.x = WIDTH
        if self.pos.x < 0:
            self.pos.x = 0

        self.rect.midbottom = self.pos

    def jump(self):
        self.vel.y = -15
        self.jumping = True

    def update(self, platforms):
        hits = pygame.sprite.spritecollide(self, platforms, False)
        if hits and self.vel.y > 0:
            lowest = hits[0]
            for hit in hits:
                if hit.rect.top < lowest.rect.top:
                    lowest = hit
            self.pos.y = lowest.rect.top + 1
            self.vel.y = 0
            self.jumping = False

    def smash(self):
        self.smashing = True
        # Smash logic in loop

    def draw(self):
        # Simple chicken draw
        displaysurface.blit(self.surf, self.rect)
        # Beak
        pygame.draw.polygon(displaysurface, YELLOW, [(self.rect.right, self.rect.top+10), (self.rect.right+10, self.rect.top+15), (self.rect.right, self.rect.top+20)])
        # Muscles (arms)
        pygame.draw.line(displaysurface, RED, (self.rect.left, self.rect.top+20), (self.rect.left-10, self.rect.top+30), 5)
        pygame.draw.line(displaysurface, RED, (self.rect.right, self.rect.top+20), (self.rect.right+10, self.rect.top+30), 5)

class Platform(pygame.sprite.Sprite):
    def __init__(self, x, y, w, h):
        super().__init__()
        self.surf = pygame.Surface((w, h))
        self.surf.fill(RED)
        self.rect = self.surf.get_rect(topleft=(x, y))

class MovingPlatform(Platform):
    def __init__(self, x, y, w, h):
        super().__init__(x, y, w, h)
        self.speed = 2
        self.direction = 1

    def update(self):
        self.rect.x += self.speed * self.direction
        if self.rect.right > WIDTH or self.rect.left < 0:
            self.direction *= -1

class FadingPlatform(Platform):
    def __init__(self, x, y, w, h):
        super().__init__(x, y, w, h)
        self.alpha = 255
        self.fading = False

    def update(self):
        if self.fading:
            self.alpha -= 5
            if self.alpha <= 0:
                self.kill()
            self.surf.set_alpha(self.alpha)

class Enemy(pygame.sprite.Sprite):
    def __init__(self, x, y, color, name):
        super().__init__()
        self.surf = pygame.Surface((20, 20))
        self.surf.fill(color)
        self.rect = self.surf.get_rect(center=(x, y))
        self.speed = random.choice([-1, 1]) * 2
        self.name = name

    def update(self):
        self.rect.x += self.speed
        if self.rect.right > WIDTH or self.rect.left < 0:
            self.speed *= -1

class Zeldina(pygame.sprite.Sprite):
    def __init__(self, x, y):
        super().__init__()
        self.surf = pygame.Surface((20, 40))
        self.surf.fill((139, 69, 19))  # Tan-ish brown
        self.rect = self.surf.get_rect(center=(x, y))
        self.rescued = False

    def draw(self):
        displaysurface.blit(self.surf, self.rect)
        # Hair: yellow
        pygame.draw.rect(displaysurface, YELLOW, (self.rect.left, self.rect.top-10, 20, 10))
        # Eyes: red
        pygame.draw.circle(displaysurface, RED, (self.rect.left+5, self.rect.top+10), 2)
        pygame.draw.circle(displaysurface, RED, (self.rect.left+15, self.rect.top+10), 2)
        # Crown: gold with gem
        pygame.draw.rect(displaysurface, YELLOW, (self.rect.left-5, self.rect.top-20, 30, 10))
        pygame.draw.circle(displaysurface, RED, (self.rect.centerx, self.rect.top-15), 3)
        # Wings: translucent blue
        pygame.draw.line(displaysurface, BLUE, (self.rect.left, self.rect.centery), (self.rect.left-20, self.rect.centery-10), 3)
        pygame.draw.line(displaysurface, BLUE, (self.rect.left, self.rect.centery), (self.rect.left-20, self.rect.centery+10), 3)
        pygame.draw.line(displaysurface, BLUE, (self.rect.right, self.rect.centery), (self.rect.right+20, self.rect.centery-10), 3)
        pygame.draw.line(displaysurface, BLUE, (self.rect.right, self.rect.centery), (self.rect.right+20, self.rect.centery+10), 3)

class Boss(pygame.sprite.Sprite):
    def __init__(self, x, y):
        super().__init__()
        self.surf = pygame.Surface((100, 100))
        self.surf.fill(RED)
        self.rect = self.surf.get_rect(center=(x, y))
        self.health = 5
        self.minions = []

    def update(self):
        # Boss logic
        if random.random() < 0.05:
            minion = Enemy(self.rect.centerx, self.rect.bottom + 20, BLUE, "Minion")
            self.minions.append(minion)
            all_sprites.add(minion)
            enemies.add(minion)

# Levels
levels = [
    # Greenfield
    {
        "platforms": [Platform(0, HEIGHT - 20, WIDTH, 20), MovingPlatform(200, 300, 100, 20), FadingPlatform(400, 200, 100, 20)],
        "enemies": [Enemy(600, 400, GREEN, "Gumpa"), Enemy(700, 400, BLUE, "Stende")],
        "zeldina": Zeldina(700, HEIGHT - 60)
    },
    # Enchanted Desert
    {
        "platforms": [Platform(0, HEIGHT - 20, WIDTH, 20), Platform(100, 350, 100, 20), Platform(300, 250, 100, 20)],
        "enemies": [Enemy(500, 300, YELLOW, "Turtle"), Enemy(600, 200, RED, "Fish")],
        "zeldina": Zeldina(700, HEIGHT - 60)
    },
    # Ranka
    {
        "platforms": [Platform(0, HEIGHT - 20, WIDTH, 20), MovingPlatform(150, 320, 80, 20), Platform(450, 220, 120, 20)],
        "enemies": [Enemy(400, 400, GREEN, "Dragon")],
        "zeldina": Zeldina(700, HEIGHT - 60)
    },
    # Ruins
    {
        "platforms": [Platform(0, HEIGHT - 20, WIDTH, 20), FadingPlatform(250, 280, 100, 20), Platform(500, 180, 100, 20)],
        "enemies": [Enemy(300, 400, RED, "Dungeon Creature"), Enemy(550, 180, BLUE, "Gumpa")],
        "zeldina": Zeldina(700, HEIGHT - 60)
    }
]

current_level = 0
lives = 3

def load_level(level):
    global platforms, enemies, all_sprites, zeldina, boss
    platforms = pygame.sprite.Group()
    enemies = pygame.sprite.Group()
    all_sprites = pygame.sprite.Group()

    for plat in levels[level]["platforms"]:
        platforms.add(plat)
        all_sprites.add(plat)

    for en in levels[level]["enemies"]:
        enemies.add(en)
        all_sprites.add(en)

    zeldina = levels[level]["zeldina"]
    all_sprites.add(zeldina)
    
    # Re-add player to all_sprites
    all_sprites.add(P1)

    boss = None

# Initialize sprite groups first
all_sprites = pygame.sprite.Group()
platforms = pygame.sprite.Group()
enemies = pygame.sprite.Group()
zeldina = None
boss = None

# Create player after groups are initialized
P1 = Player()
all_sprites.add(P1)

load_level(current_level)

font = pygame.font.SysFont("comicsans", 30)

while True:
    for event in pygame.event.get():
        if event.type == QUIT:
            pygame.quit()
            sys.exit()
        if event.type == KEYDOWN:
            if event.key == K_SPACE and not P1.jumping:
                P1.jump()
            if event.key == K_DOWN:
                P1.smash()

    displaysurface.fill(BLACK)

    P1.move()
    P1.update(platforms)

    for plat in platforms:
        if isinstance(plat, MovingPlatform) or isinstance(plat, FadingPlatform):
            plat.update()

    for en in enemies:
        en.update()

    if boss:
        boss.update()

    # Update invulnerability
    if P1.invulnerable > 0:
        P1.invulnerable -= 1
    
    # Collisions with enemies
    if P1.invulnerable == 0:
        enemy_hits = pygame.sprite.spritecollide(P1, enemies, False)
        for en in enemy_hits:
            if P1.vel.y > 0 and P1.rect.bottom < en.rect.centery:  # Smashed from above
                en.kill()
                P1.vel.y = -10
            else:
                lives -= 1
                P1.invulnerable = 60  # 1 second of invulnerability at 60 FPS
                if lives <= 0:
                    print("Game Over")
                    pygame.quit()
                    sys.exit()
                else:
                    load_level(current_level)  # Reset level, Zeldina captured again
                    P1.pos = vec((50, 400))
                    P1.vel = vec(0, 0)

    # Talk to Zeldina
    if zeldina and pygame.sprite.collide_rect(P1, zeldina) and not zeldina.rescued:
        zeldina.rescued = True
        # Spawn boss
        boss = Boss(WIDTH / 2, 100)
        all_sprites.add(boss)
        enemies.add(boss)  # Treat boss as enemy for collision

    # Boss fight
    if boss:
        # Attack boss
        if pygame.sprite.collide_rect(P1, boss) and P1.vel.y > 0:
            boss.health -= 1
            P1.vel.y = -10
            if boss.health <= 0:
                boss.kill()
                current_level += 1
                if current_level >= len(levels):
                    print("You Win!")
                    pygame.quit()
                    sys.exit()
                load_level(current_level)
                P1.pos = vec((50, 400))

    # Draw all
    for entity in all_sprites:
        if isinstance(entity, Zeldina):
            entity.draw()
        elif isinstance(entity, Player):
            entity.draw()
        else:
            displaysurface.blit(entity.surf, entity.rect)

    # Draw lives
    lives_text = font.render(f"Lives: {lives}", 1, WHITE)
    displaysurface.blit(lives_text, (10, 10))

    pygame.display.update()
    FramePerSec.tick(FPS)
