/* =========================================================
   Vansaba - 変更01 + 変更移動 + スマホSTART修正
   - レベルアップ / 経験値 / 複数武器 / 複数敵種
   - SVG敵 / Web Audio 合成 / スタート画面
   - 入力：PCマウス追従 + スマホバーチャルスティック
   - スマホのSTARTタップ対応（pointerdown/touchend + AudioContext同期init）
   ========================================================= */

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const levelupEl = document.getElementById('levelup');
const choicesEl = document.getElementById('choices');
const overlayEl = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayMsg = document.getElementById('overlay-msg');
const overlayHelp = document.getElementById('overlay-help');
const startBtn = document.getElementById('startBtn');

/* ---------- 画面サイズ ---------- */
let W = 0, H = 0;
function resize() {
  const dpr = window.devicePixelRatio || 1;
  W = window.innerWidth;
  H = window.innerHeight;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  canvas.style.width = W + 'px';
  canvas.style.height = H + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener('resize', resize);
resize();

/* =========================================================
   入力（変更移動：ハイブリッド）
   - マウス：カーソル位置へ追従
   - タッチ：バーチャルスティック（指を置いた点が基点）
   ========================================================= */

const move = { dx: 0, dy: 0, active: false };

const stick = {
  active: false,
  baseX: 0, baseY: 0,
  curX: 0, curY: 0,
  maxDist: 70,
  deadZone: 8,
};
let lastPointerType = 'mouse';

function overlayVisible() {
  return !overlayEl.classList.contains('hidden') ||
         !levelupEl.classList.contains('hidden');
}

/* ---------- マウス ---------- */
canvas.addEventListener('mousemove', e => {
  if (lastPointerType === 'touch') return;
  if (overlayVisible()) return;
  lastPointerType = 'mouse';
  const dx = e.clientX - player.x;
  const dy = e.clientY - player.y;
  const len = Math.hypot(dx, dy);
  if (len > 4) {
    move.dx = dx / len;
    move.dy = dy / len;
    move.active = true;
  } else {
    move.active = false;
  }
});
canvas.addEventListener('mouseleave', () => {
  if (lastPointerType === 'mouse') move.active = false;
});

/* ---------- タッチ ---------- */
canvas.addEventListener('touchstart', e => {
  if (overlayVisible()) return; // オーバーレイ表示中はcanvasタッチ無効
  e.preventDefault();
  lastPointerType = 'touch';
  const t = e.touches[0];
  stick.active = true;
  stick.baseX = t.clientX;
  stick.baseY = t.clientY;
  stick.curX = t.clientX;
  stick.curY = t.clientY;
  move.active = false;
}, { passive: false });

canvas.addEventListener('touchmove', e => {
  if (overlayVisible()) return;
  e.preventDefault();
  lastPointerType = 'touch';
  if (!stick.active) return;
  const t = e.touches[0];
  stick.curX = t.clientX;
  stick.curY = t.clientY;

  const dx = stick.curX - stick.baseX;
  const dy = stick.curY - stick.baseY;
  const len = Math.hypot(dx, dy);

  if (len < stick.deadZone) {
    move.active = false;
    return;
  }
  const ratio = Math.min(1, len / stick.maxDist);
  move.dx = (dx / len) * ratio;
  move.dy = (dy / len) * ratio;
  move.active = true;
}, { passive: false });

function endTouch(e) {
  if (overlayVisible()) return;
  e.preventDefault();
  lastPointerType = 'touch';
  stick.active = false;
  move.active = false;
}
canvas.addEventListener('touchend',    endTouch, { passive: false });
canvas.addEventListener('touchcancel', endTouch, { passive: false });

/* ---------- アセット ---------- */
const ASSETS = {
  player: './assets/player.png',
  enemies: {
    dog:    './assets/enemies/dog.svg',
    cat:    './assets/enemies/cat.svg',
    bear:   './assets/enemies/bear.svg',
    rabbit: './assets/enemies/rabbit.svg',
  },
};

const images = { player: null, enemies: {} };

function loadImage(src) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

async function loadAssets() {
  images.player = await loadImage(ASSETS.player);
  for (const [k, src] of Object.entries(ASSETS.enemies)) {
    images.enemies[k] = await loadImage(src);
  }
}

/* ---------- ゲーム状態 ---------- */
const ENEMY_TYPES = [
  { key: 'dog',    hp: 18, speed: 85,  r: 15, dmg: 20, exp: 4,  color: '#e0a060' },
  { key: 'cat',    hp: 12, speed: 130, r: 13, dmg: 16, exp: 5,  color: '#c0c0c0' },
  { key: 'bear',   hp: 60, speed: 55,  r: 21, dmg: 40, exp: 14, color: '#8b5a2b' },
  { key: 'rabbit', hp: 10, speed: 170, r: 12, dmg: 14, exp: 6,  color: '#ffd0e0' },
];

let player, enemies, bullets, orbs, effects, particles;
let spawnTimer, elapsed, gameOver, paused, level;
let exp, expNext;
let stats;
let lastTime;
let pendingLevelUps = 0;
let started = false;
let loopRunning = false;

function resetGame() {
  player = {
    x: W / 2, y: H / 2, r: 18,
    speed: 240,
    hp: 100, maxHp: 100,
    invuln: 0,
  };
  enemies = [];
  bullets = [];
  orbs = [];
  effects = [];
  particles = [];
  spawnTimer = 0;
  elapsed = 0;
  gameOver = false;
  paused = false;
  level = 1;
  exp = 0;
  expNext = 5;
  pendingLevelUps = 0;
  stats = {
    weapons: {
      basic:  { level: 1, timer: 0, interval: 0.55, damage: 10, speed: 460, pierce: 0 },
      spread: { level: 0, timer: 0, interval: 1.4, damage: 8,  speed: 400, count: 0 },
      orbit:  { level: 0, timer: 0, angle: 0, count: 0, damage: 14, radius: 70 },
      laser:  { level: 0, timer: 0, interval: 2.2, damage: 40, width: 6 },
    },
    pickupRange: 90,
    moveSpeedMul: 1,
    regen: 0,
    expMul: 1,
  };
  lastTime = performance.now();
}

/* ---------- 敵スポーン ---------- */
function pickEnemyType() {
  const t = elapsed;
  const pool = [
    { type: ENEMY_TYPES[0], w: 5 },
    { type: ENEMY_TYPES[1], w: t > 15 ? 4 : 0 },
    { type: ENEMY_TYPES[3], w: t > 30 ? 3 : 0 },
    { type: ENEMY_TYPES[2], w: t > 60 ? 2 : 0 },
  ];
  const total = pool.reduce((s, p) => s + p.w, 0);
  if (total <= 0) return ENEMY_TYPES[0];
  let r = Math.random() * total;
  for (const p of pool) { r -= p.w; if (r <= 0) return p.type; }
  return ENEMY_TYPES[0];
}

function spawnEnemy() {
  const type = pickEnemyType();
  const edge = Math.floor(Math.random() * 4);
  let x, y;
  if (edge === 0) { x = Math.random() * W; y = -30; }
  else if (edge === 1) { x = W + 30; y = Math.random() * H; }
  else if (edge === 2) { x = Math.random() * W; y = H + 30; }
  else { x = -30; y = Math.random() * H; }

  const hpScale = 1 + elapsed * 0.06;
  const hp = type.hp * hpScale;
  enemies.push({
    type, x, y,
    r: type.r,
    hp, maxHp: hp,
    speed: type.speed * (1 + elapsed * 0.002),
    dmg: type.dmg,
    flash: 0,
  });
}

/* ---------- ユーティリティ ---------- */
function nearestEnemy(px, py) {
  let best = null, bestD = Infinity;
  for (const e of enemies) {
    const d = (e.x - px) ** 2 + (e.y - py) ** 2;
    if (d < bestD) { bestD = d; best = e; }
  }
  return best;
}

function spawnParticles(x, y, color, n = 6) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = 60 + Math.random() * 120;
    particles.push({
      x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
      life: 0.4, maxLife: 0.4, color, r: 2 + Math.random() * 2,
    });
  }
}

