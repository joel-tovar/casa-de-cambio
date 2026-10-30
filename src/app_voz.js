'use strict';
/* Voz (animación firma), apertura cinematográfica, sincronización con la base y arranque. */

function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
function ctxVoz() { return { monto: valorMonto(), de: S.de, a: S.a }; }

var Voz = (function () {
  var ov = $('#voz'), vivo = $('#vozVivo'), guia = $('#vozGuia'), aviso = $('#vozAviso'), inp = $('#vozTexto'), otra = $('#vozOtra');
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  var FORZAR_TEXTO = /[?&]voz=texto/.test(location.search);
  var rec = null, texto = '', modoTxt = false, foco = null, gTimer = null, gI = 0, claves = {}, fin = false, oyendo = false, t0Escucha = null;
  var FRASES = ['Di: <em>cien dólares a pesos</em>', '<em>Quinientos mil pesos</em> en quetzales', 'Cuántos euros son <em>dos millones de pesos</em>'];

  function centro() {
    var hr = $('.hueco', ov).getBoundingClientRect();
    return { x: hr.left + hr.width / 2, y: hr.top + hr.height / 2, d: clamp(Math.min(innerWidth * 0.52, hr.height * 0.8), 140, 230) };
  }
  function guiaRotar() {
    clearInterval(gTimer);
    function poner() { guia.innerHTML = FRASES[gI++ % FRASES.length]; if (!reducido()) guia.animate([{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], { duration: 420, easing: 'ease-out' }); }
    poner(); gTimer = setInterval(poner, 3400);
  }
  function mostrar(t) {
    var r = interpretar(t, ctxVoz());
    vivo.innerHTML = r.tokens.map(function (tok) {
      var cls = (tok.tipo === 'palabra' || tok.tipo === 'otro') ? 'p' : ('f ' + (tok.tipo === 'de' ? 'de' : tok.tipo === 'monto' ? 'monto' : 'a'));
      var hc = tok.codigo && INFO[tok.codigo] ? ' style="--hc:' + INFO[tok.codigo].h + '"' : '';
      return '<span class="' + cls + '"' + hc + ' data-t="' + tok.tipo + '" data-k="' + esc(tok.tipo + '|' + tok.texto) + '">' + esc(tok.texto) + '</span>';
    }).join(' ');
    $$('.f', vivo).forEach(function (n) {
      var k = n.dataset.k; if (claves[k]) return; claves[k] = 1;
      volar(n, [{ transform: 'scale(.6) translateY(8px)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }], { k: 320, c: 15 });
    });
    return r;
  }
  function pedirIntento() { otra.hidden = false; }
  function escuchar() {
    aviso.textContent = ''; otra.hidden = true; oyendo = false; fin = false;
    try { rec = new SR(); } catch (e) { return planB(); }
    rec.lang = 'es-CO'; rec.interimResults = true; rec.continuous = false; rec.maxAlternatives = 1;
    var huboError = false; texto = '';
    rec.onstart = function () { oyendo = true; clearTimeout(t0Escucha); };
    rec.onresult = function (e) {
      var t = ''; for (var i = 0; i < e.results.length; i++) t += e.results[i][0].transcript + ' ';
      texto = t.trim(); mostrar(texto); Moneda.impulso(4); FX.acelerar(1.3);
    };
    rec.onerror = function (e) {
      huboError = true; var er = e.error;
      if (er === 'not-allowed' || er === 'service-not-allowed' || er === 'audio-capture' || er === 'network' || er === 'language-not-supported') planB();
      else if (er === 'no-speech') { aviso.textContent = 'No te escuché. Acércate un poco y vuelve a intentar.'; pedirIntento(); }
    };
    rec.onend = function () {
      if (!api.abierta || modoTxt || fin) return;
      if (texto) resolver(texto); else if (!huboError) { aviso.textContent = 'No te escuché. Acércate un poco y vuelve a intentar.'; pedirIntento(); }
    };
    clearTimeout(t0Escucha); t0Escucha = setTimeout(function () { if (!oyendo && api.abierta && !modoTxt) planB(); }, 12000);
    try { rec.start(); } catch (e) { planB(); }
  }
  function planB() {
    if (modoTxt && ov.classList.contains('planb')) return;
    modoTxt = true; clearTimeout(t0Escucha);
    try { if (rec) { rec.onend = null; rec.onerror = null; rec.abort(); } } catch (e) { }
    ov.classList.add('planb'); otra.hidden = true;
    var mac = /Mac/i.test(navigator.platform || '') && !(matchMedia && matchMedia('(pointer:coarse)').matches);
    $('#vozInstr').textContent = mac ? 'Pulsa dos veces Fn y dilo. También puedes escribirlo.' : 'Toca el micrófono de tu teclado y dilo. También puedes escribirlo.';
    setTimeout(function () { try { inp.focus({ preventScroll: true }); } catch (e) { inp.focus(); } }, 120);
  }
  function resolver(t) {
    if (fin || !t || !t.trim()) { if (!t || !t.trim()) { aviso.textContent = 'Escribe o di algo, por ejemplo: «cien dólares a pesos».'; } return; }
    var r = mostrar(t);
    if (r.ok) exito(r); else fallo(r);
  }
  function fallo(r) {
    Moneda.temblar(); Moneda.impulso(0); tin(392);
    var m;
    if (!r.entendido) m = 'No te entendí. Prueba con: «cien dólares a pesos».';
    else if (r.faltan.indexOf('monto') >= 0) m = 'Me faltó el monto. Di, por ejemplo: «cien dólares a pesos».';
    else if (r.faltan.indexOf('de') >= 0) m = 'Me faltó la moneda de origen. Di, por ejemplo: «cien dólares a pesos».';
    else m = 'Me faltó la moneda de destino. Di, por ejemplo: «cien dólares a pesos».';
    aviso.textContent = m; pedirIntento();
    try { if (rec) rec.abort(); } catch (e) { }
    if (!reducido()) aviso.animate([{ transform: 'translateX(-8px)' }, { transform: 'translateX(6px)' }, { transform: 'translateX(-3px)' }, { transform: 'none' }], { duration: 380 });
  }
  function fraseResultado(r, dest) {
    function cant(x, cod) {
      var v = Math.abs(x) >= 1000 ? Math.round(x) : Math.round(x * 100) / 100;
      var letras = Interprete.numeroEnLetras(v, true), plural = v !== 1;
      if (v === 1 && INFO[cod].g === 'f') letras = 'una';
      var de = (v >= 1e6 && v % 1e6 === 0) ? ' de' : '';
      return letras + de + ' ' + INFO[cod].v1[plural ? 1 : 0];
    }
    var f = cant(r.monto, r.de);
    return f.charAt(0).toUpperCase() + f.slice(1) + (r.monto === 1 ? ' es ' : ' son ') + cant(dest, r.a) + '.';
  }
  function decirResultado(r, dest) {
    if (!S.voz || !window.speechSynthesis) return;
    var frase = fraseResultado(r, dest);
    try {
      speechSynthesis.cancel();
      var u = new SpeechSynthesisUtterance(frase), vs = speechSynthesis.getVoices() || [], pick = null;
      ['es-CO', 'es-US', 'es-MX', 'es-419', 'es'].forEach(function (l) { if (!pick) pick = vs.filter(function (v) { return v.lang && v.lang.replace('_', '-').toLowerCase().indexOf(l.toLowerCase()) === 0; })[0]; });
      if (pick) u.voice = pick; u.lang = pick ? pick.lang : 'es-CO'; u.rate = 1.02;
      speechSynthesis.speak(u);
    } catch (e) { }
  }
  function limpiar() {
    clearInterval(gTimer); clearTimeout(t0Escucha); FX.voz(false); Moneda.flotar(false); Moneda.giroBase(0);
    try { if (rec) { rec.onend = null; rec.abort(); } } catch (e) { }
  }
  function cerrarOv(dur) {
    var a = ov.animate([{ opacity: 1 }, { opacity: 0 }], { duration: reducido() ? 1 : dur, fill: 'forwards' }), hecho = false;
    function listo() {
      if (hecho) return; hecho = true;
      ov.classList.remove('abierta', 'planb'); ov.getAnimations().forEach(function (x) { x.cancel(); });
      document.documentElement.style.overflow = ''; api.abierta = false;
      if (foco && foco.focus) try { foco.focus({ preventScroll: true }); } catch (e) { }
    }
    a.onfinish = listo; setTimeout(listo, dur + 250);
  }
  function exito(r) {
    fin = true; limpiar(); clearInterval(gTimer);
    var fichas = $$('.f', vivo).map(function (n) { return { tipo: n.dataset.t, rect: n.getBoundingClientRect(), txt: n.textContent }; });
    Moneda.girarRapido(2); tin(1976);
    setTimeout(function () {
      cerrarOv(460);
      S.de = r.de; S.a = r.a; S.expr = numAExpr(r.monto); S.hipo = null;
      ambienteIr(); Moneda.caras(S.de, S.a); anotarPar();
      var n = 0;
      Moneda.onFrame(function (x, y, d) { if ((n++ % 2) === 0) FX.fantasma(x, y, d * 0.55); });
      Moneda.alSlot({
        k: 95, c: 13.5, fin: function () {
          Moneda.onFrame(null); Moneda.zona(5); FX.zona(4);
          render({ fuerza: true, odo: false }); Graf.dibujar('entrada');
          var dest = valorMonto() * tasaAB(S.de, S.a); decirResultado(r, dest);
          ov.style.pointerEvents = '';
        }
      });
      // las fichas vuelan a sus campos
      var objetivos = { monto: $('#origen'), de: $('#chipDe'), a: $('#chipA') };
      fichas.forEach(function (f, i) {
        var dst = objetivos[f.tipo]; if (!dst) return;
        var rr = dst.getBoundingClientRect();
        var c = document.createElement('div'); c.className = 'entendido'; c.textContent = f.txt; document.body.appendChild(c);
        var a = volar(c, [
          { transform: 'translate(' + f.rect.left + 'px,' + f.rect.top + 'px) scale(1)', opacity: 1 },
          { transform: 'translate(' + (rr.left + 6) + 'px,' + (rr.top + rr.height / 2 - f.rect.height / 2) + 'px) scale(.8)', opacity: 0.0 }
        ], { k: 120, c: 15, delay: i * 70, fill: 'forwards' });
        a.onfinish = function () { c.remove(); };
        if (reducido()) setTimeout(function () { c.remove(); }, 200);
      });
    }, reducido() ? 0 : 420);
  }
  var api = {
    abierta: false, frase: fraseResultado,
    abrir: function () {
      if (api.abierta || Hoja.abierta) return;
      api.abierta = true; foco = document.activeElement; S.hipo = null; fin = false; modoTxt = false; claves = {}; gI = 0;
      document.documentElement.style.overflow = 'hidden';
      ov.classList.add('abierta'); ov.classList.remove('planb'); vivo.innerHTML = ''; aviso.textContent = ''; otra.hidden = true; inp.value = '';
      ov.getAnimations().forEach(function (x) { x.cancel(); });
      ov.animate([{ opacity: 0 }, { opacity: 1 }], { duration: reducido() ? 1 : 280, fill: 'forwards' });
      var c = centro(); Moneda.modo('libre'); Moneda.zona(30); FX.zona(25);
      Moneda.ir(c.x, c.y, c.d, { k: 100, c: 14.5 }); Moneda.flotar(true); Moneda.giroBase(0.8); FX.voz(true, c.x, c.y, c.d); tin(1319);
      guiaRotar();
      if (SR && !FORZAR_TEXTO) escuchar(); else planB();
    },
    cerrar: function () {
      if (!api.abierta || fin) return;
      limpiar(); try { if (window.speechSynthesis) speechSynthesis.cancel(); } catch (e) { }
      Moneda.alSlot({ k: 110, c: 15, fin: function () { Moneda.zona(5); FX.zona(4); } });
      cerrarOv(300);
    }
  };
  $('#hablar').addEventListener('click', api.abrir);
  $('#vozCerrar').addEventListener('click', api.cerrar);
  otra.addEventListener('click', function () {
    aviso.textContent = ''; otra.hidden = true;
    if (modoTxt) { inp.focus(); } else escuchar();
  });
  $('#vozListo').addEventListener('click', function () { resolver(inp.value); });
  inp.addEventListener('input', function () { texto = inp.value; mostrar(texto); Moneda.impulso(2); FX.acelerar(0.6); aviso.textContent = ''; otra.hidden = true; });
  inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); resolver(inp.value); } });
  ov.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { e.stopPropagation(); api.cerrar(); }
    if (e.key === 'Tab') {
      var f = $$('input,button', ov).filter(function (x) { return x.offsetParent && !x.hidden; }); if (!f.length) return;
      var i = f.indexOf(document.activeElement);
      if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); } else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
    }
  });
  return api;
})();
function interpretar(t, c) { return Interprete.interpretar(t, c); }

