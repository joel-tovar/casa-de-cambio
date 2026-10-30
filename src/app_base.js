'use strict';
/* App · base: datos, estado, odómetro, ambiente, efectos, teclado, intercambio, selector. */

var DATOS = JSON.parse($('#datos').textContent);
var S = {
  de: 'USD', a: 'COP', expr: '100', com: 0, rango: '1M', voz: true,
  hipo: null, hipoTxt: '', pares: []
};
(function cargarPrefs() {
  S.com = +leer('com', 0) || 0; S.voz = leer('voz', true) !== false;
  S.rango = leer('rango', '1M');
  S.pares = (leer('pares', []) || []).filter(function (p) { return INFO[p.de] && INFO[p.a] && p.de !== p.a; }).slice(0, 5);
  if (S.pares.length) { S.de = S.pares[0].de; S.a = S.pares[0].a; }
})();

/* ---------- tasas ---------- */
function rate(c) { if (c === 'USD') return 1; var m = DATOS.monedas[c]; return m ? m.r : null; }
function tasaAB(A, B) { return rate(B) / rate(A); }
function serieUSD(c, k) { if (c === 'USD') return DATOS[k].t.map(function () { return 1; }); return DATOS[k].v[c] || null; }
function serieCruce(A, B, k) {
  var sa = serieUSD(A, k), sb = serieUSD(B, k); if (!sa || !sb) return null;
  return DATOS[k].t.map(function (_, i) { return (sa[i] != null && sb[i] != null) ? sb[i] / sa[i] : null; });
}
function msDia(s) { var p = s.split('-'); return Date.UTC(+p[0], +p[1] - 1, +p[2], 12); }
function msHora(s) { return Date.parse(s + ':00-05:00'); }
function cambioDia() {
  var v = serieCruce(S.de, S.a, 'm1'); if (!v) return null;
  var i = v.length - 1; while (i >= 0 && v[i] == null) i--;
  var j = i - 1; while (j >= 0 && v[j] == null) j--;
  if (j < 0) return null;
  return tasaAB(S.de, S.a) / v[j] - 1;
}
function hace(ts) {
  var s = Math.max(0, Date.now() / 1000 - ts), m = Math.round(s / 60);
  if (m < 1) return 'hace un momento'; if (m < 60) return 'hace ' + m + ' min';
  var h = Math.round(m / 60); if (h < 24) return 'hace ' + h + ' h';
  var d = Math.round(h / 24); return 'hace ' + d + (d === 1 ? ' día' : ' días');
}
function viejo() { return Date.now() / 1000 - DATOS.ts > 36 * 3600; }