/* ---------- 武器 ---------- */
function fireBasic(dt) {
  const w = stats.weapons.basic;
  w.timer -= dt;
  if (w.timer > 0) return;
  const target = nearestEnemy(player.x, player.y);
  if (!target) return;
  w.timer = w.interval;
  const dx = target.x - player.x, dy = target.y - player.y;
  const len = Math.hypot(dx, dy) || 1;
  bullets.push({
    x: player.x, y: player.y,
    vx: (dx / len) * w.speed, vy: (dy / len) * w.speed,
    r: 5, life: 2, damage: w.damage, pierce: w.pierce, hitSet: new Set(),
    color: '#ffd54f',
  });
  AudioEngine.seShoot();
}

function fireSpread(dt) {
  const w = stats.weapons.spread;
  if (w.level <= 0) return;
  w.timer -= dt;
  if (w.timer > 0) return;
  const target = nearestEnemy(player.x, player.y);
  if (!target) return;
  w.timer = w.interval;
  const base = Math.atan2(target.y - player.y, target.x - player.x);
  const count = 3 + (w.level - 1) * 2;
  const arc = Math.PI / 6;
  for (let i = 0; i < count; i++) {
    const a = base - arc / 2 + (arc / (count - 1 || 1)) * i;
    bullets.push({
      x: player.x, y: player.y,
      vx: Math.cos(a) * w.speed, vy: Math.sin(a) * w.speed,
      r: 4, life: 1.6, damage: w.damage, pierce: 0, hitSet: new Set(),
      color: '#4fc3f7',
    });
  }
  AudioEngine.seShoot();
}