/* ---------- apertura cinematográfica ---------- */
var Apertura = (function () {
  var el = $('#apertura'), tit = $('#titulo'), flash = $('#destello'), timers = [], hecho = false;
  'CASA DE CAMBIO'.split('').forEach(function (ch) { var s = document.createElement('span'); s.textContent = ch; tit.appendChild(s); });
  function T(fn, ms) { timers.push(setTimeout(fn, ms)); }
  function mostrarApp() {
    var a = $('#app'); a.style.opacity = 1;
    if (!reducido()) a.animate([{ opacity: 0, transform: 'translateY(14px)' }, { opacity: 1, transform: 'none' }], { duration: 560, easing: 'cubic-bezier(.2,.8,.2,1)' });
  }
  function terminar(rapido) {
    if (hecho) return; hecho = true; window.__abierto = true; window.__tAbierto = performance.now(); timers.forEach(clearTimeout);
    try { sessionStorage.setItem('cdc.visto', '1'); } catch (e) { }
    Moneda.giroBase(0); Moneda.onFrame(null);
    var fade = el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: rapido ? 150 : 1, fill: 'forwards' });
    fade.onfinish = function () { el.remove(); };
    Moneda.zona(5); FX.zona(4); Moneda.alSlot({ snap: true }); Moneda.caras(S.de, S.a);
    mostrarApp(); render({ fuerza: true, odo: 'snap' }); Graf.dibujar('inmediato');
  }
  function llegada() {
    if (hecho) return; hecho = true; window.__abierto = true; window.__tAbierto = performance.now();
    try { sessionStorage.setItem('cdc.visto', '1'); } catch (e) { }
    el.remove(); Moneda.zona(5); FX.zona(4); Moneda.onFrame(null);
    render({ fuerza: true, odo: false }); Graf.dibujar('entrada');
  }
  return {
    correr: function (larga) {
      window.__tInicio = performance.now();
      if (reducido()) { el.remove(); window.__abierto = true; Moneda.zona(5); FX.zona(4); Moneda.alSlot({ snap: true }); mostrarApp(); render({ fuerza: true, odo: 'snap' }); Graf.dibujar('inmediato'); return; }
      $('#saltar').addEventListener('click', function () { terminar(true); });
      var c = { x: innerWidth / 2, y: innerHeight * 0.42 }, D = clamp(Math.min(innerWidth, innerHeight) * 0.46, 170, 300);
      Moneda.modo('libre'); Moneda.zona(70); FX.zona(65);
      Moneda.ir(c.x, c.y, 0.5, { snap: true }); Moneda.caras(S.de, S.a);
      render({ odo: 'cero' });
      T(function () { if (!hecho) terminar(true); }, larga ? 3700 : 1800);
      function salida(dur, k, cc) {
        el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: dur, easing: 'ease-in', fill: 'forwards' });
        var n = 0; Moneda.onFrame(function (x, y, d) { if ((n++ % 2) === 0) FX.fantasma(x, y, d * 0.5); });
        Moneda.alSlot({ k: k, c: cc, fin: llegada });
        T(mostrarApp, dur * 0.4);
      }
      if (larga) {
        T(function () {
          Moneda.ir(c.x, c.y, D * 1.3, { snap: true }); Moneda.ir(c.x, c.y, D, { k: 260, c: 13 });
          Moneda.inclinar(0.55);
          flash.animate([{ opacity: 0 }, { opacity: 0.95, offset: 0.1 }, { opacity: 0 }], { duration: 640, easing: 'ease-out' });
          FX.chispas(c.x, c.y, 90, 760); FX.onda(c.x, c.y, D * 0.5, 620); tin(1397);
          Moneda.giroBase(2.4);
        }, 200);
        T(function () { Moneda.giroBase(0); Moneda.asentar(); }, 1500);
        var letras = $$('span', tit);
        T(function () {
          letras.forEach(function (s, i) {
            s.animate([
              { opacity: 0, transform: 'translateY(10px) scale(1.5)', filter: 'blur(8px)', color: '#fff' },
              { opacity: 1, transform: 'none', filter: 'blur(0)', color: '#fff', offset: 0.55 },
              { opacity: 1, transform: 'none', filter: 'blur(0)', color: '#e9e2d2' }
            ], { duration: 560, delay: i * 42, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'forwards' });
          });
        }, 650);
        T(function () { tit.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300, fill: 'forwards' }); salida(460, 120, 16); }, 1800);
      } else {
        T(function () { Moneda.ir(c.x, c.y, D * 0.55, { snap: true }); Moneda.ir(c.x, c.y, D * 0.8, { k: 260, c: 16 }); Moneda.inclinar(0.3); tin(1397); }, 40);
        T(function () { salida(300, 150, 17); }, 300);
      }
    },
    terminar: terminar
  };
})();

