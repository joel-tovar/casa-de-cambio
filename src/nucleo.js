'use strict';
/* Gancho de pruebas: con ?raf=t el reloj de animación usa temporizadores (para navegadores ocultos). */
if (/[?&]raf=t/.test(location.search)) { window.requestAnimationFrame = function (cb) { return setTimeout(function () { cb(performance.now()); }, 16); }; }
/* Núcleo: utilidades, datos de monedas, resortes propios y motor de animación. */
var $ = function (s, r) { return (r || document).querySelector(s); };
var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
var clamp = function (x, a, b) { return Math.min(b, Math.max(a, x)); };
var lerp = function (a, b, t) { return a + (b - a) * t; };
var mqRM = window.matchMedia ? matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
var reducido = function () { return mqRM.matches || /[?&]rm=1/.test(location.search); };

/* Monedas: bandera, nombre, artículo, símbolo, tinte del ambiente (h, s, l) y texto del canto. */
var ORDEN = ['COP', 'USD', 'EUR', 'GTQ', 'MXN', 'HNL', 'PEN', 'CLP', 'ARS', 'BRL', 'CRC', 'DOP', 'GBP', 'CAD', 'AED', 'CNY'];
var INFO = {
  COP: { b: '🇨🇴', n: 'Peso colombiano', c: 'peso', art: 'el', sim: '$', h: 34, s: 62, l: 52, pais: 'COLOMBIA', v1: ['peso', 'pesos'], g: 'm' },
  USD: { b: '🇺🇸', n: 'Dólar de EE. UU.', c: 'dólar', art: 'el', sim: 'US$', h: 148, s: 30, l: 50, pais: 'UNITED STATES', v1: ['dólar', 'dólares'], g: 'm' },
  EUR: { b: '🇪🇺', n: 'Euro', c: 'euro', art: 'el', sim: '€', h: 218, s: 70, l: 58, pais: 'EUROPA', v1: ['euro', 'euros'], g: 'm' },
  GTQ: { b: '🇬🇹', n: 'Quetzal guatemalteco', c: 'quetzal', art: 'el', sim: 'Q', h: 172, s: 64, l: 44, pais: 'GUATEMALA', v1: ['quetzal', 'quetzales'], g: 'm' },
  MXN: { b: '🇲🇽', n: 'Peso mexicano', c: 'peso mexicano', art: 'el', sim: '$', h: 352, s: 56, l: 52, pais: 'MÉXICO', v1: ['peso mexicano', 'pesos mexicanos'], g: 'm' },
  HNL: { b: '🇭🇳', n: 'Lempira hondureño', c: 'lempira', art: 'el', sim: 'L', h: 200, s: 66, l: 50, pais: 'HONDURAS', v1: ['lempira', 'lempiras'], g: 'm' },
  PEN: { b: '🇵🇪', n: 'Sol peruano', c: 'sol', art: 'el', sim: 'S/', h: 14, s: 62, l: 52, pais: 'PERÚ', v1: ['sol', 'soles'], g: 'm' },
  CLP: { b: '🇨🇱', n: 'Peso chileno', c: 'peso chileno', art: 'el', sim: '$', h: 236, s: 54, l: 58, pais: 'CHILE', v1: ['peso chileno', 'pesos chilenos'], g: 'm' },
  ARS: { b: '🇦🇷', n: 'Peso argentino', c: 'peso argentino', art: 'el', sim: '$', h: 194, s: 62, l: 56, pais: 'ARGENTINA', v1: ['peso argentino', 'pesos argentinos'], g: 'm' },
  BRL: { b: '🇧🇷', n: 'Real brasileño', c: 'real', art: 'el', sim: 'R$', h: 108, s: 46, l: 46, pais: 'BRASIL', v1: ['real', 'reales'], g: 'm' },
  CRC: { b: '🇨🇷', n: 'Colón costarricense', c: 'colón', art: 'el', sim: '₡', h: 274, s: 44, l: 58, pais: 'COSTA RICA', v1: ['colón', 'colones'], g: 'm' },
  DOP: { b: '🇩🇴', n: 'Peso dominicano', c: 'peso dominicano', art: 'el', sim: 'RD$', h: 322, s: 48, l: 56, pais: 'REP. DOMINICANA', v1: ['peso dominicano', 'pesos dominicanos'], g: 'm' },
  GBP: { b: '🇬🇧', n: 'Libra esterlina', c: 'libra', art: 'la', sim: '£', h: 256, s: 46, l: 60, pais: 'REINO UNIDO', v1: ['libra', 'libras'], g: 'f' },
  CAD: { b: '🇨🇦', n: 'Dólar canadiense', c: 'dólar canadiense', art: 'el', sim: 'C$', h: 4, s: 60, l: 54, pais: 'CANADÁ', v1: ['dólar canadiense', 'dólares canadienses'], g: 'm' },
  AED: { b: '🇦🇪', n: 'Dírham emiratí', c: 'dírham', art: 'el', sim: 'AED ', h: 52, s: 40, l: 52, pais: 'EMIRATOS', v1: ['dírham', 'dírhams'], g: 'm' },
  CNY: { b: '🇨🇳', n: 'Yuan chino', c: 'yuan', art: 'el', sim: '¥', h: 18, s: 52, l: 48, pais: 'CHINA', v1: ['yuan', 'yuanes'], g: 'm' }
};
var SIMBOLO_MONEDA = { COP: '$', USD: '$', EUR: '€', GTQ: 'Q', MXN: '$', HNL: 'L', PEN: 'S/', CLP: '$', ARS: '$', BRL: 'R$', CRC: '₡', DOP: 'RD$', GBP: '£', CAD: 'C$', AED: 'د.إ', CNY: '¥' };