function updateOrbit(dt) {
  const w = stats.weapons.orbit;
  if (w.level <= 0) return;
  w.angle += dt * 2.4;
  for (let i = 0; i < w.count; i++) {
    const a = w.angle + (Math.PI * 2 / w.count) * i;
    const ox = player.x + Math.cos(a) * w.radius;
    const oy = player.y + Math.sin(a) * w.radius;
    for (const e of enemies) {
      const d = (ox - e.x) ** 2 + (oy - e.y) ** 2;
      if (d < (14 + e.r) ** 2) {
        e.hp -= w.damage * dt * 4;
        e.flash = 0.1;
      }
    }
  }
}

function fireLaser(dt) {
  const w = stats.weapons.laser;
  if (w.level <= 0) return;
  w.timer -= dt;
  if (w.timer > 0) return;
  const target = nearestEnemy(player.x, player.y);
  if (!target) return;
  w.timer = w.interval;
  const a = Math.atan2(target.y - player.y, target.x - player.x);
  const len = 1200;
  const x2 = player.x + Math.cos(a) * len;
  const y2 = player.y + Math.sin(a) * len;
  for (const e of enemies) {
    const dx = x2 - player.x, dy = y2 - player.y;
    const t = ((e.x - player.x) * dx + (e.y - player.y) * dy) / (dx * dx + dy * dy);
    if (t < 0 || t > 1) continue;
    const px = player.x + dx * t, py = player.y + dy * t;
    const d = Math.hypot(e.x - px, e.y - py);
    if (d < e.r + w.width) {
      e.hp -= w.damage;
      e.flash = 0.15;
    }
  }
  effects.push({ type: 'laser', x1: player.x, y1: player.y, x2, y2, life: 0.18, maxLife: 0.18 });
  AudioEngine.seShoot();
}

/* ---------- 更新 ---------- */
function update(dt) {
  if (gameOver || paused) return;
  elapsed += dt;

  if (move.active) {
    const sp = player.speed * stats.moveSpeedMul;
    const len = Math.hypot(move.dx, move.dy) || 1;
    const scale = Math.min(1, len);
    player.x += (move.dx / len) * sp * scale * dt;
    player.y += (move.dy / len) * sp * scale * dt;
  }
  player.x = Math.max(player.r, Math.min(W - player.r, player.x));
  player.y = Math.max(player.r, Math.min(H - player.r, player.y));

  if (player.invuln > 0) player.invuln -= dt;
  if (stats.regen > 0) player.hp = Math.min(player.maxHp, player.hp + stats.regen * dt);

  fireBasic(dt);
  fireSpread(dt);
  fireLaser(dt);
  updateOrbit(dt);

  for (const b of bullets) { b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt; }
  for (const b of bullets) {
    if (b.life <= 0) continue;
    for (const e of enemies) {
      if (e.hp <= 0) continue;
      if (b.hitSet.has(e)) continue;
      const d = (b.x - e.x) ** 2 + (b.y - e.y) ** 2;
      if (d < (b.r + e.r) ** 2) {
        e.hp -= b.damage;
        e.flash = 0.1;
        b.hitSet.add(e);
        spawnParticles(b.x, b.y, '#fff', 3);
        if (b.pierce > 0) b.pierce--;
        else { b.life = 0; break; }
      }
    }
  }
  bullets = bullets.filter(b => b.life > 0 && b.x > -40 && b.x < W + 40 && b.y > -40 && b.y < H + 40);

  spawnTimer -= dt;
  if (spawnTimer <= 0) {
    const interval = Math.max(0.18, 1.1 - elapsed * 0.012);
    spawnTimer = interval;
    spawnEnemy();
    if (elapsed > 45 && Math.random() < 0.4) spawnEnemy();
  }

  for (const e of enemies) {
    const dx = player.x - e.x, dy = player.y - e.y;
    const len = Math.hypot(dx, dy) || 1;
    e.x += (dx / len) * e.speed * dt;
    e.y += (dy / len) * e.speed * dt;
    if (e.flash > 0) e.flash -= dt;
  }

  for (const e of enemies) {
    const d = (player.x - e.x) ** 2 + (player.y - e.y) ** 2;
    if (d < (player.r + e.r) ** 2 && player.invuln <= 0) {
      player.hp -= e.dmg;
      player.invuln = 0.4;
      AudioEngine.seHit();
      spawnParticles(player.x, player.y, '#f66', 8);
    }
  }

  const alive = [];
  for (const e of enemies) {
    if (e.hp <= 0) {
      orbs.push({ x: e.x, y: e.y, r: 5, exp: e.type.exp });
      spawnParticles(e.x, e.y, e.type.color, 8);
    } else {
      alive.push(e);
    }
  }
  enemies = alive;

  for (const o of orbs) {
    const dx = player.x - o.x, dy = player.y - o.y;
    const dist = Math.hypot(dx, dy);
    if (dist < stats.pickupRange && dist > 0.01) {
      const pull = 500 * (1 - dist / stats.pickupRange) + 200;
      o.x += (dx / dist) * pull * dt;
      o.y += (dy / dist) * pull * dt;
    }
  }
  const remain = [];
  for (const o of orbs) {
    const d = (player.x - o.x) ** 2 + (player.y - o.y) ** 2;
    if (d < (player.r + o.r) ** 2) {
      exp += o.exp * stats.expMul;
      while (exp >= expNext) {
        exp -= expNext;
        level++;
        expNext = Math.floor(expNext * 1.35 + 3);
        pendingLevelUps++;
      }
    } else remain.push(o);
  }
  orbs = remain;

  for (const p of particles) {
    p.x += p.vx * dt; p.y += p.vy * dt;
    p.vx *= 0.92; p.vy *= 0.92;
    p.life -= dt;
  }
  particles = particles.filter(p => p.life > 0);

  for (const ef of effects) ef.life -= dt;
  effects = effects.filter(ef => ef.life > 0);

  if (player.hp <= 0) {
    player.hp = 0;
    gameOver = true;
    AudioEngine.stopBGM();
    AudioEngine.seGameOver();
    showOverlay('GAME OVER', `生存 ${elapsed.toFixed(1)}秒 / Lv.${level}`, 'RETRY');
  }
}

/* ---------- レベルアップ ---------- */
const UPGRADES = [
  { id: 'basic_dmg',    name: '基本攻撃 強化', desc: '基本武器のダメージ +5',       apply: s => s.weapons.basic.damage += 5 },
  { id: 'basic_rate',   name: '基本攻撃 連射', desc: '基本武器の間隔 -15%',         apply: s => s.weapons.basic.interval = Math.max(0.12, s.weapons.basic.interval * 0.85) },
  { id: 'basic_pierce', name: '基本攻撃 貫通', desc: '基本武器が1体貫通',           apply: s => s.weapons.basic.pierce += 1 },
  { id: 'spread',       name: '拡散ショット',   desc: '扇状に複数弾（Lv+1）',        apply: s => { s.weapons.spread.level++; s.weapons.spread.damage += 2; } },
  { id: 'orbit',        name: '回転バリア',     desc: '周囲を回る弾（Lv+1）',        apply: s => { s.weapons.orbit.level++; s.weapons.orbit.count++; s.weapons.orbit.damage += 3; } },
  { id: 'laser',        name: '貫通レーザー',   desc: '直線上に大ダメージ',          apply: s => { s.weapons.laser.level++; s.weapons.laser.damage += 15; s.weapons.laser.interval = Math.max(1.0, s.weapons.laser.interval - 0.2); } },
  { id: 'speed',        name: '移動速度 UP',    desc: '移動速度 +12%',               apply: s => s.moveSpeedMul *= 1.12 },
  { id: 'maxhp',        name: '最大HP UP',      desc: '最大HP +25 & 全回復',         apply: s => { player.maxHp += 25; player.hp = player.maxHp; } },
  { id: 'regen',        name: 'HP自動回復',     desc: '毎秒 +1.5 HP',                apply: s => s.regen += 1.5 },
  { id: 'pickup',       name: '取得範囲 UP',    desc: '経験値の吸引範囲 +40',        apply: s => s.pickupRange += 40 },
  { id: 'expmul',       name: '経験値 UP',      desc: '獲得経験値 +25%',             apply: s => s.expMul *= 1.25 },
];

function showLevelUpChoices() {
  if (pendingLevelUps <= 0) {
    paused = false;
    levelupEl.classList.add('hidden');
    lastTime = performance.now();
    return;
  }
  paused = true;
  levelupEl.classList.remove('hidden');
  choicesEl.innerHTML = '';

  const pool = [...UPGRADES];
  const picked = [];
  for (let i = 0; i < 3 && pool.length > 0; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    picked.push(pool.splice(idx, 1)[0]);
  }

  for (const up of picked) {
    const div = document.createElement('div');
    div.className = 'choice';
    div.innerHTML = `<div class="name">${up.name}</div><div class="desc">${up.desc}</div>`;
    div.addEventListener('click', () => {
      up.apply(stats);
      pendingLevelUps--;
      AudioEngine.seLevelUp();
      showLevelUpChoices();
    });
    choicesEl.appendChild(div);
  }
}

/* ---------- 描画 ---------- */
function drawImageCentered(img, x, y, size) {
  ctx.drawImage(img, x - size / 2, y - size / 2, size, size);
}

