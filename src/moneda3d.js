'use strict';
/* La moneda: un solo canvas WebGL (Three.js r128) que se reubica. Si WebGL falla, moneda CSS 3D. */
var Moneda = (function () {
  var TAU = Math.PI * 2;
  var W = 0, H = 0, canvas = null, rend = null, usaGL = false, listo = false;
  var de = 'USD', a = 'COP', tinte = { h: 34, s: 62, l: 52 };
  var sp = {
    x: new Resorte(0, { k: 130, c: 17, eps: 0.05, epsV: 0.5 }),
    y: new Resorte(0, { k: 130, c: 17, eps: 0.05, epsV: 0.5 }),
    d: new Resorte(104, { k: 130, c: 17, eps: 0.05, epsV: 0.5 }),
    rx: new Resorte(0, { k: 150, c: 13 }),
    ry: new Resorte(0, { k: 85, c: 10.5 }),
    rz: new Resorte(0, { k: 260, c: 9 })
  };
  var modo = 'slot', volandoFin = null, finPos = null, vgiro = 0, vbase = 0, flotando = false, arrastrando = false, oculta = false;
  var slotFn = null, extra = { dy: 0, rx: 0 }, ultimoT = 0;
  var onFrame = null;

  /* ---------- dibujo de las caras (canvas 2D) ---------- */
  function arco(c, txt, cx, cy, r, size, ls, arriba) {
    c.save(); c.translate(cx, cy);
    var ws = [], tot = 0, i;
    for (i = 0; i < txt.length; i++) { var w = c.measureText(txt[i]).width + ls; ws.push(w); tot += w; }
    var ang = tot / r, ini = (arriba ? -Math.PI / 2 - ang / 2 : Math.PI / 2 + ang / 2), pos = 0;
    for (i = 0; i < txt.length; i++) {
      var th = (arriba ? ini + (pos + ws[i] / 2) / r : ini - (pos + ws[i] / 2) / r);
      c.save(); c.rotate(th + (arriba ? Math.PI / 2 : -Math.PI / 2)); c.translate(0, arriba ? -r : r); c.fillText(txt[i], 0, 0); c.restore();
      pos += ws[i];
    }
    c.restore();
  }
  function dibujarCara(cv, bp, cod) {
    var S = cv.width, R = S / 2, k = S / 640, c = cv.getContext('2d'), b = bp.getContext('2d'), I = INFO[cod], i;
    var g = c.createRadialGradient(R * 0.7, R * 0.6, R * 0.05, R, R, R * 1.05);
    g.addColorStop(0, '#f4ecd9'); g.addColorStop(0.5, '#d6c9ad'); g.addColorStop(1, '#9d937d');
    c.fillStyle = g; c.fillRect(0, 0, S, S);
    c.fillStyle = 'hsla(' + I.h + ',' + I.s + '%,' + I.l + '%,.09)'; c.fillRect(0, 0, S, S);
    for (var r = 6 * k; r < R; r += 3 * k) { c.strokeStyle = (Math.round(r / (3 * k)) % 2) ? 'rgba(255,255,255,.055)' : 'rgba(0,0,0,.05)'; c.lineWidth = 1.5 * k; c.beginPath(); c.arc(R, R, r, 0, TAU); c.stroke(); }
    b.fillStyle = '#808080'; b.fillRect(0, 0, S, S);
    // surco y cuentas
    c.lineWidth = 5 * k; c.strokeStyle = 'rgba(70,58,38,.55)'; c.beginPath(); c.arc(R, R, R * 0.905, 0, TAU); c.stroke();
    c.lineWidth = 2.5 * k; c.strokeStyle = 'rgba(255,255,255,.4)'; c.beginPath(); c.arc(R, R, R * 0.905 + 4 * k, 0, TAU); c.stroke();
    b.lineWidth = 9 * k; b.strokeStyle = '#2a2a2a'; b.beginPath(); b.arc(R, R, R * 0.905, 0, TAU); b.stroke();
    for (i = 0; i < 84; i++) {
      var an = i / 84 * TAU, px = R + Math.cos(an) * R * 0.845, py = R + Math.sin(an) * R * 0.845;
      c.fillStyle = 'rgba(70,58,38,.5)'; c.beginPath(); c.arc(px, py, 4.4 * k, 0, TAU); c.fill();
      c.fillStyle = 'rgba(255,255,255,.5)'; c.beginPath(); c.arc(px - 1 * k, py - 1.2 * k, 2 * k, 0, TAU); c.fill();
      b.fillStyle = '#d8d8d8'; b.beginPath(); b.arc(px, py, 5 * k, 0, TAU); b.fill();
    }
    // texto en arco
    var fam = '"Geist", system-ui, -apple-system, "Helvetica Neue", sans-serif';
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.font = '600 ' + 27 * k + 'px ' + fam; c.fillStyle = 'rgba(58,48,32,.82)';
    arco(c, I.pais, R, R, R * 0.72, 27 * k, 5 * k, true);
    b.font = c.font; b.textAlign = 'center'; b.textBaseline = 'middle'; b.fillStyle = '#cfcfcf'; arco(b, I.pais, R, R, R * 0.72, 27 * k, 5 * k, true);
    c.fillStyle = 'rgba(58,48,32,.82)'; arco(c, I.n.toUpperCase(), R, R, R * 0.7, 27 * k, 4 * k, false);
    b.fillStyle = '#cfcfcf'; arco(b, I.n.toUpperCase(), R, R, R * 0.7, 27 * k, 4 * k, false);
    // símbolo grande
    var sym = SIMBOLO_MONEDA[cod], len = sym.length, sz = (len <= 1 ? 330 : len === 2 ? 250 : 190) * k;
    c.font = '700 ' + sz + 'px ' + fam; b.font = c.font;
    var yy = R - 12 * k;
    c.fillStyle = 'rgba(255,255,255,.55)'; c.fillText(sym, R + 4 * k, yy + 5 * k);
    var gs = c.createLinearGradient(0, R - sz / 2, 0, R + sz / 2); gs.addColorStop(0, '#5a5039'); gs.addColorStop(1, '#2f2a1e');
    c.fillStyle = gs; c.fillText(sym, R, yy);
    b.fillStyle = '#ffffff'; b.fillText(sym, R, yy);
    // código
    c.font = '600 ' + 50 * k + 'px ' + fam; b.font = c.font;
    var cod3 = cod.split('').join(' ');
    c.fillStyle = 'rgba(255,255,255,.5)'; c.fillText(cod3, R + 2 * k, R + R * 0.455 + 3 * k);
    c.fillStyle = 'rgba(52,44,30,.9)'; c.fillText(cod3, R, R + R * 0.455);
    b.fillStyle = '#e6e6e6'; b.fillText(cod3, R, R + R * 0.455);
  }

  /* ---------- renderer WebGL ---------- */
  function crearGL(cv) {
    var T = window.THREE; if (!T) return null;
    var r;
    try { r = new T.WebGLRenderer({ canvas: cv, alpha: true, antialias: true, powerPreference: 'low-power' }); } catch (e) { return null; }
    if (!r || !r.getContext()) return null;
    r.setClearColor(0x000000, 0); r.outputEncoding = T.sRGBEncoding;
    r.toneMapping = T.ACESFilmicToneMapping; r.toneMappingExposure = 1.38;
    var scene = new T.Scene(), cam = new T.PerspectiveCamera(18, 1, 10, 6000);
    // entorno procedural (cajas de luz) para los reflejos del metal
    var ev = document.createElement('canvas'); ev.width = 1024; ev.height = 512; var e = ev.getContext('2d');
    var bg = e.createLinearGradient(0, 0, 0, 512); bg.addColorStop(0, '#2a303b'); bg.addColorStop(0.5, '#10141b'); bg.addColorStop(1, '#07090d');
    e.fillStyle = bg; e.fillRect(0, 0, 1024, 512);
    function caja(x, y, w, h, col, blur) { e.save(); e.filter = 'blur(' + blur + 'px)'; e.fillStyle = col; e.fillRect(x, y, w, h); e.restore(); }
    caja(560, 90, 400, 340, 'rgba(240,233,220,.85)', 28);
    caja(560, 40, 40, 440, 'rgba(255,255,255,.95)', 6);
    caja(940, 40, 40, 440, 'rgba(255,248,235,.9)', 6);
    caja(120, 70, 260, 70, 'rgba(190,205,230,.7)', 16);
    caja(300, 330, 420, 40, 'rgba(255,255,255,.35)', 12);
    var envTex = new T.CanvasTexture(ev); envTex.mapping = T.EquirectangularReflectionMapping; envTex.encoding = T.sRGBEncoding;
    var pm = new T.PMREMGenerator(r); scene.environment = pm.fromEquirectangular(envTex).texture; pm.dispose();
    var key = new T.DirectionalLight(0xffffff, 0.8); key.position.set(-1.2, 1.6, 2.2); scene.add(key);
    scene.add(new T.AmbientLight(0xffffff, 0.22));

    function lienzo(n) { var c = document.createElement('canvas'); c.width = c.height = n; return c; }
    var N = 640, cvs = { f: lienzo(N), fb: lienzo(N), k: lienzo(N), kb: lienzo(N) };
    function tex(c, srgb) { var t = new T.CanvasTexture(c); if (srgb) t.encoding = T.sRGBEncoding; t.anisotropy = Math.min(8, r.capabilities.getMaxAnisotropy()); return t; }
    var tF = tex(cvs.f, true), tK = tex(cvs.k, true), bF = tex(cvs.fb, false), bK = tex(cvs.kb, false);
    var matF = new T.MeshStandardMaterial({ map: tF, bumpMap: bF, bumpScale: 2.2, metalness: 0.82, roughness: 0.3 });
    var matK = new T.MeshStandardMaterial({ map: tK, bumpMap: bK, bumpScale: 2.2, metalness: 0.82, roughness: 0.3 });
    // canto estriado
    var rc = document.createElement('canvas'); rc.width = 16; rc.height = 32; var rg = rc.getContext('2d');
    rg.fillStyle = '#111'; rg.fillRect(0, 0, 16, 32); rg.fillStyle = '#eee'; rg.fillRect(0, 0, 8, 32);
    var reed = new T.CanvasTexture(rc); reed.wrapS = T.RepeatWrapping; reed.repeat.set(110, 1);
    var matE = new T.MeshStandardMaterial({ color: 0xcdbfa3, metalness: 1, roughness: 0.38, bumpMap: reed, bumpScale: 1.4 });
    var matR = new T.MeshStandardMaterial({ color: 0xd9ccb2, metalness: 1, roughness: 0.24 });
    var grupo = new T.Group();
    var edge = new T.Mesh(new T.CylinderGeometry(0.995, 0.995, 0.1, 128, 1, true), matE); edge.rotation.x = Math.PI / 2; grupo.add(edge);
    var circ = new T.CircleGeometry(0.93, 96);
    var cara1 = new T.Mesh(circ, matF); cara1.position.z = 0.07; grupo.add(cara1);
    var cara2 = new T.Mesh(circ, matK); cara2.position.z = -0.07; cara2.rotation.y = Math.PI; grupo.add(cara2);
    var tor = new T.TorusGeometry(0.955, 0.042, 18, 160);
    var r1 = new T.Mesh(tor, matR); r1.position.z = 0.05; grupo.add(r1);
    var r2 = new T.Mesh(tor, matR); r2.position.z = -0.05; grupo.add(r2);
    scene.add(grupo);

    var tmp = new T.Color();
    return {
      gl: true,
      resize: function (w, h, dpr) {
        r.setPixelRatio(dpr); r.setSize(w, h, false);
        cam.aspect = w / h; cam.position.z = (h / 2) / Math.tan(cam.fov * Math.PI / 360);
        cam.far = cam.position.z + 3000; cam.updateProjectionMatrix();
      },
      caras: function (d1, d2) {
        dibujarCara(cvs.f, cvs.fb, d1); dibujarCara(cvs.k, cvs.kb, d2);
        tF.needsUpdate = tK.needsUpdate = bF.needsUpdate = bK.needsUpdate = true;
      },
      tinte: function (t) {
        tmp.setHSL(t.h / 360, 0.2 + t.s / 400, 0.72); matE.color.copy(tmp); matR.color.setHSL(t.h / 360, 0.12 + t.s / 600, 0.8);
        matF.color.setHSL(t.h / 360, 0.12, 0.95); matK.color.setHSL(t.h / 360, 0.12, 0.95);
      },
      pintar: function (o) {
        grupo.position.set(o.x - W / 2, H / 2 - o.y, 0);
        grupo.scale.setScalar(o.d / 2);
        grupo.rotation.set(o.rx, o.ry, o.rz);
        key.position.set(-1.2 + Math.sin(o.ry) * 0.6, 1.6, 2.2);
        r.render(scene, cam);
      },
      limpiar: function () { r.clear(); }
    };
  }

  /* ---------- renderer CSS (respaldo) ---------- */
  function crearCSS() {
    var el = document.createElement('div'); el.className = 'mcss'; el.setAttribute('aria-hidden', 'true');
    var h = '<div class="mc">';
    for (var i = -3; i <= 3; i++) h += '<div class="mce" style="transform:translateZ(' + (i * 1.6) + 'px)"></div>';
    h += '<div class="mcf mcfr"><span class="s"></span><span class="c"></span></div><div class="mcf mcbk"><span class="s"></span><span class="c"></span></div></div>';
    el.innerHTML = h; document.body.appendChild(el);
    var mc = el.firstChild, fr = $('.mcfr', el), bk = $('.mcbk', el);
    fr.style.transform = 'translateZ(5px)'; bk.style.transform = 'rotateY(180deg) translateZ(5px)';
    return {
      gl: false, el: el,
      resize: function () { }, limpiar: function () { },
      caras: function (d1, d2) {
        $('.s', fr).textContent = SIMBOLO_MONEDA[d1]; $('.c', fr).textContent = d1;
        $('.s', bk).textContent = SIMBOLO_MONEDA[d2]; $('.c', bk).textContent = d2;
      },
      tinte: function (t) { el.style.setProperty('--mh', t.h); el.style.setProperty('--ms', t.s + '%'); },
      pintar: function (o) {
        el.style.display = oculta ? 'none' : 'block';
        mc.style.transform = 'rotateX(' + (-o.rx) + 'rad) rotateY(' + o.ry + 'rad) rotateZ(' + (-o.rz) + 'rad)';
        el.style.transform = 'translate3d(' + (o.x - 100) + 'px,' + (o.y - 100) + 'px,0) scale(' + (o.d / 200) + ')';
      }
    };
  }

  /* ---------- bucle ---------- */
  function pintar() {
    if (!rend) return;
    if (oculta) { rend.limpiar(); if (!usaGL) rend.pintar({ x: 0, y: 0, d: 1, rx: 0, ry: 0, rz: 0 }); return; }
    rend.pintar({ x: sp.x.v, y: sp.y.v + extra.dy, d: sp.d.v, rx: sp.rx.v + extra.rx, ry: sp.ry.v, rz: sp.rz.v });
  }
  function paso(dt, t) {
    ultimoT = t;
    var k, todos = [sp.x, sp.y, sp.d, sp.rx, sp.ry, sp.rz];
    for (k = 0; k < todos.length; k++) todos[k].paso(dt);
    if (!arrastrando) {
      if (vgiro !== 0 || vbase) {
        sp.ry.v += (vgiro + vbase) * dt; sp.ry.t += (vgiro + vbase) * dt;
        vgiro *= Math.pow(0.12, dt); if (Math.abs(vgiro) < 0.05) vgiro = 0;
      }
    }
    if (flotando) { extra.dy = Math.sin(t * 1.7) * sp.d.v * 0.028; extra.rx = Math.sin(t * 1.15) * 0.16; }
    else { extra.dy *= 0.85; extra.rx *= 0.85; if (Math.abs(extra.dy) < 0.05) extra.dy = 0; if (Math.abs(extra.rx) < 0.002) extra.rx = 0; }
    pintar();
    if (finPos && Math.abs(sp.x.v - sp.x.t) < 2 && Math.abs(sp.y.v - sp.y.t) < 2 && Math.abs(sp.d.v - sp.d.t) < 1.5) { var fp = finPos; finPos = null; setTimeout(fp, 0); }
    if (onFrame) onFrame(sp.x.v, sp.y.v + extra.dy, sp.d.v, dt);
    var quieto = todos.every(function (r) { return r.quieto(); });
    if (quieto && !flotando && !arrastrando && vgiro === 0 && !vbase) {
      if (Math.abs(sp.ry.v) > TAU * 1.5) { var m = Math.round(sp.ry.v / TAU) * TAU; sp.ry.v -= m; sp.ry.t -= m; pintar(); }
      if (volandoFin) { var ff = volandoFin; volandoFin = null; setTimeout(ff, 0); }
      return false;
    }
    return true;
  }
  function despertar() { if (listo) Motor.add(paso); }

  function medir() {
    W = innerWidth; H = innerHeight;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (canvas) { canvas.style.width = W + 'px'; canvas.style.height = H + 'px'; }
    if (rend) rend.resize(W, H, dpr);
  }

  var api = {
    iniciar: function (o) {
      canvas = o.canvas; slotFn = o.slot; medir();
      var forzarCSS = /[?&]css=1/.test(location.search);
      rend = forzarCSS ? null : crearGL(canvas);
      if (!rend) { rend = crearCSS(); canvas.style.display = 'none'; }
      usaGL = rend.gl; listo = true; medir();
      rend.caras(de, a); rend.tinte(tinte);
      addEventListener('resize', function () { medir(); api.sincronizar(true); despertar(); });
      addEventListener('scroll', function () { api.sincronizar(false); }, { passive: true });
      return usaGL;
    },
    usaGL: function () { return usaGL; },
    caras: function (d1, d2) { de = d1; a = d2; if (rend) rend.caras(d1, d2); pintar(); despertar(); },
    tinte: function (h, s, l) { tinte.h = h; tinte.s = s; tinte.l = l; if (rend) { rend.tinte(tinte); } if (!Motor.activo()) pintar(); },
    pos: function () { return { x: sp.x.v, y: sp.y.v, d: sp.d.v }; },
    ir: function (x, y, d, o) {
      o = o || {};
      [['x', x], ['y', y], ['d', d]].forEach(function (p) {
        sp[p[0]].k = o.k || 130; sp[p[0]].c = o.c || 17; sp[p[0]].ir(p[1], o.snap);
      });
      if (o.fin) finPos = o.fin;
      despertar();
    },
    modo: function (m) { modo = m; },
    alSlot: function (o) {
      modo = 'slot';
      var s = slotFn(); api.ir(s.x, s.y, s.d, o);
    },
    sincronizar: function (forzar) {
      if (modo !== 'slot' || !listo) return;
      if (!forzar && (sp.x.t !== sp.x.v || Math.abs(sp.d.v - sp.d.t) > 0.5 || arrastrando)) { var s0 = slotFn(); sp.x.t = s0.x; sp.y.t = s0.y; sp.d.t = s0.d; return; }
      var s = slotFn(); sp.x.v = sp.x.t = s.x; sp.y.v = sp.y.t = s.y; sp.d.v = sp.d.t = s.d;
      pintar();
    },
    voltear: function (alTerminar) {
      sp.ry.t += Math.PI; sp.ry.k = 85; sp.ry.c = 10.5;
      volandoFin = function () {
        var m = Math.round(sp.ry.v / TAU) * TAU; var impar = Math.abs(sp.ry.v - m) > 1;
        sp.ry.v = sp.ry.t = 0; sp.ry.vel = 0;
        if (alTerminar) alTerminar(impar); pintar();
      };
      despertar();
    },
    girarRapido: function (vueltas) { sp.ry.k = 40; sp.ry.c = 7.5; sp.ry.t += TAU * (vueltas || 2); despertar(); },
    inclinar: function (rx) { sp.rx.v = rx; sp.rx.t = 0; sp.rx.vel = 0; despertar(); },
    asentar: function () { sp.ry.k = 40; sp.ry.c = 8; sp.ry.t = Math.round(sp.ry.v / TAU) * TAU; despertar(); },
    impulso: function (v) { vgiro = Math.min(vgiro + v, 14); despertar(); },
    giroBase: function (v) { vbase = v; despertar(); },
    flotar: function (si) { flotando = !!si; despertar(); },
    temblar: function () { sp.rz.v = 0.22; sp.rz.vel = -4; sp.rz.t = 0; despertar(); },
    oculta: function (si) { oculta = !!si; pintar(); },
    zona: function (z) { if (canvas) canvas.style.zIndex = z; if (rend && rend.el) rend.el.style.zIndex = z; },
    pedir: function () { pintar(); },
    onFrame: function (fn) { onFrame = fn; },
    enReposo: function () { return !flotando && !vbase; },
    sinMov: function (si) { /* hook para pruebas */ },
    /* arrastre con el dedo: gira con inercia y vuelve al frente */
    arrastre: {
      inicio: function () { arrastrando = true; vgiro = 0; sp.ry.vel = 0; sp.ry.t = sp.ry.v; despertar(); },
      mover: function (dRad) { sp.ry.v += dRad; sp.ry.t = sp.ry.v; despertar(); },
      fin: function (velRad) {
        arrastrando = false; sp.ry.k = 38; sp.ry.c = 6.5;
        sp.ry.vel = clamp(velRad, -26, 26);
        sp.ry.t = Math.round((sp.ry.v + sp.ry.vel * 0.32) / TAU) * TAU;
        despertar();
      }
    }
  };
  return api;
})();