/* ---------- expresión (teclado) ---------- */
var OPS = { '+': '+', '-': '−', '*': '×', '/': '÷' };
function evaluar(expr) {
  if (!expr) return 0;
  var toks = [], num = '', i, c;
  for (i = 0; i < expr.length; i++) {
    c = expr[i];
    if ('+-*/'.indexOf(c) >= 0) { if (num === '') { if (c === '-' && !toks.length) { num = '-'; continue; } return null; } toks.push(parseFloat(num.replace(',', '.'))); toks.push(c); num = ''; }
    else num += c;
  }
  if (num === '' || num === '-') { if (!toks.length) return 0; toks.pop(); } else toks.push(parseFloat(num.replace(',', '.')));
  // × ÷ primero
  var a = [toks[0]];
  for (i = 1; i < toks.length; i += 2) {
    var op = toks[i], b = toks[i + 1];
    if (op === '*') a[a.length - 1] *= b; else if (op === '/') a[a.length - 1] = b === 0 ? NaN : a[a.length - 1] / b; else { a.push(op); a.push(b); }
  }
  var r = a[0];
  for (i = 1; i < a.length; i += 2) r = a[i] === '+' ? r + a[i + 1] : r - a[i + 1];
  return isFinite(r) ? r : null;
}
function tieneOp(expr) { return /[0-9,][+\-*/]/.test(expr); }
function agrupar(n) { var p = n.split(','); var e = p[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.'); return p.length > 1 ? e + ',' + p[1] : e; }
function exprHTML(expr) {
  if (!expr) return '0';
  var out = '', num = '';
  for (var i = 0; i < expr.length; i++) {
    var c = expr[i];
    if ('+-*/'.indexOf(c) >= 0 && num !== '') { out += agrupar(num) + '<span class="op">' + OPS[c] + '</span>'; num = ''; }
    else if ('+-*/'.indexOf(c) >= 0) { out += '<span class="op">' + OPS[c] + '</span>'; }
    else num += c;
  }
  return out + (num !== '' ? agrupar(num) : '');
}
function numAExpr(n) { var s = (+n.toFixed(8)).toString(); if (/e/i.test(s)) s = n.toFixed(2); return s.replace('.', ','); }
function teclear(k) {
  var e = S.expr, ult = e.slice(-1), partes = e.split(/[+\-*/]/), cur = partes[partes.length - 1];
  if (/^\d$/.test(k)) {
    if (cur.replace(',', '').replace(/^-/, '').length >= 12) return;
    if (cur === '0') e = e.slice(0, -1) + k; else e += k;
  } else if (k === ',') {
    if (cur.indexOf(',') >= 0) return;
    e += (cur === '' ? '0,' : ',');
  } else if ('+-*/'.indexOf(k) >= 0) {
    if (e === '') { if (k === '-') e = '-'; else return; }
    else if ('+-*/'.indexOf(ult) >= 0) { if (e.length > 1) e = e.slice(0, -1) + k; }
    else e += k;
  } else if (k === 'back') { e = e.slice(0, -1); }
  else if (k === 'ac') { e = ''; }
  else if (k === '=') {
    var r = evaluar(e); if (r != null && tieneOp(e)) { e = r < 0 ? '' : numAExpr(r); }
  }
  S.expr = e; S.hipo = null; render(); tecleoVibra();
}
function tecleoVibra() { try { if (navigator.vibrate && (!navigator.userActivation || navigator.userActivation.hasBeenActive)) navigator.vibrate(6); } catch (e) { } }

/* ---------- odómetro ---------- */
function Odometro(el) { this.el = el; this.cols = []; this.mask = null; this.pend = []; this.vivo = false; }
Odometro.prototype.poner = function (str, inicial) {
  var self = this, mask = str.replace(/\d/g, '9');
  if (mask !== this.mask) {
    var viejas = this.cols.slice().reverse();  // por índice desde la derecha
    var nuevas = [], items = [], di = 0, i;
    for (i = str.length - 1; i >= 0; i--) {
      var ch = str[i];
      if (/\d/.test(ch)) {
        var col = viejas[di];
        if (!col) {
          var strip = document.createElement('i'), box = document.createElement('span');
          box.className = 'd';
          var h = '';
          [9, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0].forEach(function (n) { h += '<b>' + n + '</b>'; });
          strip.innerHTML = h; box.appendChild(strip);
          col = { el: box, strip: strip, spr: new Resorte(0, { k: 150, c: 19, eps: 0.002, epsV: 0.02 }), pend: null, dig: 0 };
        }
        nuevas.push(col); items.unshift({ col: col, ch: ch }); di++;
      } else {
        var sp = document.createElement('span'); sp.className = ch === '-' ? 'neg' : 's'; sp.textContent = ch;
        items.unshift({ el: sp });
      }
    }
    this.el.textContent = '';
    items.forEach(function (it) { self.el.appendChild(it.col ? it.col.el : it.el); });
    this.cols = nuevas.slice().reverse(); // cols[0] = el primero (izquierda)
    this.mask = mask;
  }
  // asignar valores
  var cs = this.cols, n = cs.length, d = 0;
  for (var j = 0; j < str.length; j++) {
    if (!/\d/.test(str[j])) continue;
    var c = cs[d++], dig = +str[j];
    var idxDerecha = n - d;
    if (c.dig !== dig || inicial) {
      c.dig = dig;
      if (inicial === 'cero') { c.spr.v = c.spr.t = 1; c.dig = 0; }
      else if (reducido() || inicial === 'snap') { c.spr.v = c.spr.t = dig + 1; c.vel = 0; c.pend = null; }
      else c.pend = { dig: dig, esp: Math.min(0.5, idxDerecha * 0.05) };
    }
    c.strip.style.transform = 'translate3d(0,' + (-c.spr.v * 1.14) + 'em,0)';
  }
  if (inicial === 'cero') { cs.forEach(function (c) { c.spr.v = c.spr.t = 1; c.strip.style.transform = 'translate3d(0,-1.14em,0)'; c.dig = 0; }); }
  this.ajustar();
  Motor.add(this.paso);
  Odometro.activo = this;
};
Odometro.prototype.ajustar = function () {
  var el = this.el, pw = el.parentElement.clientWidth; el.style.fontSize = ''; el.style.transform = 'none';
  var w = el.offsetWidth, fs = parseFloat(getComputedStyle(el).fontSize);
  if (w > pw && w > 0 && pw > 0) el.style.fontSize = (fs * pw / w * 0.985).toFixed(2) + 'px';
};
Odometro.prototype.paso = function (dt) {
  var o = Odometro.activo; if (!o) return false;
  var vivo = false;
  o.cols.forEach(function (c) {
    if (c.pend) { c.pend.esp -= dt; if (c.pend.esp <= 0) { c.spr.ir(c.pend.dig + 1); c.pend = null; } vivo = true; }
    if (!c.spr.quieto() || c.spr.v !== c.spr.t) { c.spr.paso(dt); c.strip.style.transform = 'translate3d(0,' + (-c.spr.v * 1.14) + 'em,0)'; vivo = true; }
  });
  return vivo;
};
var Odo = new Odometro($('#odo'));

/* ---------- ambiente (tinte que cambia con la moneda) ---------- */
var amb = { h1: 34, s1: 62, l1: 52, h2: 148, s2: 30, l2: 50 };
var ambObj = null;
function ambienteIr(snap) {
  var A = INFO[S.de], B = INFO[S.a];
  ambObj = { h1: A.h, s1: A.s, l1: A.l, h2: B.h, s2: B.s, l2: B.l };
  if (snap || reducido()) { for (var k in ambObj) amb[k] = ambObj[k]; ambienteAplicar(); return; }
  Motor.add(ambientePaso);
}
function ambientePaso(dt) {
  var f = 1 - Math.exp(-dt * 4.2), lis = true;
  ['1', '2'].forEach(function (n) {
    var dh = ((ambObj['h' + n] - amb['h' + n] + 540) % 360) - 180;
    amb['h' + n] = (amb['h' + n] + dh * f + 360) % 360;
    if (Math.abs(dh) > 0.4) lis = false;
    ['s', 'l'].forEach(function (p) { var d = ambObj[p + n] - amb[p + n]; amb[p + n] += d * f; if (Math.abs(d) > 0.1) lis = false; });
  });
  if (lis) for (var k in ambObj) amb[k] = ambObj[k];
  ambienteAplicar();
  return !lis;
}
function ambienteAplicar() {
  var st = document.documentElement.style;
  st.setProperty('--h1', amb.h1.toFixed(1)); st.setProperty('--s1', amb.s1.toFixed(1) + '%'); st.setProperty('--l1', amb.l1.toFixed(1) + '%');
  st.setProperty('--h2', amb.h2.toFixed(1)); st.setProperty('--s2', amb.s2.toFixed(1) + '%'); st.setProperty('--l2', amb.l2.toFixed(1) + '%');
  Moneda.tinte(amb.h2, amb.s2, amb.l2);
}

/* ---------- efectos 2D: chispas, ondas, estela ---------- */
var FX = (function () {
  var cv = $('#fx'), c = cv.getContext('2d'), W = 0, H = 0, dpr = 1;
  var chispas = [], ondas = [], fantasmas = [], vozOn = false, vozVel = 1, emitir = 0, centro = null;
  function medir() { W = innerWidth; H = innerHeight; dpr = Math.min(window.devicePixelRatio || 1, 2); cv.width = W * dpr; cv.height = H * dpr; cv.style.width = W + 'px'; cv.style.height = H + 'px'; }
  medir(); addEventListener('resize', medir);
  function paso(dt) {
    c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, W, H);
    c.globalCompositeOperation = 'lighter'; var i;
    if (vozOn && centro) {
      emitir -= dt * vozVel;
      if (emitir <= 0) { emitir = 0.62; ondas.push({ x: centro.x, y: centro.y, r: centro.d * 0.5, vr: centro.d * 0.55 * (0.6 + vozVel * 0.4), a: 0.55, w: 2.2 }); }
      vozVel = Math.max(1, vozVel - dt * 1.4);
    }
    for (i = ondas.length - 1; i >= 0; i--) {
      var o = ondas[i]; o.r += o.vr * dt * (vozOn ? vozVel * 0.8 : 1); o.a -= dt * 0.34 * (vozOn ? 1 : 1.7);
      if (o.a <= 0) { ondas.splice(i, 1); continue; }
      c.strokeStyle = 'hsla(' + (o.h != null ? o.h : amb.h2) + ',70%,78%,' + o.a.toFixed(3) + ')'; c.lineWidth = o.w;
      c.beginPath(); c.arc(o.x, o.y, o.r, 0, 6.2832); c.stroke();
    }
    for (i = chispas.length - 1; i >= 0; i--) {
      var p = chispas[i]; p.vida -= dt; if (p.vida <= 0) { chispas.splice(i, 1); continue; }
      p.vx *= Math.pow(0.05, dt); p.vy = p.vy * Math.pow(0.05, dt) + 520 * dt; p.x += p.vx * dt; p.y += p.vy * dt;
      var k = p.vida / p.max;
      c.strokeStyle = 'rgba(255,' + (200 + 40 * k | 0) + ',' + (140 + 90 * k | 0) + ',' + k.toFixed(3) + ')'; c.lineWidth = p.s * k + 0.4; c.lineCap = 'round';
      c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(p.x - p.vx * 0.035, p.y - p.vy * 0.035); c.stroke();
    }
    for (i = fantasmas.length - 1; i >= 0; i--) {
      var f = fantasmas[i]; f.a -= dt * 2.3; if (f.a <= 0) { fantasmas.splice(i, 1); continue; }
      var g = c.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.r);
      g.addColorStop(0, 'hsla(' + amb.h2 + ',60%,80%,' + (f.a * 0.55).toFixed(3) + ')'); g.addColorStop(0.6, 'hsla(' + amb.h2 + ',60%,65%,' + (f.a * 0.22).toFixed(3) + ')'); g.addColorStop(1, 'hsla(' + amb.h2 + ',60%,60%,0)');
      c.fillStyle = g; c.beginPath(); c.arc(f.x, f.y, f.r, 0, 6.2832); c.fill();
    }
    c.globalCompositeOperation = 'source-over';
    var vivo = vozOn || ondas.length || chispas.length || fantasmas.length;
    if (!vivo) c.clearRect(0, 0, W, H);
    return !!vivo;
  }
  return {
    chispas: function (x, y, n, vel) {
      for (var i = 0; i < n; i++) { var an = Math.random() * 6.2832, v = (0.35 + Math.random() * 0.65) * (vel || 640), m = 0.5 + Math.random() * 0.7; chispas.push({ x: x, y: y, vx: Math.cos(an) * v, vy: Math.sin(an) * v - 60, vida: m, max: m, s: 1 + Math.random() * 2.4 }); }
      Motor.add(paso);
    },
    onda: function (x, y, r, vr, h) { ondas.push({ x: x, y: y, r: r, vr: vr || 300, a: 0.8, w: 2.6, h: h }); Motor.add(paso); },
    fantasma: function (x, y, r) { fantasmas.push({ x: x, y: y, r: r, a: 1 }); Motor.add(paso); },
    voz: function (si, cx, cy, d) { vozOn = !!si; if (si) { centro = { x: cx, y: cy, d: d }; emitir = 0; Motor.add(paso); } },
    centro: function (cx, cy, d) { centro = { x: cx, y: cy, d: d }; },
    acelerar: function (v) { vozVel = Math.min(3.4, vozVel + v); },
    zona: function (z) { cv.style.zIndex = z; }
  };
})();

/* ---------- formato de textos ---------- */
function setChip(chipEl, cod) {
  var I = INFO[cod];
  $('.bandera', chipEl).textContent = I.b; $('.cod', chipEl).textContent = cod; $('.nom', chipEl).textContent = I.n;
}
function textoTasaPar() {
  var r = S.hipo != null ? S.hipo : tasaAB(S.de, S.a);
  return '1 ' + S.de + ' = ' + fmt(r, decimalesTasa(r)) + ' ' + S.a;
}

/* ---------- render central ---------- */
var _ultDestino = '';
function valorMonto() { var v = evaluar(S.expr); return v == null || isNaN(v) ? 0 : v; }
function render(o) {
  o = o || {};
  var monto = valorMonto(), r = S.hipo != null ? S.hipo : tasaAB(S.de, S.a), dest = monto * r;
  // origen
  var oe = $('#origen'); oe.innerHTML = exprHTML(S.expr) + '<span class="caret" aria-hidden="true"></span>';
  oe.style.fontSize = '';
  var w = oe.scrollWidth, pw = oe.clientWidth, fs = parseFloat(getComputedStyle(oe).fontSize);
  if (w > pw && pw > 0) oe.style.fontSize = Math.max(20, fs * pw / w * 0.97) + 'px';
  var cu = $('#cuenta');
  if (tieneOp(S.expr)) cu.innerHTML = '= <b>' + fmt(monto, decimalesResultado(monto, S.de) > 2 ? decimalesResultado(monto, S.de) : (monto % 1 ? 2 : 0)) + '</b>';
  else cu.textContent = '';
  // destino
  var dec = decimalesResultado(dest, S.a), txt = fmt(dest, dec);
  if (txt !== _ultDestino || o.fuerza) { Odo.poner(txt, o.odo); _ultDestino = txt; }
  $('#destinoSr').textContent = fmt(monto, 2) + ' ' + S.de + ' son ' + txt + ' ' + S.a;
  $('#destino').setAttribute('aria-label', 'Resultado: ' + txt + ' ' + S.a + '. Toca para copiarlo.');
  // chips
  if (!o.sinChips) { setChip($('#chipDe'), S.de); setChip($('#chipA'), S.a); }
  // tasa
  var t = $('#tasa'), cd = cambioDia(), h = '';
  if (S.hipo != null) {
    t.classList.add('hipo');
    h = '<span class="eq">' + S.hipoTxt + ': ' + textoTasaPar() + '</span>';
  } else {
    t.classList.remove('hipo');
    h = '<span class="eq">' + textoTasaPar() + '</span>';
    if (cd != null) {
      var sube = cd >= 0;
      h += '<span class="var ' + (sube ? 'sube' : 'baja') + '"><svg viewBox="0 0 10 10" fill="currentColor">' + (sube ? '<path d="M5 1l4.2 7H.8z"/>' : '<path d="M5 9L.8 2h8.4z"/>') + '</svg>' + fmt(Math.abs(cd) * 100, 2) + ' % hoy</span>';
    }
    var vj = viejo();
    h += '<span class="hace' + (vj ? ' viejo' : '') + '">' + (vj ? 'Ojo: datos ' : 'Actualizado ') + hace(DATOS.ts).replace(/^hace/, vj ? 'de hace' : 'hace') + '</span>';
  }
  t.innerHTML = h;
  // comisión
  var cl = $('#comLinea');
  if (S.com > 0) { cl.hidden = false; cl.innerHTML = 'Con ' + fmt(S.com, S.com % 1 ? 1 : 0) + ' % de comisión: <b>' + INFO[S.a].sim + fmt(dest * (1 - S.com / 100), dec) + '</b>'; }
  else cl.hidden = true;
  if (o.completo !== false && typeof Graf !== 'undefined' && Graf.lectura) Graf.lectura();
}

/* ---------- pares recientes ---------- */
function anotarPar() {
  S.pares = [{ de: S.de, a: S.a }].concat(S.pares.filter(function (p) { return !(p.de === S.de && p.a === S.a); })).slice(0, 5);
  guardar('pares', S.pares); pintarPares();
}
function pintarPares() {
  var cont = $('#pares');
  if (!S.pares.length) { cont.innerHTML = '<span class="vacio">Aquí aparecerán los pares que uses.</span>'; return; }
  cont.innerHTML = S.pares.map(function (p, i) {
    return '<button class="ficha" data-i="' + i + '" aria-label="Convertir de ' + INFO[p.de].n + ' a ' + INFO[p.a].n + '"><span class="f">' + INFO[p.de].b + '</span>' + p.de + '<span class="fl">→</span><span class="f">' + INFO[p.a].b + '</span>' + p.a + '</button>';
  }).join('');
}
$('#pares').addEventListener('click', function (e) {
  var b = e.target.closest('.ficha'); if (!b) return;
  var p = S.pares[+b.dataset.i]; if (!p) return;
  cambiarPar(p.de, p.a);
});

/* cambia el par con la coreografía mínima (moneda gira, ambiente cambia, números ruedan) */
function cambiarPar(de, a, o) {
  o = o || {};
  var igual = (de === S.de && a === S.a);
  S.de = de; S.a = a; S.hipo = null;
  ambienteIr(); Moneda.caras(S.de, S.a);
  if (!igual && !o.sinGiro) { Moneda.girarRapido(1); tin(1568); }
  render(); anotarPar();
  if (typeof Graf !== 'undefined') Graf.dibujar(igual ? 'morph' : 'entrada');
}

/* ---------- intercambio con la moneda ---------- */
var _girando = false;
function intercambiar() {
  var rDe = $('#chipDe').getBoundingClientRect(), rA = $('#chipA').getBoundingClientRect();
  tin(); tecleoVibra();
  var de0 = S.de; S.de = S.a; S.a = de0; S.hipo = null;
  Moneda.voltear(function () { Moneda.caras(S.de, S.a); });
  ambienteIr();
  render();
  var nDe = $('#chipDe').getBoundingClientRect(), nA = $('#chipA').getBoundingClientRect();
  volar($('#chipDe'), [{ transform: 'translate(' + (rA.left - nDe.left) + 'px,' + (rA.top - nDe.top) + 'px)' }, { transform: 'translate(0,0)' }], { k: 150, c: 17 });
  volar($('#chipA'), [{ transform: 'translate(' + (rDe.left - nA.left) + 'px,' + (rDe.top - nA.top) + 'px)' }, { transform: 'translate(0,0)' }], { k: 150, c: 17 });
  anotarPar();
  if (typeof Graf !== 'undefined') Graf.dibujar('entrada');
}
(function moneda() {
  var btn = $('#moneda'), dr = null;
  btn.addEventListener('pointerdown', function (e) {
    dr = { x0: e.clientX, lx: e.clientX, lt: performance.now(), v: 0, moved: false };
    try { btn.setPointerCapture(e.pointerId); } catch (_) { }
  });
  btn.addEventListener('pointermove', function (e) {
    if (!dr) return;
    if (!dr.moved && Math.abs(e.clientX - dr.x0) > 6) { dr.moved = true; Moneda.arrastre.inicio(); }
    if (dr.moved) {
      var now = performance.now(), dx = e.clientX - dr.lx, dtm = Math.max(1, now - dr.lt) / 1000;
      Moneda.arrastre.mover(dx * 0.016); dr.v = dr.v * 0.6 + (dx * 0.016 / dtm) * 0.4; dr.lx = e.clientX; dr.lt = now;
    }
  });
  function fin(e) {
    if (!dr) return;
    var d = dr; dr = null;
    if (d.moved) { if (performance.now() - d.lt > 90) d.v = 0; Moneda.arrastre.fin(d.v); tin(2093); }
    else if (e.type === 'pointerup') intercambiar();
  }
  btn.addEventListener('pointerup', fin); btn.addEventListener('pointercancel', fin);
  btn.addEventListener('click', function (e) { if (e.detail === 0) intercambiar(); });
})();