function draw() {
  ctx.fillStyle = '#0d0d12';
  ctx.fillRect(0, 0, W, H);

  ctx.strokeStyle = 'rgba(255,255,255,0.03)';
  ctx.lineWidth = 1;
  const g = 60;
  for (let x = 0; x < W; x += g) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  for (let y = 0; y < H; y += g) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

  for (const o of orbs) {
    ctx.fillStyle = '#7fe57f';
    ctx.beginPath(); ctx.arc(o.x, o.y, o.r, 0, Math.PI * 2); ctx.fill();
  }

  for (const e of enemies) {
    const img = images.enemies[e.type.key];
    const size = e.r * 2.6;
    if (img) {
      drawImageCentered(img, e.x, e.y, size);
      if (e.flash > 0) {
        ctx.globalAlpha = 0.6;
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
      }
    } else {
      ctx.fillStyle = e.flash > 0 ? '#fff' : e.type.color;
      ctx.beginPath(); ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2); ctx.fill();
    }
    const w = e.r * 2;
    const ratio = Math.max(0, e.hp / e.maxHp);
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(e.x - e.r, e.y - e.r - 9, w, 4);
    ctx.fillStyle = '#4caf50';
    ctx.fillRect(e.x - e.r, e.y - e.r - 9, w * ratio, 4);
  }

  for (const b of bullets) {
    ctx.fillStyle = b.color || '#ffd54f';
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill();
  }

  const w = stats.weapons.orbit;
  if (w.level > 0) {
    for (let i = 0; i < w.count; i++) {
      const a = w.angle + (Math.PI * 2 / w.count) * i;
      const ox = player.x + Math.cos(a) * w.radius;
      const oy = player.y + Math.sin(a) * w.radius;
      ctx.fillStyle = '#b388ff';
      ctx.beginPath(); ctx.arc(ox, oy, 12, 0, Math.PI * 2); ctx.fill();
    }
  }

  for (const ef of effects) {
    if (ef.type === 'laser') {
      const alpha = ef.life / ef.maxLife;
      ctx.strokeStyle = `rgba(255,80,180,${alpha})`;
      ctx.lineWidth = 6;
      ctx.beginPath(); ctx.moveTo(ef.x1, ef.y1); ctx.lineTo(ef.x2, ef.y2); ctx.stroke();
      ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(ef.x1, ef.y1); ctx.lineTo(ef.x2, ef.y2); ctx.stroke();
    }
  }

  for (const p of particles) {
    ctx.globalAlpha = p.life / p.maxLife;
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;

  if (player.invuln > 0) ctx.globalAlpha = 0.6;
  if (images.player) {
    drawImageCentered(images.player, player.x, player.y, player.r * 2.6);
  } else {
    ctx.fillStyle = '#4fc3f7';
    ctx.beginPath(); ctx.arc(player.x, player.y, player.r, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;

  ctx.fillStyle = '#fff';
  ctx.font = '14px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`HP ${Math.ceil(player.hp)} / ${player.maxHp}`, 12, 22);
  ctx.fillText(`Lv.${level}`, 12, 42);
  ctx.fillText(`Time ${elapsed.toFixed(1)}s`, 12, 62);

  const barW = W - 24;
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.fillRect(12, 74, barW, 8);
  ctx.fillStyle = '#7fe57f';
  ctx.fillRect(12, 74, barW * Math.min(1, exp / expNext), 8);

  // バーチャルスティック可視化（タッチ中のみ）
  if (stick.active) {
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(stick.baseX, stick.baseY, stick.maxDist, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = 'rgba(79,195,247,0.5)';
    ctx.beginPath();
    ctx.arc(stick.baseX, stick.baseY, 10, 0, Math.PI * 2);
    ctx.fill();

    const dx = stick.curX - stick.baseX;
    const dy = stick.curY - stick.baseY;
    const len = Math.hypot(dx, dy);
    const ratio = Math.min(1, len / stick.maxDist);
    const kx = stick.baseX + (len > 0 ? dx / len : 0) * stick.maxDist * ratio;
    const ky = stick.baseY + (len > 0 ? dy / len : 0) * stick.maxDist * ratio;
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.beginPath();
    ctx.arc(kx, ky, 16, 0, Math.PI * 2);
    ctx.fill();
  }
}

/* ---------- メインループ ---------- */
function loop(now) {
  const dt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;
  update(dt);
  draw();
  if (pendingLevelUps > 0 && !paused && !gameOver) {
    showLevelUpChoices();
  }
  requestAnimationFrame(loop);
}

function ensureLoop() {
  if (loopRunning) return;
  loopRunning = true;
  lastTime = performance.now();
  requestAnimationFrame(loop);
}

/* ---------- オーバーレイ表示 ---------- */
function showOverlay(title, msg, btnText) {
  overlayTitle.textContent = title;
  overlayMsg.textContent = msg;
  overlayHelp.style.display = 'none';
  startBtn.textContent = btnText || 'START';
  overlayEl.classList.remove('hidden');
}

function showStartScreen() {
  overlayTitle.textContent = 'Vansaba';
  overlayMsg.textContent = 'タップ / クリックで開始';
  overlayHelp.style.display = 'block';
  startBtn.textContent = 'START';
  overlayEl.classList.remove('hidden');
}

/* ---------- 起動 ---------- */
(async () => {
  await loadAssets();
  resetGame();
  draw();
  showStartScreen();
})();

/* ---------- START 処理 ---------- */
let starting = false;

function handleStart(e) {
  if (e) { e.preventDefault(); e.stopPropagation(); }
  if (starting) return;
  starting = true;
  try {
    // AudioContext はユーザー操作の同期処理内で初期化
    AudioEngine.init();
    AudioEngine.resume();

    overlayEl.classList.add('hidden');
    resetGame();
    AudioEngine.startBGM();
    lastTime = performance.now();
    ensureLoop();
  } finally {
    starting = false;
  }
}

startBtn.addEventListener('pointerdown', handleStart);
startBtn.addEventListener('touchend', handleStart, { passive: false });
startBtn.addEventListener('click', handleStart);