(() => {
  "use strict";
  const canvas = document.querySelector("#game"),
    ctx = canvas.getContext("2d");
  if (!ctx)
    throw new Error(
      "Safari could not create the game canvas. Reload the page.",
    );
  let W = 0,
    H = 0,
    dpr = 1;
  function resize() {
    W = canvas.clientWidth;
    H = canvas.clientHeight;
    dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  addEventListener("resize", resize);
  if (window.visualViewport) visualViewport.addEventListener("resize", resize);
  resize();
  const $ = (s) => document.querySelector(s);
  let mode = "menu",
    last = 0,
    elapsed = 0,
    spawn = 0,
    shake = 0,
    level = 1,
    xp = 0,
    kills = 0,
    need = 12;
  let p,
    enemies = [],
    particles = [],
    rings = [],
    orbs = [],
    keys = {},
    joy = { x: 0, y: 0, id: null },
    charging = false,
    charge = 0,
    dashCd = 0,
    invuln = 0,
    upgrade = { aura: 1, ignite: 1, nova: 1, speed: 1, prolif: 1 };
  const rand = (a, b) => a + Math.random() * (b - a),
    clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  function reset() {
    resetInput();
    p = { x: 0, y: 0, hp: 75, max: 100, speed: 185 };
    enemies = [];
    particles = [];
    rings = [];
    orbs = [];
    elapsed = 0;
    spawn = 0;
    kills = 0;
    level = 1;
    xp = 0;
    need = 12;
    charging = false;
    charge = 0;
    dashCd = 0;
    invuln = 0;
    upgrade = { aura: 1, ignite: 1, nova: 1, speed: 1, prolif: 1 };
    mode = "play";
    $("#overlay").style.display = "none";
  }
  function particle(x, y, c, n = 1) {
    for (let i = 0; i < n; i++)
      particles.push({
        x,
        y,
        vx: rand(-90, 90),
        vy: rand(-110, 70),
        life: rand(0.25, 0.7),
        max: 0.7,
        c,
        r: rand(2, 5),
      });
  }
  function enemy() {
    let a = rand(0, Math.PI * 2),
      dist = Math.max(W, H) * 0.72 + 80,
      t = elapsed > 70 && Math.random() < 0.17 ? "brute" : "imp";
    enemies.push({
      x: p.x + Math.cos(a) * dist,
      y: p.y + Math.sin(a) * dist,
      hp: t === "brute" ? 140 + elapsed * 1.4 : 32 + elapsed * 0.45,
      max: t === "brute" ? 140 + elapsed * 1.4 : 32 + elapsed * 0.45,
      r: t === "brute" ? 20 : 12,
      speed: t === "brute" ? 54 : rand(65, 100),
      burn: 0,
      burnDps: 0,
      hit: 0,
      proliferated: false,
      t,
    });
  }
  function ignite(e, dps, duration = 3.6, spread = true) {
    if (e.hp <= 0) return;
    if (dps > e.burnDps) {
      e.burnDps = dps;
      e.burn = duration;
      e.proliferated = !spread;
      particle(e.x, e.y, "#ffae38", 4);
    }
  }
  function kill(e) {
    if (e.hp > 0) return;
    e.dead = true;
    kills++;
    particle(e.x, e.y, "#ff7939", 9);
    orbs.push({ x: e.x, y: e.y, v: e.t === "brute" ? 5 : 1 });
    if (e.burnDps > 0 && upgrade.prolif >= 3) {
      for (const other of enemies) {
        if (
          other !== e &&
          !other.dead &&
          Math.hypot(other.x - e.x, other.y - e.y) < 85
        )
          ignite(other, e.burnDps * 0.65, 2.6, false);
      }
    }
  }
  function nova() {
    if (mode !== "play" || !charging) return;
    charging = false;
    let power = clamp(charge / 0.95, 0, 1),
      radius = 100 + power * 150,
      hit = 16 + power * 160 * upgrade.nova,
      igniteDps = hit * (0.25 + 0.12 * upgrade.ignite);
    rings.push({
      x: p.x,
      y: p.y,
      r: 10,
      max: radius,
      life: 0.48,
      c: "#ffbd68",
      width: 12 + power * 14,
    });
    for (const e of enemies) {
      if (!e.dead && Math.hypot(e.x - p.x, e.y - p.y) < radius + e.r) {
        e.hp -= hit;
        ignite(e, igniteDps, 4.2, true);
        particle(e.x, e.y, "#ffdb6b", 7);
        if (e.hp <= 0) kill(e);
      }
    }
    shake = power * 8;
    charge = 0;
  }
  function dash() {
    if (mode !== "play" || dashCd > 0) return;
    let vx =
        joy.x +
        (keys.d || keys.arrowright ? 1 : 0) -
        (keys.a || keys.arrowleft ? 1 : 0),
      vy =
        joy.y +
        (keys.s || keys.arrowdown ? 1 : 0) -
        (keys.w || keys.arrowup ? 1 : 0),
      m = Math.hypot(vx, vy);
    if (m < 0.1) {
      vx = 1;
      vy = 0;
      m = 1;
    }
    p.x += (vx / m) * 145;
    p.y += (vy / m) * 145;
    dashCd = 3;
    invuln = 0.32;
    rings.push({
      x: p.x,
      y: p.y,
      r: 15,
      max: 95,
      life: 0.35,
      c: "#a68cff",
      width: 5,
    });
    particle(p.x, p.y, "#d2a6ff", 18);
  }
  function update(dt) {
    if (mode !== "play") return;
    elapsed += dt;
    spawn -= dt;
    dashCd = Math.max(0, dashCd - dt);
    invuln = Math.max(0, invuln - dt);
    if (charging) charge = Math.min(1.5, charge + dt);
    if (spawn <= 0) {
      spawn = Math.max(0.18, 0.85 - elapsed * 0.005);
      enemy();
      if (elapsed > 35 && Math.random() < 0.3) enemy();
    }
    let vx =
        joy.x +
        (keys.d || keys.arrowright ? 1 : 0) -
        (keys.a || keys.arrowleft ? 1 : 0),
      vy =
        joy.y +
        (keys.s || keys.arrowdown ? 1 : 0) -
        (keys.w || keys.arrowup ? 1 : 0),
      mag = Math.hypot(vx, vy);
    if (mag > 0) {
      p.x += (vx / mag) * p.speed * upgrade.speed ** 0.22 * dt;
      p.y += (vy / mag) * p.speed * upgrade.speed ** 0.22 * dt;
    }
    p.hp = Math.min(75, p.hp + dt * (0.7 + upgrade.aura * 0.18));
    for (const e of enemies) {
      if (e.dead) continue;
      let dx = p.x - e.x,
        dy = p.y - e.y,
        dist = Math.hypot(dx, dy) || 1;
      if (dist > e.r + 14) {
        e.x += (dx / dist) * e.speed * dt;
        e.y += (dy / dist) * e.speed * dt;
      } else if (invuln <= 0) {
        p.hp -= dt * (e.t === "brute" ? 21 : 9);
      }
      if (dist < 70 + upgrade.aura * 10) {
        e.hp -= dt * (13 + upgrade.aura * 7);
        if (e.burnDps < 5 + upgrade.aura * 2)
          ignite(e, 5 + upgrade.aura * 2, 1.2, false);
        if (Math.random() < dt * 7) particle(e.x, e.y, "#ff672c");
      }
      if (e.burn > 0) {
        e.burn -= dt;
        e.hp -= e.burnDps * dt;
        if (e.burn > 0 && !e.proliferated) {
          for (const o of enemies) {
            if (
              o !== e &&
              !o.dead &&
              Math.hypot(o.x - e.x, o.y - e.y) < 65 + upgrade.prolif * 12
            ) {
              ignite(o, e.burnDps * 0.8, Math.max(1.7, e.burn * 0.8), false);
            }
          }
          e.proliferated = true;
        }
      } else e.burnDps = 0;
      if (e.hp <= 0) kill(e);
    }
    enemies = enemies.filter((e) => !e.dead);
    for (const o of orbs) {
      let dx = p.x - o.x,
        dy = p.y - o.y,
        d = Math.hypot(dx, dy) || 1;
      if (d < 150) {
        o.x += (dx / d) * dt * 270;
        o.y += (dy / d) * dt * 270;
      }
      if (d < 23) {
        o.dead = true;
        xp += o.v;
      }
    }
    orbs = orbs.filter((o) => !o.dead);
    if (xp >= need) {
      xp -= need;
      level++;
      need = Math.floor(need * 1.32 + 5);
      showUpgrade();
    }
    for (const q of particles) {
      q.x += q.vx * dt;
      q.y += q.vy * dt;
      q.life -= dt;
    }
    particles = particles.filter((q) => q.life > 0);
    for (const r of rings) {
      r.r += (r.max - r.r) * Math.min(1, dt * 10);
      r.life -= dt;
    }
    rings = rings.filter((r) => r.life > 0);
    shake = Math.max(0, shake - dt * 25);
    if (p.hp <= 0) {
      p.hp = 0;
      mode = "dead";
      showDead();
    }
    $("#hp").style.width = p.hp + "%";
    $("#hptext").textContent = Math.ceil(p.hp) + " / 75 (25 reserved)";
    $("#xp").style.width = clamp((xp / need) * 100, 0, 100) + "%";
    $("#level").textContent = level;
    $("#kills").textContent = "☠ " + kills + " kills";
    $("#time").textContent = "⏱ " + Math.floor(elapsed) + "s";
    $("#burn").textContent = "🔥 Aura " + upgrade.aura;
    $("#chargefill").style.width = (charge / 1.5) * 100 + "%";
    $("#dash").style.opacity = dashCd > 0 ? ".45" : "1";
  }
  function showUpgrade() {
    mode = "upgrade";
    resetInput();
    const options = [
      ["aura", "Infernal Heart", "Aura damage and radius +"],
      ["ignite", "Wildfire", "Ignites burn harder"],
      ["nova", "Cataclysm", "Fire Nova damage +"],
      ["speed", "Ghostfire", "Movement speed +"],
      ["prolif", "Contagion", "Ignite spread radius +"],
    ]
      .sort(() => Math.random() - 0.5)
      .slice(0, 3);
    $("#panel").innerHTML =
      "<h1>✦ Level " +
      level +
      '</h1><p>Choose a permanent upgrade</p><div id="choices">' +
      options
        .map(
          ([id, name, desc]) =>
            '<button type="button" class="choice" data-up="' +
            id +
            '"><b>' +
            name +
            '</b><br><span class="small">' +
            desc +
            "</span></button>",
        )
        .join("") +
      "</div>";
    $("#overlay").style.display = "flex";
    document.querySelectorAll("[data-up]").forEach(
      (b) =>
        (b.onclick = () => {
          upgrade[b.dataset.up]++;
          mode = "play";
          $("#overlay").style.display = "none";
        }),
    );
  }
  function showDead() {
    resetInput();
    $("#panel").innerHTML =
      "<h1>🔥 The Flame Fades</h1><p>Survived " +
      Math.floor(elapsed) +
      " seconds · " +
      kills +
      " kills · Level " +
      level +
      '</p><p class="small">Prototype v0.1 — next: loot, legendary essences, bosses, and rifts.</p><div id="choices"><button type="button" class="start" id="restart">TRY AGAIN</button></div>';
    $("#overlay").style.display = "flex";
    $("#restart").onclick = reset;
  }
  function draw() {
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    ctx.translate(
      W / 2 - p.x + rand(-shake, shake),
      H / 2 - p.y + rand(-shake, shake),
    );
    const left = p.x - W / 2 - 100,
      top = p.y - H / 2 - 100;
    ctx.fillStyle = "#171321";
    ctx.fillRect(left, top, W + 200, H + 200);
    ctx.strokeStyle = "#ffffff0c";
    ctx.lineWidth = 1;
    let step = 70;
    for (
      let x = Math.floor(left / step) * step;
      x < left + W + 200;
      x += step
    ) {
      ctx.beginPath();
      ctx.moveTo(x, top);
      ctx.lineTo(x, top + H + 200);
      ctx.stroke();
    }
    for (let y = Math.floor(top / step) * step; y < top + H + 200; y += step) {
      ctx.beginPath();
      ctx.moveTo(left, y);
      ctx.lineTo(left + W + 200, y);
      ctx.stroke();
    }
    if (p) {
      let pulse = Math.sin(performance.now() / 230) * 4;
      const grd = ctx.createRadialGradient(
        p.x,
        p.y,
        5,
        p.x,
        p.y,
        78 + upgrade.aura * 10 + pulse,
      );
      grd.addColorStop(0, "#ff7b3033");
      grd.addColorStop(0.7, "#ff4b1933");
      grd.addColorStop(1, "#ff4b1900");
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 78 + upgrade.aura * 10 + pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#fa6a3899";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 69 + upgrade.aura * 10 + pulse, 0, Math.PI * 2);
      ctx.stroke();
    }
    for (const o of orbs) {
      ctx.fillStyle = "#7cd3ff";
      ctx.shadowBlur = 12;
      ctx.shadowColor = "#55caff";
      ctx.beginPath();
      ctx.arc(o.x, o.y, o.v > 1 ? 8 : 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }
    for (const e of enemies) {
      ctx.fillStyle = e.t === "brute" ? "#865069" : "#a54c62";
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = e.burn > 0 ? "#ffae40" : "#d5a1ad";
      ctx.lineWidth = e.burn > 0 ? 3 : 1;
      ctx.stroke();
      if (e.burn > 0) {
        ctx.fillStyle = "#ff8e29";
        ctx.beginPath();
        ctx.arc(
          e.x + rand(-4, 4),
          e.y - e.r - 4,
          3 + Math.random() * 3,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
      if (e.t === "brute") {
        ctx.fillStyle = "#1a1018";
        ctx.fillRect(e.x - 20, e.y - 28, 40, 4);
        ctx.fillStyle = "#e27b65";
        ctx.fillRect(e.x - 20, e.y - 28, 40 * Math.max(0, e.hp / e.max), 4);
      }
    }
    if (p) {
      ctx.fillStyle = invuln > 0 ? "#d5bbff" : "#ffe4b0";
      ctx.shadowColor = "#ff9a3e";
      ctx.shadowBlur = 18;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#a43127";
      ctx.beginPath();
      ctx.arc(p.x, p.y, 7, 0, Math.PI * 2);
      ctx.fill();
      if (charging) {
        ctx.strokeStyle = "#ffdf8c";
        ctx.lineWidth = 3 + charge * 3;
        ctx.beginPath();
        ctx.arc(
          p.x,
          p.y,
          28 + charge * 25,
          0,
          Math.PI * 2 * clamp(charge / 1.5, 0, 1),
        );
        ctx.stroke();
      }
    }
    for (const r of rings) {
      ctx.globalAlpha = clamp(r.life / 0.48, 0, 1);
      ctx.strokeStyle = r.c;
      ctx.lineWidth = r.width;
      ctx.shadowBlur = 20;
      ctx.shadowColor = r.c;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
    }
    for (const q of particles) {
      ctx.globalAlpha = clamp(q.life / q.max, 0, 1);
      ctx.fillStyle = q.c;
      ctx.beginPath();
      ctx.arc(q.x, q.y, q.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  } // The game rules above are unchanged; input ownership and lifecycle handling follow.
  let frames = 0;
  function frame(t) {
    const dt = Math.min(0.035, (t - last) / 1000 || 0);
    last = t;
    update(dt);
    if (p) draw();
    frames++;
    requestAnimationFrame(frame);
  }

  const stick = $("#stick"),
    knob = $("#knob"),
    novaButton = $("#nova");
  let novaPointerId = null;
  function releasePointer(element, id) {
    if (id !== null && element.hasPointerCapture(id))
      element.releasePointerCapture(id);
  }
  function resetInput() {
    keys = {};
    const stickId = joy.id,
      novaId = novaPointerId;
    joy.x = joy.y = 0;
    joy.id = novaPointerId = null;
    knob.style.transform = "translate(0,0)";
    charging = false;
    charge = 0;
    $("#chargefill").style.width = "0%";
    releasePointer(stick, stickId);
    releasePointer(novaButton, novaId);
  }
  function startCharge() {
    if (mode === "play" && !charging) {
      charging = true;
      charge = 0;
    }
  }
  $("#start").addEventListener("click", reset);
  novaButton.addEventListener("pointerdown", (e) => {
    if (
      mode !== "play" ||
      novaPointerId !== null ||
      (e.pointerType === "mouse" && e.button !== 0)
    )
      return;
    e.preventDefault();
    novaPointerId = e.pointerId;
    novaButton.setPointerCapture(e.pointerId);
    startCharge();
  });
  function endNova(e, fire) {
    if (e.pointerId !== novaPointerId) return;
    e.preventDefault();
    const id = novaPointerId;
    novaPointerId = null;
    if (fire) nova();
    else {
      charging = false;
      charge = 0;
    }
    releasePointer(novaButton, id);
  }
  novaButton.addEventListener("pointerup", (e) => endNova(e, true));
  novaButton.addEventListener("pointercancel", (e) => endNova(e, false));
  novaButton.addEventListener("lostpointercapture", (e) => endNova(e, false));
  $("#dash").addEventListener("pointerdown", (e) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    e.preventDefault();
    dash();
  });
  function moveJoy(e) {
    const r = stick.getBoundingClientRect(),
      x = e.clientX - (r.left + r.width / 2),
      y = e.clientY - (r.top + r.height / 2);
    const m = Math.max(1, Math.hypot(x, y)),
      v = Math.min(45, m);
    joy.x = x / m;
    joy.y = y / m;
    knob.style.transform = "translate(" + joy.x * v + "px," + joy.y * v + "px)";
  }
  stick.addEventListener("pointerdown", (e) => {
    if (
      mode !== "play" ||
      joy.id !== null ||
      (e.pointerType === "mouse" && e.button !== 0)
    )
      return;
    e.preventDefault();
    joy.id = e.pointerId;
    stick.setPointerCapture(e.pointerId);
    moveJoy(e);
  });
  stick.addEventListener("pointermove", (e) => {
    if (e.pointerId === joy.id) moveJoy(e);
  });
  function endJoy(e) {
    if (e.pointerId !== joy.id) return;
    const id = joy.id;
    joy.x = joy.y = 0;
    joy.id = null;
    knob.style.transform = "translate(0,0)";
    releasePointer(stick, id);
  }
  stick.addEventListener("pointerup", endJoy);
  stick.addEventListener("pointercancel", endJoy);
  stick.addEventListener("lostpointercapture", endJoy);
  addEventListener("keydown", (e) => {
    if (
      ["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(
        e.code,
      )
    )
      e.preventDefault();
    keys[e.key.toLowerCase()] = true;
    if (e.code === "Space" && !e.repeat) startCharge();
    if (e.key === "Shift") dash();
  });
  addEventListener("keyup", (e) => {
    keys[e.key.toLowerCase()] = false;
    if (e.code === "Space") {
      e.preventDefault();
      nova();
    }
  });
  function suspendInput() {
    resetInput();
    last = 0;
  }
  addEventListener("blur", suspendInput);
  addEventListener("pagehide", suspendInput);
  document.addEventListener("visibilitychange", suspendInput);
  addEventListener("resize", resetInput);

  // Read-only development telemetry; enabled on localhost or with ?debug=1.
  if (window.InfernalDiagnostics && window.InfernalDiagnostics.enabled) {
    const snapshot = () => ({
      mode,
      frames,
      elapsed,
      viewport: { width: W, height: H, dpr },
      player: p ? { x: p.x, y: p.y, hp: p.hp } : null,
      joystick: { ...joy },
      charging,
      charge,
      dashCooldown: dashCd,
      enemies: enemies.length,
      rings: rings.length,
      particles: particles.length,
      level,
      kills,
    });
    Object.defineProperty(window, "InfernalDebug", {
      value: Object.freeze({ snapshot }),
    });
    window.InfernalDiagnostics.attach(snapshot);
  }
  requestAnimationFrame(frame);
})();