/* ---------- copiar ---------- */
function copiarResultado() {
  var monto = valorMonto(), r = S.hipo != null ? S.hipo : tasaAB(S.de, S.a), dest = monto * r;
  var txt = fmt(dest, decimalesResultado(dest, S.a));
  function listo() { estela(txt); }
  try {
    navigator.clipboard.writeText(txt).then(listo, function () { respaldoCopiar(txt); listo(); });
  } catch (e) { respaldoCopiar(txt); listo(); }
}
function respaldoCopiar(t) {
  try { var ta = document.createElement('textarea'); ta.value = t; ta.style.cssText = 'position:fixed;opacity:0;top:0'; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); } catch (e) { }
}
function estela(txt) {
  var el = $('#odo'), r = el.getBoundingClientRect(), fs = getComputedStyle($('#destino')).fontSize;
  for (var i = 0; i < 4; i++) {
    var g = document.createElement('div'); g.className = 'fantasma'; g.textContent = txt; g.style.fontSize = fs;
    g.style.left = r.left + 'px'; g.style.top = r.top + 'px'; g.style.opacity = 0; document.body.appendChild(g);
    var a = volar(g, [
      { transform: 'translate(0,0) scale(1)', opacity: i === 0 ? 0.95 : 0.4 - i * 0.08, filter: 'blur(0px)' },
      { transform: 'translate(' + (r.width * 0.08 + i * 6) + 'px,' + (-110 - i * 18) + 'px) scale(' + (0.62 - i * 0.05) + ')', opacity: 0, filter: 'blur(' + (2 + i * 2) + 'px)' }
    ], { k: 55, c: 9, delay: i * 55, fill: 'forwards' });
    a.onfinish = (function (n) { return function () { n.remove(); }; })(g);
  }
  var cp = $('#copiado');
  volar(cp, [{ opacity: 0, transform: 'translateY(8px) scale(.9)' }, { opacity: 1, transform: 'translateY(0) scale(1)' }], { k: 260, c: 20 });
  clearTimeout(estela.t);
  estela.t = setTimeout(function () { cp.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300, fill: 'forwards' }); }, 1300);
  tin(2349);
}
$('#destino').addEventListener('click', copiarResultado);

/* ---------- teclado ---------- */
(function teclado() {
  var tk = $('#teclado'), def = [
    ['AC', 'ac', 'fn', 'Borrar todo'], ['⌫', 'back', 'fn', 'Borrar. Mantén pulsado para borrar todo'], ['÷', '/', 'op', 'Dividir'], ['×', '*', 'op', 'Multiplicar'],
    ['7', '7'], ['8', '8'], ['9', '9'], ['−', '-', 'op', 'Restar'],
    ['4', '4'], ['5', '5'], ['6', '6'], ['+', '+', 'op', 'Sumar'],
    ['1', '1'], ['2', '2'], ['3', '3'], ['=', '=', 'ig alto', 'Calcular'],
    ['0', '0', 'ancho'], [',', ',', '', 'Coma decimal']
  ];
  var teclas = [];
  def.forEach(function (d) {
    var b = document.createElement('button'); b.type = 'button'; b.className = 'tecla ' + (d[2] || '');
    if (d[2] && d[2].indexOf('alto') >= 0) { b.style.gridRow = 'span 2'; b.style.height = 'auto'; }
    if (d[1] === 'back') b.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5h10a2 2 0 012 2v10a2 2 0 01-2 2H9l-6-7 6-7z"/><path d="M13 10l4 4M17 10l-4 4"/></svg>';
    else b.textContent = d[0];
    b.setAttribute('aria-label', d[3] || d[0]); b.dataset.k = d[1];
    b.spr = new Resorte(0, { k: 520, c: 24, eps: 0.004, epsV: 0.05 });
    tk.appendChild(b); teclas.push(b);
  });
  function paso(dt) {
    var vivo = false;
    teclas.forEach(function (b) {
      if (b.spr.quieto() && b.spr.v === b.spr.t) return;
      b.spr.paso(dt); b.style.setProperty('--p', b.spr.v.toFixed(3)); vivo = true;
    });
    return vivo;
  }
  var largo = null, fueLargo = false;
  tk.addEventListener('pointerdown', function (e) {
    var b = e.target.closest('.tecla'); if (!b) return;
    b.spr.ir(1); Motor.add(paso);
    if (b.dataset.k === 'back') { fueLargo = false; largo = setTimeout(function () { fueLargo = true; teclear('ac'); }, 520); }
  });
  function suelta(e) {
    teclas.forEach(function (b) { if (b.spr.t !== 0) { b.spr.ir(0); } });
    Motor.add(paso); clearTimeout(largo);
  }
  tk.addEventListener('pointerup', suelta); tk.addEventListener('pointercancel', suelta); tk.addEventListener('pointerleave', suelta);
  tk.addEventListener('click', function (e) {
    var b = e.target.closest('.tecla'); if (!b) return;
    if (b.dataset.k === 'back' && fueLargo) { fueLargo = false; return; }
    if (e.detail === 0) { b.spr.v = 0.8; b.spr.ir(0); Motor.add(paso); }
    teclear(b.dataset.k);
  });
  // teclado físico
  document.addEventListener('keydown', function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    var t = e.target, tag = t && t.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (t && t.isContentEditable)) return;
    if (Hoja.abierta || Voz.abierta) { if (e.key === 'Escape') { Hoja.abierta ? Hoja.cerrar() : Voz.cerrar(); } return; }
    var k = e.key, m = null;
    if (/^[0-9]$/.test(k)) m = k;
    else if (k === ',') m = ',';
    else if (k === '+') m = '+'; else if (k === '-') m = '-';
    else if (k === '*' || k === 'x' || k === 'X') m = '*'; else if (k === '/' ) m = '/';
    else if (k === 'Enter' || k === '=') { if (tag === 'BUTTON' && k === 'Enter') return; m = '='; }
    else if (k === 'Backspace') m = 'back'; else if (k === 'Delete' || k === 'Escape') m = 'ac';
    else if (k === ' ' ) { e.preventDefault(); Voz.abrir(); return; }
    if (m != null) {
      e.preventDefault(); teclear(m);
      var tb = teclas.filter(function (b) { return b.dataset.k === m; })[0];
      if (tb) { tb.spr.v = 0.9; tb.spr.ir(0); Motor.add(paso); }
    }
  });
})();
$('#origen').addEventListener('click', function () { /* el campo es de lectura: se escribe con el teclado de abajo */ });