/* Formato colombiano: 1.234.567,89 (siempre con puntos de miles). */
function fmt(n, dec) {
  var neg = n < 0; n = Math.abs(n);
  var s = n.toFixed(dec), p = s.split('.'), e = p[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return (neg ? '-' : '') + e + (p[1] ? ',' + p[1] : '');
}
function decimalesResultado(v, cod) {
  var a = Math.abs(v);
  if (a >= 100000 && (cod === 'COP' || cod === 'CLP')) return 0;
  if (a >= 1) return 2;
  if (a === 0) return 2;
  return clamp(Math.ceil(-Math.log10(a)) + 2, 2, 8);
}
function decimalesTasa(v) {
  var a = Math.abs(v);
  if (a >= 100) return 2;
  if (a >= 10) return 3;
  if (a >= 0.1) return 4;
  return clamp(Math.ceil(-Math.log10(a)) + 3, 4, 8);
}

/* Resorte propio (integración semi-implícita con sub-pasos). */
function Resorte(v, o) {
  o = o || {};
  this.v = v; this.t = v; this.vel = 0;
  this.k = o.k || 170; this.c = o.c || 22;
  this.eps = o.eps || 0.0008; this.epsV = o.epsV || 0.01;
}
Resorte.prototype.ir = function (t, snap) {
  this.t = t;
  if (snap || reducido()) { this.v = t; this.vel = 0; }
};
Resorte.prototype.paso = function (dt) {
  var n = Math.max(1, Math.ceil(dt / 0.004)), h = dt / n;
  for (var i = 0; i < n; i++) {
    var a = this.k * (this.t - this.v) - this.c * this.vel;
    this.vel += a * h; this.v += this.vel * h;
  }
  if (this.quieto()) { this.v = this.t; this.vel = 0; }
};
Resorte.prototype.quieto = function () { return Math.abs(this.t - this.v) < this.eps && Math.abs(this.vel) < this.epsV; };

/* Motor: un solo requestAnimationFrame, solo corre mientras algo se mueve. */
var Motor = (function () {
  var items = [], raf = 0, last = 0;
  function tick(t) {
    var dt = clamp((t - last) / 1000, 0.001, 0.034); last = t;
    var vivos = [];
    for (var i = 0; i < items.length; i++) { if (items[i](dt, t / 1000)) vivos.push(items[i]); }
    items = vivos;
    raf = items.length ? requestAnimationFrame(tick) : 0;
  }
  return {
    add: function (fn) {
      if (items.indexOf(fn) < 0) items.push(fn);
      if (!raf) { last = performance.now(); raf = requestAnimationFrame(tick); }
    },
    activo: function () { return items.length > 0; }
  };
})();

/* Curva de resorte como easing lineal para la Web Animations API (solo transform/opacity). */
var SOPORTA_LINEAR = (function () { try { return CSS.supports('animation-timing-function', 'linear(0, 1)'); } catch (e) { return false; } })();
var cacheEasing = {};
function resorteEasing(k, c) {
  var key = k + '/' + c;
  if (cacheEasing[key]) return cacheEasing[key];
  var x = 0, v = 0, h = 1 / 240, pts = [], t = 0, quieto = 0;
  while (t < 2.4) {
    var a = k * (1 - x) - c * v; v += a * h; x += v * h; t += h;
    if ((Math.round(t / h)) % 6 === 0) pts.push(x);
    if (Math.abs(1 - x) < 0.0015 && Math.abs(v) < 0.02) { if (++quieto > 6) break; } else quieto = 0;
  }
  pts.push(1);
  var r = {
    dur: Math.round(t * 1000),
    easing: SOPORTA_LINEAR ? 'linear(' + pts.map(function (p) { return p.toFixed(4); }).join(',') + ')' : 'cubic-bezier(.2,.9,.25,1.12)'
  };
  cacheEasing[key] = r; return r;
}
function volar(el, frames, o) {
  o = o || {};
  var e = resorteEasing(o.k || 190, o.c || 20);
  if (reducido()) { return el.animate([frames[frames.length - 1]], { duration: 1, fill: 'both' }); }
  return el.animate(frames, { duration: o.dur || e.dur, easing: e.easing, fill: o.fill || 'both', delay: o.delay || 0 });
}

/* Sonido «tin» generado (sin archivos). */
var _audio = null;
function tin(f) {
  try {
    var AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    _audio = _audio || new AC();
    if (_audio.state === 'suspended') _audio.resume();
    var t0 = _audio.currentTime, g = _audio.createGain();
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.07, t0 + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.5); g.connect(_audio.destination);
    [[f || 1760, 1], [(f || 1760) * 1.5, 0.45], [(f || 1760) * 2.76, 0.2]].forEach(function (p) {
      var o = _audio.createOscillator(), gg = _audio.createGain();
      o.type = 'sine'; o.frequency.value = p[0]; gg.gain.value = p[1]; o.connect(gg); gg.connect(g);
      o.start(t0); o.stop(t0 + 0.55);
    });
  } catch (e) { }
}

function guardar(k, v) { try { localStorage.setItem('cdc.' + k, JSON.stringify(v)); } catch (e) { } }
function leer(k, d) { try { var v = localStorage.getItem('cdc.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }
