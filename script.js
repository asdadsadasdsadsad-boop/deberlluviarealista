(() => {
  'use strict';

  const fondo = document.getElementById('fondo');
  const fctx = fondo.getContext('2d');
  const lienzo = document.getElementById('lluvia');
  const ctx = lienzo.getContext('2d');

  let W = 0, H = 0, DPR = 1, orilla = 0, E = 1;
  let gotas = [], ondas = [], gotitas = [];
  let ultimo = performance.now(), t = 0;

  const raton = { x: -9999, y: -9999, r: 55, activo: false };

  const CAPAS = 4;
  const estiloCapa = [
    { ancho: 0.6, alfa: 0.14 },
    { ancho: 0.9, alfa: 0.22 },
    { ancho: 1.3, alfa: 0.32 },
    { ancho: 1.9, alfa: 0.42 }
  ];

  const azar = (a, b) => a + Math.random() * (b - a);

  function semilla(s) {
    return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
  }

  function mezcla(a, b, k) {
    return `rgb(${Math.round(a[0] + (b[0] - a[0]) * k)},${Math.round(a[1] + (b[1] - a[1]) * k)},${Math.round(a[2] + (b[2] - a[2]) * k)})`;
  }

  // ---------- Paisaje (se dibuja una sola vez) ----------

  function cresta(rnd, y0, amp, rug) {
    const n = 257, p = new Array(n);
    p[0] = rnd(); p[n - 1] = rnd();
    let paso = n - 1, escala = 1;
    while (paso > 1) {
      const m = paso / 2;
      for (let i = m; i < n; i += paso) {
        p[i] = (p[i - m] + p[i + m]) / 2 + (rnd() - 0.5) * escala;
      }
      escala *= rug;
      paso = m;
    }
    return p.map(v => Math.min(orilla, y0 - v * amp));
  }

  function pino(c, x, base, h, rnd) {
    const ancho = h * (0.2 + rnd() * 0.08);
    const niveles = 9 + Math.floor(rnd() * 5);
    const cima = base - h;
    const der = [], izq = [];
    for (let k = 1; k <= niveles; k++) {
      const f = k / niveles;
      const y = cima + h * 0.92 * f;
      const w1 = ancho * Math.pow(f, 0.85) * (0.75 + rnd() * 0.5);
      const w2 = ancho * Math.pow(f, 0.85) * (0.75 + rnd() * 0.5);
      der.push([x + w1, y], [x + w1 * 0.35, y + h * 0.025]);
      izq.push([x - w2, y], [x - w2 * 0.35, y + h * 0.025]);
    }
    c.moveTo(x, cima);
    for (const p of der) c.lineTo(p[0], p[1]);
    c.lineTo(x + ancho * 0.05, base);
    c.lineTo(x - ancho * 0.05, base);
    for (let i = izq.length - 1; i >= 0; i--) c.lineTo(izq[i][0], izq[i][1]);
    c.closePath();
  }

  function dibujarFondo() {
    const rnd = semilla(7);
    const c = fctx;
    const bruma = [132, 143, 150];
    const bosque = [18, 27, 24];

    c.setTransform(DPR, 0, 0, DPR, 0, 0);
    c.clearRect(0, 0, W, H);

    // Cielo nublado
    const cielo = c.createLinearGradient(0, 0, 0, orilla);
    cielo.addColorStop(0, '#20282f');
    cielo.addColorStop(0.55, '#525e67');
    cielo.addColorStop(1, '#8a959b');
    c.fillStyle = cielo;
    c.fillRect(0, 0, W, orilla + 2);

    // Nubes suaves
    for (let i = 0; i < 45; i++) {
      const x = rnd() * W, y = rnd() * orilla * 0.6;
      const rx = W * (0.08 + rnd() * 0.2), ry = rx * (0.25 + rnd() * 0.2);
      const oscura = rnd() > 0.3;
      const g = c.createRadialGradient(0, 0, 0, 0, 0, rx);
      g.addColorStop(0, oscura ? 'rgba(16,22,28,.35)' : 'rgba(160,170,176,.2)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      c.save();
      c.translate(x, y);
      c.scale(1, ry / rx);
      c.fillStyle = g;
      c.beginPath(); c.arc(0, 0, rx, 0, Math.PI * 2); c.fill();
      c.restore();
    }

    // Montañas con perspectiva atmosférica
    const montes = [
      { y: orilla - H * 0.10, amp: H * 0.2, rug: 0.55, k: 0.72 },
      { y: orilla - H * 0.04, amp: H * 0.13, rug: 0.6, k: 0.55 }
    ];
    for (const m of montes) {
      const p = cresta(rnd, m.y, m.amp, m.rug);
      c.fillStyle = mezcla([40, 52, 56], bruma, m.k);
      c.beginPath();
      c.moveTo(0, orilla + 1);
      p.forEach((y, i) => c.lineTo(i / (p.length - 1) * W, y));
      c.lineTo(W, orilla + 1);
      c.closePath();
      c.fill();
    }

    // Bosque de pinos en 4 profundidades
    const bosques = [
      { base: orilla - H * 0.045, alto: H * 0.07, k: 0.6 },
      { base: orilla - H * 0.025, alto: H * 0.1, k: 0.45 },
      { base: orilla - H * 0.01, alto: H * 0.14, k: 0.28 },
      { base: orilla + 2, alto: H * 0.21, k: 0.1 }
    ];
    for (const b of bosques) {
      const n = c.createLinearGradient(0, b.base - b.alto * 1.2, 0, b.base);
      n.addColorStop(0, 'rgba(132,143,150,0)');
      n.addColorStop(1, 'rgba(132,143,150,.35)');
      c.fillStyle = n;
      c.fillRect(0, b.base - b.alto * 1.2, W, b.alto * 1.2);

      c.fillStyle = mezcla(bosque, bruma, b.k);
      c.beginPath();
      let x = -30;
      while (x < W + 30) {
        const h = b.alto * (0.6 + rnd() * 0.7);
        pino(c, x, b.base + rnd() * H * 0.006, h, rnd);
        x += h * (0.12 + rnd() * 0.22);
      }
      c.rect(0, b.base - 2, W, Math.max(4, orilla - b.base + 4));
      c.fill();
    }

    // Reflejo en el lago
    const refH = H - orilla;
    c.save();
    c.filter = 'blur(1.5px)';
    c.translate(0, orilla * 2);
    c.scale(1, -1);
    c.globalAlpha = 0.85;
    c.drawImage(fondo, 0, (orilla - refH) * DPR, W * DPR, refH * DPR, 0, orilla - refH, W, refH);
    c.restore();

    const agua = c.createLinearGradient(0, orilla, 0, H);
    agua.addColorStop(0, 'rgba(70,82,90,.35)');
    agua.addColorStop(1, 'rgba(8,12,16,.88)');
    c.fillStyle = agua;
    c.fillRect(0, orilla, W, refH);
    c.fillStyle = 'rgba(10,14,13,.9)';
    c.fillRect(0, orilla - 1, W, 2.5);

    // Juncos en primer plano
    c.strokeStyle = 'rgba(7,10,9,.95)';
    c.lineCap = 'round';
    for (let i = 0; i < 80; i++) {
      const x = rnd() < 0.5 ? rnd() * W * 0.16 : W - rnd() * W * 0.16;
      const alto = H * (0.07 + rnd() * 0.2);
      const curva = (rnd() - 0.5) * alto * 0.5;
      c.lineWidth = 1 + rnd() * 2.5;
      c.beginPath();
      c.moveTo(x, H + 5);
      c.quadraticCurveTo(x + curva * 0.3, H - alto * 0.6, x + curva, H - alto);
      c.stroke();
    }
  }

  // ---------- Lluvia ----------

  function nuevaGota(g, inicial) {
    const z = Math.pow(Math.random(), 1.6); // más gotas lejanas que cercanas
    g.z = z;
    g.capa = Math.min(CAPAS - 1, Math.floor(z * CAPAS));
    g.vy = H * (0.75 + 1.7 * z) * azar(0.92, 1.08);
    g.suelo = orilla + (H - orilla) * (0.02 + 0.98 * Math.pow(z, 1.2)) + azar(-4, 4);
    g.x = azar(-W * 0.25, W * 1.05);
    g.y = inicial ? azar(-H * 0.2, g.suelo) : azar(-H * 0.25, -20);
  }

  function choqueAgua(g, vx) {
    if (ondas.length < 700) {
      ondas.push({ x: g.x, y: g.suelo, z: g.z, edad: 0, vida: azar(0.5, 0.9), max: 2 + 26 * Math.pow(g.z, 1.6) });
    }
    if (g.z > 0.6 && gotitas.length < 1500) {
      const n = 1 + (Math.random() * 3 | 0);
      for (let i = 0; i < n; i++) {
        gotitas.push({
          x: g.x, y: g.suelo,
          vx: (azar(-60, 60) * g.z + vx * 0.1) * E,
          vy: -azar(60, 190) * g.z * E,
          piso: g.suelo, onda: false, z: g.z
        });
      }
    }
  }

  function choqueObjeto(g, dx, dy, d, vx) {
    const nx = dx / d, ny = dy / d;
    const tx = -ny, ty = nx;
    const px = raton.x + nx * raton.r, py = raton.y + ny * raton.r;
    if (gotitas.length > 1500) return;
    const n = 2 + (Math.random() * 4 | 0);
    for (let i = 0; i < n; i++) {
      const s = azar(-1, 1);
      gotitas.push({
        x: px, y: py,
        vx: (nx * azar(40, 140) * g.z + tx * s * azar(40, 160) + vx * 0.2) * E,
        vy: (ny * azar(40, 140) * g.z + ty * s * azar(40, 160) - azar(0, 60)) * E,
        piso: g.suelo, onda: true, z: g.z
      });
    }
    // Agua que escurre y gotea por la parte de abajo
    if (Math.random() < 0.07) {
      gotitas.push({
        x: raton.x + azar(-0.25, 0.25) * raton.r, y: raton.y + raton.r,
        vx: vx * 0.05, vy: 20, piso: g.suelo, onda: true, z: g.z
      });
    }
  }

  function dibujarOndas(dt) {
    for (let i = ondas.length - 1; i >= 0; i--) {
      const o = ondas[i];
      o.edad += dt;
      const p = o.edad / o.vida;
      if (p >= 1) { ondas[i] = ondas[ondas.length - 1]; ondas.pop(); continue; }
      const r = o.max * (0.15 + 0.85 * Math.sqrt(p));
      const a = (1 - p) * (0.15 + 0.4 * o.z);
      const achat = 0.22 + 0.12 * o.z;
      ctx.strokeStyle = `rgba(200,212,220,${a})`;
      ctx.lineWidth = 0.5 + o.z;
      ctx.beginPath();
      ctx.ellipse(o.x, o.y, r, r * achat, 0, 0, Math.PI * 2);
      ctx.stroke();
      if (o.z > 0.5 && p < 0.6) {
        ctx.beginPath();
        ctx.ellipse(o.x, o.y, r * 0.55, r * 0.55 * achat, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }

  function dibujarGotitas(dt) {
    const ruta = new Path2D();
    const grav = 1500 * E;
    for (let i = gotitas.length - 1; i >= 0; i--) {
      const p = gotitas[i];
      p.vy += grav * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.y > p.piso || p.y > H + 10) {
        if (p.onda && p.y <= H + 10 && ondas.length < 700) {
          ondas.push({ x: p.x, y: p.piso, z: p.z * 0.7, edad: 0, vida: 0.5, max: 2 + 8 * p.z });
        }
        gotitas[i] = gotitas[gotitas.length - 1];
        gotitas.pop();
        continue;
      }
      ruta.moveTo(p.x, p.y);
      ruta.lineTo(p.x - p.vx * 0.012, p.y - p.vy * 0.012);
    }
    ctx.strokeStyle = 'rgba(215,224,230,.6)';
    ctx.lineWidth = 1.4;
    ctx.stroke(ruta);
  }

  function dibujarObjeto() {
    if (!raton.activo) return;
    const { x, y, r } = raton;
    const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.05, x, y, r);
    g.addColorStop(0, 'rgba(255,255,255,.22)');
    g.addColorStop(0.35, 'rgba(200,215,225,.06)');
    g.addColorStop(0.85, 'rgba(160,180,195,.05)');
    g.addColorStop(1, 'rgba(220,232,240,.25)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  function trazar(ruta, i) {
    const e = estiloCapa[i];
    ctx.strokeStyle = `rgba(210,220,228,${e.alfa})`;
    ctx.lineWidth = e.ancho;
    ctx.stroke(ruta);
  }

  function cuadro(ahora) {
    const dt = Math.min((ahora - ultimo) / 1000, 0.05);
    ultimo = ahora;
    t += dt;

    // Viento con ráfagas suaves e irregulares
    const viento = H * (0.07 + 0.05 * Math.sin(t * 0.31) + 0.025 * Math.sin(t * 0.87 + 1.3));

    ctx.clearRect(0, 0, W, H);
    dibujarOndas(dt);

    const rutas = [];
    for (let i = 0; i < CAPAS; i++) rutas.push(new Path2D());
    const R2 = raton.r * raton.r;
    const k = 0.028; // desenfoque de movimiento

    for (const g of gotas) {
      const vx = viento * (0.35 + g.z);
      g.x += vx * dt;
      g.y += g.vy * dt;

      // Solo las gotas cercanas chocan; las lejanas pasan por detrás
      if (raton.activo && g.capa >= 2) {
        const dx = g.x - raton.x, dy = g.y - raton.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < R2) {
          choqueObjeto(g, dx, dy, Math.sqrt(d2) || 1, vx);
          nuevaGota(g, false);
          continue;
        }
      }

      if (g.y >= g.suelo) {
        choqueAgua(g, vx);
        nuevaGota(g, false);
        continue;
      }

      if (g.x > W + 80) g.x -= W + 160;
      else if (g.x < -W * 0.3) g.x += W * 1.3;

      rutas[g.capa].moveTo(g.x - vx * k, g.y - g.vy * k);
      rutas[g.capa].lineTo(g.x, g.y);
    }

    trazar(rutas[0], 0);
    trazar(rutas[1], 1);
    dibujarObjeto();
    trazar(rutas[2], 2);
    trazar(rutas[3], 3);
    dibujarGotitas(dt);

    requestAnimationFrame(cuadro);
  }

  // ---------- Tamaño de pantalla ----------

  function ajustar() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    E = H / 900;
    orilla = Math.round(H * 0.66);
    for (const cv of [fondo, lienzo]) {
      cv.width = W * DPR;
      cv.height = H * DPR;
    }
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.lineCap = 'round';
    raton.r = Math.max(38, Math.min(W, H) * 0.065);
    dibujarFondo();

    const n = Math.min(1700, Math.round(W * H / 1200));
    gotas = Array.from({ length: n }, () => { const g = {}; nuevaGota(g, true); return g; });
    ondas = [];
    gotitas = [];
  }

  let espera;
  window.addEventListener('resize', () => {
    clearTimeout(espera);
    espera = setTimeout(ajustar, 150);
  });

  // ---------- Mouse y pantalla táctil ----------

  function mover(e) {
    raton.x = e.clientX;
    raton.y = e.clientY;
    raton.activo = true;
  }
  window.addEventListener('pointermove', mover);
  window.addEventListener('pointerdown', mover);
  window.addEventListener('pointerup', e => { if (e.pointerType !== 'mouse') raton.activo = false; });
  window.addEventListener('mouseout', e => { if (!e.relatedTarget) raton.activo = false; });

  // ---------- Sonido de lluvia generado ----------

  function crearSonido() {
    const ac = new (window.AudioContext || window.webkitAudioContext)();
    const len = ac.sampleRate * 6;
    const F = 4000;
    const buf = ac.createBuffer(2, len, ac.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      let marron = 0;
      for (let i = 0; i < len; i++) {
        const b = Math.random() * 2 - 1;
        marron = (marron + 0.02 * b) / 1.02;
        d[i] = b * 0.25 + marron * 2.5;
        if (Math.random() < 0.0006) d[i] += (Math.random() * 2 - 1) * 0.5;
      }
      // Fundido para que el bucle no se note
      for (let i = 0; i < F; i++) {
        const a = i / F;
        d[i] = d[i] * a + d[len - F + i] * (1 - a);
      }
    }
    const src = ac.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    src.loopEnd = (len - F) / ac.sampleRate;

    const hp = ac.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 120;
    const lp = ac.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 4500;
    const vol = ac.createGain();
    vol.gain.setValueAtTime(0, ac.currentTime);
    vol.gain.linearRampToValueAtTime(0.45, ac.currentTime + 2);

    src.connect(hp);
    hp.connect(lp);
    lp.connect(vol);
    vol.connect(ac.destination);
    src.start();
    return ac;
  }

  const boton = document.getElementById('sonido');
  let audio = null;
  boton.addEventListener('click', e => {
    e.stopPropagation();
    if (!audio) {
      audio = crearSonido();
      boton.textContent = 'Silenciar';
    } else if (audio.state === 'running') {
      audio.suspend();
      boton.textContent = 'Activar sonido';
    } else {
      audio.resume();
      boton.textContent = 'Silenciar';
    }
  });

  ajustar();
  requestAnimationFrame(cuadro);
})();