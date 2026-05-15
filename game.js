const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const W = 640, H = 360;

// ── pixel art drawers ──────────────────────────────────────────────────────
function px(data, x, y, scale = 3) {
  data.forEach((row, r) => {
    [...row].forEach((ch, c) => {
      const color = PALETTE[ch];
      if (!color) return;
      ctx.fillStyle = color;
      ctx.fillRect(x + c * scale, y + r * scale, scale, scale);
    });
  });
}

const PALETTE = {
  B: '#4a2800', // dark brown
  b: '#7a4500', // brown
  S: '#f5c87a', // skin
  s: '#e0a855', // dark skin
  T: '#228b22', // tail green... wait, tail brown
  t: '#7a4500', // tail
  Y: '#ffe066', // yellow (banana)
  G: '#3a9a3a', // green
  g: '#2a7a2a', // dark green
  R: '#e03030', // red
  r: '#a02020', // dark red
  P: '#cc44cc', // purple (power up)
  p: '#8800aa',
  W: '#ffffff',
  K: '#222222',
  _: null,      // transparent
};

const MONKEY_NORMAL = [
  '_BBB____',
  'BSSBS___',
  'BSsSB___',
  '_BSSB___',
  '__BB____',
  '_bBBb___',
  'bBBBBb__',
  '__b_b___',
  '__b_b___',
  '___bbbbb',
];

const MONKEY_SUPER = [
  '_RRR____',
  'RSSRS___',
  'RSsRS___',
  '_RSSR___',
  '__RR____',
  '_RRRR___',
  'RRRRRR__',
  '__R_R___',
  '__R_R___',
  '___RRRRR',
];

const BANANA = [
  '__YY__',
  '_YYYs_',
  'YYYs__',
  '_YYs__',
  '__Y___',
];

const SNAKE = [
  '_GGG_',
  'GgGgG',
  '_GGG_',
  '__G__',
  '_GG__',
];

const SPIDER = [
  'KbKbK',
  '_bBb_',
  'KbBbK',
  '_b_b_',
];

const POWERUP = [
  '_PPP_',
  'PpppP',
  'PpWpP',
  'PpppP',
  '_PPP_',
];

const PLATFORM_TILE = ['GGGGGGGGgg', 'gggggggggg'];
const GROUND_TILE   = ['GGGGGGGGgg', 'gggggggggg', 'gggggggggg'];

// ── state ──────────────────────────────────────────────────────────────────
let bananas = 0, lives = 3, superMode = false, superTimer = 0;
let gameOver = false, win = false;

const GRAVITY = 0.5;
const GROUND_Y = H - 40;

const player = {
  x: 60, y: GROUND_Y - 30, w: 24, h: 30,
  vx: 0, vy: 0, onGround: false,
  facing: 1, // 1 right, -1 left
  frame: 0, frameTimer: 0,
};

const platforms = [
  { x: 100, y: 240, w: 120 },
  { x: 280, y: 190, w: 100 },
  { x: 420, y: 150, w: 120 },
  { x: 520, y: 240, w: 80  },
];

const bananaItems = [
  { x: 130, y: 220, w: 18, h: 15, collected: false },
  { x: 180, y: 220, w: 18, h: 15, collected: false },
  { x: 300, y: 170, w: 18, h: 15, collected: false },
  { x: 350, y: 170, w: 18, h: 15, collected: false },
  { x: 440, y: 130, w: 18, h: 15, collected: false },
  { x: 490, y: 130, w: 18, h: 15, collected: false },
  { x: 200, y: GROUND_Y - 15, w: 18, h: 15, collected: false },
  { x: 380, y: GROUND_Y - 15, w: 18, h: 15, collected: false },
];

const powerupItem = { x: 455, y: 125, w: 15, h: 15, collected: false };

const enemies = [
  { x: 110, y: 218, w: 15, h: 12, vx: 0.6, type: 'snake', alive: true },
  { x: 290, y: 168, w: 15, h: 12, vx: 0.5, type: 'spider', alive: true },
  { x: 430, y: 128, w: 15, h: 12, vx: 0.7, type: 'snake',  alive: true },
  { x: 150, y: GROUND_Y - 12, w: 15, h: 12, vx: 0.8, type: 'spider', alive: true },
  { x: 400, y: GROUND_Y - 12, w: 15, h: 12, vx: 0.6, type: 'snake',  alive: true },
];

const particles = [];
const messages  = [];

const keys = {};
document.addEventListener('keydown', e => keys[e.code] = true);
document.addEventListener('keyup',   e => keys[e.code] = false);