/* ---------- sincronizar con la base (Artifact) ---------- */
function normalizarDoc(d) {
  if (!d) return null;
  if (typeof d.json === 'string') { try { d = JSON.parse(d.json); } catch (e) { return null; } }
  else if (d.datos && d.datos.monedas) d = d.datos;
  return d && d.monedas && d.ts ? d : null;
}
function aplicarDatos(nuevo) {
  DATOS = nuevo; _ultDestino = '';
  render({ fuerza: true, sinChips: true }); Graf.dibujar('morph');
}
async function conectarBase() {
  conectarExterna();
  try {
    var db = window.claude && window.claude.use ? await window.claude.use('db') : null;
    if (!db) return;
    db.doc('tasas/hoy').onSnapshot(function (snap) {
      try {
        if (!snap.exists) return;
        var d = normalizarDoc(snap.data());
        if (d && d.ts > DATOS.ts) aplicarDatos(d);
      } catch (e) { }
    }, function () { });
  } catch (e) { }
}

async function conectarExterna() {
  var url = window.CDC_TASAS_URL; if (!url) return;
  async function traer() {
    try {
      var r = await fetch(url + '?h=' + Math.floor(Date.now() / 6e5), { cache: 'no-cache' });
      if (!r.ok) return;
      var d = normalizarDoc(await r.json());
      if (d && d.ts > DATOS.ts) aplicarDatos(d);
    } catch (e) { }
  }
  traer(); setInterval(traer, 18e5);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) traer(); });
}

/* ---------- arranque ---------- */
(function arranque() {
  function slot() { var r = $('#moneda').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, d: r.width || 104 }; }
  ambienteIr(true); pintarPares();
  $('#fuente').textContent = '1D a 1M: Google Finance · 3M a 2A: histórico de referencia';
  var iniciado = false;
  function iniciar() {
    if (iniciado) return; iniciado = true;
    Moneda.iniciar({ canvas: $('#gl'), slot: slot, });
    Moneda.caras(S.de, S.a); Moneda.tinte(amb.h2, amb.s2, amb.l2);
    var visto = false; try { visto = !!sessionStorage.getItem('cdc.visto'); } catch (e) { }
    Apertura.correr(!visto);
    setTimeout(conectarBase, 0);
  }
  var tres = $('#tres');
  if (window.THREE) iniciar();
  else {
    tres.addEventListener('load', iniciar); tres.addEventListener('error', iniciar);
    setTimeout(iniciar, 1500);
  }
  document.fonts && document.fonts.ready && document.fonts.ready.then(function () { Moneda.caras(S.de, S.a); Odo.ajustar(); });
  addEventListener('resize', function () { Odo.ajustar(); render({ sinChips: true, completo: false }); Graf.ajustarPulgar(); });
})();
