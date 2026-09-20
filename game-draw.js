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

  if (player && stats) {
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
          ctx.globalAlpha = 0.6; ctx.fillStyle = '#fff';
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
        ctx.strokeStyle = 'rgba(255,80,180,' + alpha + ')';
        ctx.lineWidth = 6;
        ctx.beginPath(); ctx.moveTo(ef.x1, ef.y1); ctx.lineTo(ef.x2, ef.y2); ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,' + alpha + ')';
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
    ctx.fillText('HP ' + Math.ceil(player.hp) + ' / ' + player.maxHp, 12, 22);
    ctx.fillText('Lv.' + level, 12, 42);
    ctx.fillText('Time ' + elapsed.toFixed(1) + 's', 12, 62);
    const barW = W - 24;
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fillRect(12, 74, barW, 8);
    ctx.fillStyle = '#7fe57f';
    ctx.fillRect(12, 74, barW * Math.min(1, exp / expNext), 8);
  }

  if (stick.active) {
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(stick.baseX, stick.baseY, stick.maxDist, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(79,195,247,0.5)';
    ctx.beginPath(); ctx.arc(stick.baseX, stick.baseY, 10, 0, Math.PI * 2); ctx.fill();
    const dx = stick.curX - stick.baseX, dy = stick.curY - stick.baseY;
    const len = Math.hypot(dx, dy);
    const ratio = Math.min(1, len / stick.maxDist);
    const kx = stick.baseX + (len > 0 ? dx / len : 0) * stick.maxDist * ratio;
    const ky = stick.baseY + (len > 0 ? dy / len : 0) * stick.maxDist * ratio;
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.beginPath(); ctx.arc(kx, ky, 16, 0, Math.PI * 2); ctx.fill();
  }
}

function loop(now) {
  const rawDt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;
  update(rawDt * gameSpeed);
  draw();
  if (pendingLevelUps > 0 && !paused && !gameOver) showLevelUpChoices();
  gameLoopId = requestAnimationFrame(loop);
}

function stopLoop() {
  if (gameLoopId !== null) { cancelAnimationFrame(gameLoopId); gameLoopId = null; }
}

function beginGame() {
  stopLoop();
  try { AudioEngine.init(); AudioEngine.resume(); } catch (err) { console.warn(err); }
  overlayEl.classList.add('hidden');
  levelupEl.classList.add('hidden');
  speedBar.classList.remove('hidden');
  resetGame();
  try { AudioEngine.startBGM(); } catch (err) { console.warn(err); }
  lastTime = performance.now();
  gameLoopId = requestAnimationFrame(loop);
}

function showOverlay(title, msg, btnText) {
  overlayTitle.textContent = title;
  overlayMsg.textContent = msg;
  overlayHelp.style.display = 'none';
  startBtn.textContent = btnText || 'START';
  speedBar.classList.add('hidden');
  overlayEl.classList.remove('hidden');
}

function showStartScreen() {
  overlayTitle.innerHTML = 'はしちゃん<br>サバイバー';
  overlayMsg.textContent = 'タップ / クリックで開始';
  overlayHelp.style.display = 'block';
  startBtn.textContent = 'START';
  speedBar.classList.add('hidden');
  overlayEl.classList.remove('hidden');
}

function onStartButton(ev) {
  if (ev) { ev.preventDefault(); ev.stopPropagation(); }
  beginGame();
}
startBtn.addEventListener('touchend', onStartButton, { passive: false });
startBtn.addEventListener('click', onStartButton);

(async () => {
  await loadAssets();
  resetGame();
  draw();
  showStartScreen();
})();