/* ---------- comisión y voz de respuesta ---------- */
(function ajustes() {
  var rg = $('#comRango'), sal = $('#comSal');
  rg.value = S.com; sal.textContent = fmt(S.com, S.com % 1 ? 1 : 0) + ' %';
  rg.addEventListener('input', function () { S.com = +rg.value; sal.textContent = fmt(S.com, S.com % 1 ? 1 : 0) + ' %'; guardar('com', S.com); render({ sinChips: true }); });
  var bv = $('#btnVoz'); bv.setAttribute('aria-pressed', S.voz);
  bv.addEventListener('click', function () {
    S.voz = !S.voz; guardar('voz', S.voz); bv.setAttribute('aria-pressed', S.voz);
    if (!S.voz && window.speechSynthesis) speechSynthesis.cancel();
    if (S.voz) tin(1760);
  });
})();

/* ---------- selector de moneda: hoja inferior ---------- */
var Hoja = (function () {
  var hoja = $('#hoja'), panel = $('#panelHoja'), telon = $('#telon'), rej = $('#rejilla'), q = $('#buscar');
  var cual = 'de', hy = new Resorte(900, { k: 300, c: 30, eps: 0.3, epsV: 3 }), alto = 640, cerrando = false, foco = null;
  function sinTildes(s) { return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
  function pintar() {
    var f = sinTildes(q.value.trim()), actual = cual === 'de' ? S.de : S.a;
    var lista = ORDEN.filter(function (c) {
      if (!f) return true; var I = INFO[c];
      return sinTildes(c + ' ' + I.n + ' ' + I.pais + ' ' + I.c).indexOf(f) >= 0;
    });
    rej.innerHTML = lista.map(function (c) {
      var I = INFO[c], sim = SIMBOLO_MONEDA[c], cl = sim.length > 2 ? 'l3' : sim.length > 1 ? 'l2' : '';
      return '<button class="celda" role="option" aria-selected="' + (c === actual) + '" data-c="' + c + '" style="--hc:' + I.h + '" aria-label="' + I.n + '"><span class="mini"><span class="' + cl + '">' + sim + '</span></span><span class="cc">' + I.b + ' ' + c + '</span><span class="cn">' + I.n + '</span></button>';
    }).join('') || '<p class="vacio" style="grid-column:1/-1;text-align:center;padding:30px 0">No encontré esa moneda. Prueba con el nombre o el país.</p>';
  }
  function frame(dt) {
    hy.paso(dt);
    var p = clamp(1 - hy.v / alto, 0, 1);
    panel.style.transform = 'translate3d(0,' + hy.v.toFixed(1) + 'px,0)'; telon.style.opacity = p.toFixed(3);
    if (cerrando && hy.quieto()) { fin(); return false; }
    return !hy.quieto() || arrastre;
  }
  function fin() {
    hoja.classList.remove('abierta'); cerrando = false; api.abierta = false; document.documentElement.style.overflow = '';
    if (foco && foco.focus) try { foco.focus({ preventScroll: true }); } catch (e) { }
  }
  var arrastre = null;
  var asa = $('#asa'), tit = $('#hojaTit');
  function down(e) { arrastre = { y0: e.clientY, ly: e.clientY, lt: performance.now(), v: 0, base: hy.v }; e.currentTarget.setPointerCapture(e.pointerId); hy.vel = 0; Motor.add(frame); }
  function move(e) {
    if (!arrastre) return; var dy = e.clientY - arrastre.y0, n = performance.now();
    var y = arrastre.base + dy; hy.v = y < 0 ? y * 0.25 : y; hy.t = hy.v;
    arrastre.v = arrastre.v * 0.5 + ((e.clientY - arrastre.ly) / Math.max(0.001, (n - arrastre.lt) / 1000)) * 0.5; arrastre.ly = e.clientY; arrastre.lt = n;
  }
  function up() {
    if (!arrastre) return; var v = arrastre.v; arrastre = null;
    if (hy.v > alto * 0.28 || v > 700) { api.cerrar(); hy.vel = Math.max(v, 0); }
    else { hy.ir(0); hy.vel = v; Motor.add(frame); }
  }
  [asa, tit].forEach(function (h) { h.style.touchAction = 'none'; h.addEventListener('pointerdown', down); h.addEventListener('pointermove', move); h.addEventListener('pointerup', up); h.addEventListener('pointercancel', up); });
  telon.addEventListener('click', function () { api.cerrar(); });
  q.addEventListener('input', pintar);
  rej.addEventListener('pointermove', function (e) {
    var m = e.target.closest('.mini'); if (!m || e.pointerType === 'touch') return;
    var r = m.getBoundingClientRect(); m.style.setProperty('--tx', ((e.clientX - r.left) / r.width - 0.5) * 34); m.style.setProperty('--ty', -((e.clientY - r.top) / r.height - 0.5) * 34);
  });
  rej.addEventListener('pointerout', function (e) { var m = e.target.closest && e.target.closest('.mini'); if (m) { m.style.setProperty('--tx', 0); m.style.setProperty('--ty', 0); } });
  rej.addEventListener('click', function (e) {
    var b = e.target.closest('.celda'); if (!b) return; elegir(b.dataset.c, b);
  });
  hoja.addEventListener('keydown', function (e) { if (e.key === 'Escape') { e.stopPropagation(); api.cerrar(); } if (e.key === 'Tab') { /* trampa de foco simple */
    var f = $$('input,button', hoja).filter(function (x) { return x.offsetParent; }); if (!f.length) return;
    var i = f.indexOf(document.activeElement);
    if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); } else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); } } });

  function elegir(cod, celda) {
    var objetivo = cual === 'de' ? $('#chipDe .bandera') : $('#chipA .bandera');
    var mini = $('.mini', celda), r0 = mini.getBoundingClientRect();
    var otro = cual === 'de' ? S.a : S.de;
    // la ficha vuela a su sitio
    var cl = mini.cloneNode(true); cl.classList.add('vuela'); cl.style.width = r0.width + 'px'; cl.style.height = r0.height + 'px'; cl.style.setProperty('--hc', INFO[cod].h); cl.style.transform = 'none';
    var wrap = document.createElement('div'); wrap.className = 'vuela'; wrap.style.left = '0'; wrap.style.top = '0'; wrap.style.setProperty('--hc', INFO[cod].h);
    cl.style.position = 'static'; wrap.appendChild(cl); document.body.appendChild(wrap);
    api.cerrar(true);
    var oR = objetivo.getBoundingClientRect(), esc = oR.width / r0.width;
    var a = volar(wrap, [
      { transform: 'translate(' + r0.left + 'px,' + r0.top + 'px) scale(1)', opacity: 1 },
      { transform: 'translate(' + (oR.left - (r0.width - oR.width) / 2 + 0) + 'px,' + (oR.top - (r0.height - oR.height) / 2) + 'px) scale(' + esc + ')', opacity: 1 }
    ], { k: 150, c: 17, fill: 'forwards' });
    setTimeout(function () {
      if (cod === otro) { var t = S.de; S.de = S.a; S.a = t; cambiarPar(S.de, S.a); }
      else if (cual === 'de') cambiarPar(cod, S.a); else cambiarPar(S.de, cod);
    }, 170);
    a.onfinish = function () { wrap.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 160, fill: 'forwards' }).onfinish = function () { wrap.remove(); }; };
    if (!SOPORTA_LINEAR || reducido()) setTimeout(function () { wrap.remove(); }, 900);
  }
  var api = {
    abierta: false,
    abrir: function (c) {
      cual = c; foco = document.activeElement; q.value = ''; pintar();
      alto = panel.offsetHeight || 640; hoja.classList.add('abierta'); api.abierta = true; cerrando = false;
      document.documentElement.style.overflow = 'hidden';
      alto = panel.offsetHeight || 640; hy.k = 300; hy.c = 26; hy.v = alto + 20; hy.vel = 0; hy.ir(0); Motor.add(frame);
      setTimeout(function () { var s = $('.celda[aria-selected="true"]', rej) || $('.celda', rej); if (s) s.focus({ preventScroll: true }); }, 60);
      tecleoVibra();
    },
    cerrar: function (suave) {
      if (cerrando || !api.abierta) return; cerrando = true;
      hy.k = 260; hy.c = 28; hy.ir(alto + 30); Motor.add(frame);
      if (reducido()) { hy.v = hy.t; frame(0.016); }
    }
  };
  return api;
})();
$('#selDe').addEventListener('click', function () { Hoja.abrir('de'); });
$('#selA').addEventListener('click', function () { Hoja.abrir('a'); });