// ── helpers ────────────────────────────────────────────────────────────────
function overlaps(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x &&
         a.y < b.y + b.h && a.y + a.h > b.y;
}

function spawnParticles(x, y, color, n = 8) {
  for (let i = 0; i < n; i++) {
    const angle = (Math.PI * 2 * i) / n;
    particles.push({
      x, y,
      vx: Math.cos(angle) * (1 + Math.random() * 2),
      vy: Math.sin(angle) * (1 + Math.random() * 2),
      life: 30,
      color,
    });
  }
}

function showMessage(text, x, y) {
  messages.push({ text, x, y, life: 60 });
}

// ── update ─────────────────────────────────────────────────────────────────
function update() {
  if (gameOver || win) return;

  // input
  const speed = superMode ? 4 : 2.8;
  if (keys['ArrowLeft']  || keys['KeyA']) { player.vx = -speed; player.facing = -1; }
  else if (keys['ArrowRight'] || keys['KeyD']) { player.vx = speed; player.facing = 1; }
  else player.vx *= 0.7;

  if ((keys['ArrowUp'] || keys['KeyW'] || keys['Space']) && player.onGround) {
    player.vy = -10;
    player.onGround = false;
  }

  // gravity
  player.vy += GRAVITY;
  player.x += player.vx;
  player.y += player.vy;

  // clamp horizontal
  player.x = Math.max(0, Math.min(W - player.w, player.x));

  // ground collision
  player.onGround = false;
  if (player.y + player.h >= GROUND_Y) {
    player.y = GROUND_Y - player.h;
    player.vy = 0;
    player.onGround = true;
  }

  // platform collision
  for (const p of platforms) {
    const pw = p.w, ph = 10;
    if (
      player.x + player.w > p.x && player.x < p.x + pw &&
      player.y + player.h > p.y && player.y + player.h < p.y + ph + 10 &&
      player.vy >= 0
    ) {
      player.y = p.y - player.h;
      player.vy = 0;
      player.onGround = true;
    }
  }

  // fall off
  if (player.y > H + 50) {
    loseLife();
    return;
  }

  // bananas
  for (const b of bananaItems) {
    if (!b.collected && overlaps(player, b)) {
      b.collected = true;
      bananas++;
      spawnParticles(b.x + 9, b.y + 7, '#ffe066');
      showMessage('+1 🍌', b.x, b.y - 10);
    }
  }

  // power up
  if (!powerupItem.collected && overlaps(player, powerupItem)) {
    powerupItem.collected = true;
    superMode = true;
    superTimer = 600;
    spawnParticles(powerupItem.x, powerupItem.y, '#cc44cc', 16);
    showMessage('SUPER MONKEY!! 🐒💥', W / 2 - 80, 60);
  }

  if (superMode) {
    superTimer--;
    if (superTimer <= 0) { superMode = false; }
  }

  // enemies
  for (const e of enemies) {
    if (!e.alive) continue;

    // patrol on their platform / ground
    e.x += e.vx;
    const floor = getFloorY(e);
    if (e.x < 0 || e.x + e.w > W) e.vx *= -1;
    // bounce at platform edges
    if (e.x < (e.patrolLeft ?? e.x - 60) || e.x > (e.patrolRight ?? e.x + 60)) e.vx *= -1;

    if (overlaps(player, e)) {
      if (superMode) {
        // stomp / smash
        e.alive = false;
        spawnParticles(e.x, e.y, '#e03030');
        const taunts = ['Monkey smash! 💥', 'Get rekt, snake! 🐒', 'BANANA POWER!', 'Too slow, bug! 😂'];
        showMessage(taunts[Math.floor(Math.random() * taunts.length)], e.x - 30, e.y - 20);
      } else if (player.vy > 0 && player.y + player.h < e.y + e.h * 0.6) {
        // stomp from above
        e.alive = false;
        player.vy = -6;
        spawnParticles(e.x, e.y, '#3a9a3a');
        showMessage('Stomped! 👣', e.x - 20, e.y - 20);
      } else {
        loseLife();
        return;
      }
    }
  }

  // set patrol bounds lazily
  for (const e of enemies) {
    if (e.patrolLeft === undefined) {
      e.patrolLeft  = e.x - 60;
      e.patrolRight = e.x + 60;
    }
  }

  // win condition
  if (bananaItems.every(b => b.collected)) {
    win = true;
    showMessage('YOU WIN! 🍌🐒🎉', W / 2 - 80, H / 2 - 20);
  }

  // particles
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx; p.y += p.vy; p.vy += 0.1; p.life--;
    if (p.life <= 0) particles.splice(i, 1);
  }
  for (let i = messages.length - 1; i >= 0; i--) {
    messages[i].life--;
    if (messages[i].life <= 0) messages.splice(i, 1);
  }

  // animate
  player.frameTimer++;
  if (player.frameTimer > 8) { player.frame = 1 - player.frame; player.frameTimer = 0; }

  // update UI
  document.getElementById('bananas').textContent = bananas;
  document.getElementById('lives').textContent   = lives;
  document.getElementById('power').textContent   = superMode ? `⚡ SUPER ${Math.ceil(superTimer/60)}s` : '';
}

function getFloorY(e) { return GROUND_Y; }

function loseLife() {
  lives--;
  spawnParticles(player.x, player.y, '#e03030', 12);
  if (lives <= 0) {
    gameOver = true;
    showMessage('GAME OVER 😵 Press R to restart', W / 2 - 120, H / 2);
  } else {
    player.x = 60; player.y = GROUND_Y - 30;
    player.vx = 0; player.vy = 0;
    showMessage(`Ouch! ${lives} lives left 🐒`, 60, 80);
  }
  document.getElementById('lives').textContent = lives;
}

document.addEventListener('keydown', e => {
  if (e.code === 'KeyR' && (gameOver || win)) location.reload();
});

// ── draw ───────────────────────────────────────────────────────────────────
function drawBackground() {
  // sky gradient
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#1a4a00');
  sky.addColorStop(1, '#0a2500');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  // jungle silhouette trees
  ctx.fillStyle = '#0d3300';
  for (let i = 0; i < 12; i++) {
    const tx = i * 58 - 10;
    ctx.beginPath();
    ctx.moveTo(tx + 20, GROUND_Y);
    ctx.lineTo(tx, GROUND_Y - 80 - (i % 3) * 20);
    ctx.lineTo(tx + 40, GROUND_Y);
    ctx.fill();
  }
}

function drawGround() {
  ctx.fillStyle = '#2a7a2a';
  ctx.fillRect(0, GROUND_Y, W, H - GROUND_Y);
  ctx.fillStyle = '#1a5a1a';
  ctx.fillRect(0, GROUND_Y + 8, W, H - GROUND_Y - 8);
}

function drawPlatforms() {
  for (const p of platforms) {
    ctx.fillStyle = '#3a9a3a';
    ctx.fillRect(p.x, p.y, p.w, 10);
    ctx.fillStyle = '#2a7a2a';
    ctx.fillRect(p.x, p.y + 6, p.w, 4);
  }
}

function drawMonkey() {
  ctx.save();
  if (player.facing === -1) {
    ctx.translate(player.x + player.w, player.y);
    ctx.scale(-1, 1);
    px(superMode ? MONKEY_SUPER : MONKEY_NORMAL, 0, 0, 3);
  } else {
    px(superMode ? MONKEY_SUPER : MONKEY_NORMAL, player.x, player.y, 3);
  }
  ctx.restore();
}

function drawBananas() {
  for (const b of bananaItems) {
    if (b.collected) continue;
    px(BANANA, b.x, b.y, 3);
  }
}

function drawPowerup() {
  if (powerupItem.collected) return;
  // pulse
  const scale = 3 + Math.sin(Date.now() / 200) * 0.3;
  ctx.save();
  ctx.translate(powerupItem.x + 7, powerupItem.y + 7);
  ctx.scale(scale / 3, scale / 3);
  px(POWERUP, -7, -7, 3);
  ctx.restore();
}

function drawEnemies() {
  for (const e of enemies) {
    if (!e.alive) continue;
    const sprite = e.type === 'snake' ? SNAKE : SPIDER;
    px(sprite, e.x, e.y, 3);
  }
}

function drawParticles() {
  for (const p of particles) {
    ctx.globalAlpha = p.life / 30;
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x, p.y, 4, 4);
  }
  ctx.globalAlpha = 1;
}

function drawMessages() {
  for (const m of messages) {
    ctx.globalAlpha = Math.min(1, m.life / 20);
    ctx.fillStyle = '#ffe066';
    ctx.font = 'bold 13px monospace';
    ctx.fillText(m.text, m.x, m.y);
  }
  ctx.globalAlpha = 1;
}

function drawOverlay() {
  if (gameOver || win) {
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 0, W, H);
  }
}

// ── loop ───────────────────────────────────────────────────────────────────
function loop() {
  ctx.clearRect(0, 0, W, H);
  drawBackground();
  drawGround();
  drawPlatforms();
  drawBananas();
  drawPowerup();
  drawEnemies();
  drawMonkey();
  drawParticles();
  drawMessages();
  drawOverlay();
  update();
  requestAnimationFrame(loop);
}

loop();
