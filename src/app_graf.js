'use strict';
/* Gráfica propia en SVG: se dibuja de izquierda a derecha, hace morph entre rangos y se recorre con el dedo. */
var Graf = (function () {
  var cont = $('#lienzo'), N = 150, W = 0, H = 0, PAD = { l: 6, r: 50, t: 20, b: 26 };
  var RANGOS = ['1D', '1S', '1M', '3M', '1A', '2A'];
  var ETIQ = { '1D': 'Hoy', '1S': 'Últimos 7 días', '1M': 'Últimos 30 días', '3M': 'Últimos 3 meses', '1A': 'Último año', '2A': 'Últimos 2 años' };
  var PER = { '1D': 'Hoy', '1S': 'En 7 días', '1M': 'En 30 días', '3M': 'En 3 meses', '1A': 'En 1 año', '2A': 'En 2 años' };
  var DIAS = { '1S': 7, '1M': 31, '3M': 92, '1A': 366, '2A': 900 };
  var cur = null, ysAct = null, ysDesde = null, anim = null, svg = null, el = {}, cursor = null, ultimoRango = null;
  var botones = {}, pul = { x: new Resorte(0, { k: 260, c: 24, eps: 0.2, epsV: 2 }), w: new Resorte(40, { k: 260, c: 24, eps: 0.2, epsV: 2 }) };

  /* ---------- serie del rango para el par actual ---------- */
  function serie(r) {
    var A = S.de, B = S.a, pts = [], v, i;
    if (r === '1D') {
      v = serieCruce(A, B, 'd1'); if (!v) return null;
      for (i = 0; i < v.length; i++) if (v[i] != null) pts.push({ t: msHora(DATOS.d1.t[i]), v: v[i] });
      if (pts.length < 10) return null;
      return { pts: pts, tipo: 'h', rango: r };
    }
    var key = (r === '1S' || r === '1M') ? 'm1' : 'y2';
    v = serieCruce(A, B, key); if (!v) return null;
    var all = [];
    for (i = 0; i < v.length; i++) if (v[i] != null) all.push({ t: msDia(DATOS[key].t[i]), v: v[i] });
    if (all.length < 3) return null;
    var fin = all[all.length - 1].t;
    pts = all.filter(function (p) { return p.t >= fin - DIAS[r] * 864e5; });
    if (pts.length < 3) pts = all.slice(-3);
    return { pts: pts.map(function (p) { return { t: p.t, v: p.v }; }), tipo: 'd', rango: r };
  }
  function hayDia() { return !!serie('1D'); }

  /* interpolación monótona (PCHIP) para que la curva sea suave y no invente picos */
  function pchip(xs, ys) {
    var n = xs.length, h = [], d = [], m = new Array(n), i;
    for (i = 0; i < n - 1; i++) { h[i] = xs[i + 1] - xs[i]; d[i] = (ys[i + 1] - ys[i]) / h[i]; }
    if (n === 2) { m[0] = m[1] = d[0]; }
    else {
      m[0] = d[0]; m[n - 1] = d[n - 2];
      for (i = 1; i < n - 1; i++) {
        if (d[i - 1] * d[i] <= 0) m[i] = 0;
        else { var w1 = 2 * h[i] + h[i - 1], w2 = h[i] + 2 * h[i - 1]; m[i] = (w1 + w2) / (w1 / d[i - 1] + w2 / d[i]); }
      }
    }
    var j = 0;
    return function (x) {
      if (x <= xs[0]) return ys[0]; if (x >= xs[n - 1]) return ys[n - 1];
      while (j > 0 && xs[j] > x) j--; while (j < n - 2 && xs[j + 1] < x) j++;
      var t = (x - xs[j]) / h[j], t2 = t * t, t3 = t2 * t;
      return (2 * t3 - 3 * t2 + 1) * ys[j] + (t3 - 2 * t2 + t) * h[j] * m[j] + (-2 * t3 + 3 * t2) * ys[j + 1] + (t3 - t2) * h[j] * m[j + 1];
    };
  }

  /* ---------- ejes ---------- */
  function paso_nice(span, n) {
    var raw = span / n, p = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / p;
    return (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * p;
  }
  function fmtEje(v, step) {
    var dec = step >= 1 ? 0 : clamp(Math.ceil(-Math.log10(step)), 0, 8);
    return fmt(v, dec);
  }
  var f_dia = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', timeZone: 'UTC' });
  var f_mes = new Intl.DateTimeFormat('es-CO', { month: 'short', year: '2-digit', timeZone: 'UTC' });
  var f_hora = new Intl.DateTimeFormat('es-CO', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Bogota' });
  var f_larga = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'long', timeZone: 'UTC' });
  var f_larga_a = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
  var f_hora_larga = new Intl.DateTimeFormat('es-CO', { weekday: 'long', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Bogota' });
  function limpiarPunto(s) { return s.replace(/\./g, '').replace(/ de /g, ' '); }
  function etiquetaX(ms, c) {
    if (c.tipo === 'h') return f_hora.format(ms);
    if (c.rango === '1A' || c.rango === '2A') return limpiarPunto(f_mes.format(ms));
    return limpiarPunto(f_dia.format(ms));
  }
  function fechaLarga(ms, c) {
    if (c.tipo === 'h') { var s = f_hora_larga.format(ms); return 'a las ' + f_hora.format(ms); }
    return (c.rango === '1A' || c.rango === '2A') ? f_larga_a.format(ms) : f_larga.format(ms);
  }

  /* ---------- trazado ---------- */
  function trazar(ys) {
    var x0 = PAD.l, x1 = W - PAD.r, d = '', i;
    for (i = 0; i < N; i++) { var x = x0 + (x1 - x0) * i / (N - 1); d += (i ? 'L' : 'M') + x.toFixed(1) + ' ' + ys[i].toFixed(1); }
    return { linea: d, area: d + 'L' + x1.toFixed(1) + ' ' + (H - PAD.b) + 'L' + x0.toFixed(1) + ' ' + (H - PAD.b) + 'Z' };
  }
  function preparar(c) {
    var pts = c.pts, t0 = pts[0].t, t1 = pts[pts.length - 1].t, vmin = Infinity, vmax = -Infinity, imin = 0, imax = 0, i;
    for (i = 0; i < pts.length; i++) { if (pts[i].v < vmin) { vmin = pts[i].v; imin = i; } if (pts[i].v > vmax) { vmax = pts[i].v; imax = i; } }
    var pad = (vmax - vmin) * 0.12 || vmax * 0.002; var lo = vmin - pad, hi = vmax + pad;
    c.t0 = t0; c.t1 = t1; c.lo = lo; c.hi = hi; c.vmin = vmin; c.vmax = vmax; c.imin = imin; c.imax = imax;
    var x0 = PAD.l, x1 = W - PAD.r, y0 = PAD.t, y1 = H - PAD.b;
    c.X = function (t) { return x0 + (t - t0) / (t1 - t0) * (x1 - x0); };
    c.Y = function (v) { return y0 + (1 - (v - lo) / (hi - lo)) * (y1 - y0); };
    var f = pchip(pts.map(function (p) { return p.t; }), pts.map(function (p) { return p.v; }));
    c.ys = []; for (i = 0; i < N; i++) c.ys.push(c.Y(f(t0 + (t1 - t0) * i / (N - 1))));
    c.px = pts.map(function (p) { return c.X(p.t); }); c.py = pts.map(function (p) { return c.Y(p.v); });
  }
  function estatico(c) {
    var y0 = PAD.t, y1 = H - PAD.b, step = paso_nice(c.hi - c.lo, 4), h = '', v;
    for (v = Math.ceil(c.lo / step) * step; v <= c.hi; v += step) {
      var y = c.Y(v);
      h += '<line class="rej" x1="' + PAD.l + '" x2="' + (W - PAD.r) + '" y1="' + y.toFixed(1) + '" y2="' + y.toFixed(1) + '" stroke-dasharray="2 5"/><text x="' + (W - PAD.r + 8) + '" y="' + (y + 4).toFixed(1) + '">' + fmtEje(v, step) + '</text>';
    }
    var nx = W < 420 ? 4 : 5, xl = '';
    for (var i = 0; i < nx; i++) {
      var f = i / (nx - 1), t = c.t0 + (c.t1 - c.t0) * f, x = c.X(t), anc = i === 0 ? 'start' : i === nx - 1 ? 'end' : 'middle';
      xl += '<text x="' + x.toFixed(1) + '" y="' + (H - 6) + '" text-anchor="' + anc + '">' + etiquetaX(t, c) + '</text>';
    }
    // máximo y mínimo marcados
    function marca(i, txt, arriba) {
      var x = c.px[i], y = c.py[i], anc = x < 70 ? 'start' : x > W - PAD.r - 70 ? 'end' : 'middle';
      var ty = arriba ? y - 10 : y + 18;
      return '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="3.2" fill="var(--bg)" style="stroke:hsl(var(--h2) 60% 80%)" stroke-width="1.6"/><text class="maxmin" x="' + x.toFixed(1) + '" y="' + ty.toFixed(1) + '" text-anchor="' + anc + '">' + txt + '</text>';
    }
    var rng = c.vmax - c.vmin, dec = rng > 0 ? clamp(Math.ceil(-Math.log10(rng / 4)), 0, 8) : 2;
    var mm = '';
    if (c.imax !== c.pts.length - 1 || c.imin !== c.pts.length - 1) {
      mm += marca(c.imax, 'Máx. ' + fmt(c.vmax, Math.max(0, dec)), true);
      if (c.imin !== c.imax) mm += marca(c.imin, 'Mín. ' + fmt(c.vmin, Math.max(0, dec)), false);
    }
    return { ejes: h + xl, mm: mm };
  }

  function montar(c) {
    var e = estatico(c);
    cont.innerHTML = '<svg width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" aria-hidden="true">' +
      '<defs><linearGradient id="gA" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:hsl(var(--h2) 60% 66%);stop-opacity:.24"/><stop offset="1" style="stop-color:hsl(var(--h2) 60% 66%);stop-opacity:0"/></linearGradient>' +
      '<clipPath id="gC"><rect id="gCr" x="0" y="-30" width="' + W + '" height="' + (H + 60) + '"/></clipPath></defs>' +
      '<g id="gEjes">' + e.ejes + '</g>' +
      '<g clip-path="url(#gC)"><path id="gArea" fill="url(#gA)"/><path id="gLinea" fill="none" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" style="stroke:hsl(var(--h2) 72% 76%)"/></g>' +
      '<g id="gMM">' + e.mm + '</g>' +
      '<g id="gFin" opacity="0"><circle class="pulso" r="6" style="fill:hsl(var(--h2) 72% 76%)"/><circle r="4.6" style="fill:hsl(var(--h2) 72% 80%)" stroke="var(--bg)" stroke-width="2"/></g>' +
      '<g id="gCur" opacity="0"><line y1="' + PAD.t + '" y2="' + (H - PAD.b) + '" stroke="rgba(255,255,255,.4)" stroke-width="1"/><circle r="6" style="fill:hsl(var(--h2) 72% 82%)" stroke="var(--bg)" stroke-width="2.5"/></g></svg>';
    svg = cont.firstChild;
    el = { area: $('#gArea', svg), linea: $('#gLinea', svg), cr: $('#gCr', svg), fin: $('#gFin', svg), cur: $('#gCur', svg), ejes: $('#gEjes', svg), mm: $('#gMM', svg) };
  }

  function pintarYs(ys, prog) {
    var t = trazar(ys);
    el.linea.setAttribute('d', t.linea); el.area.setAttribute('d', t.area);
    var xFin = W - PAD.r;
    el.cr.setAttribute('width', prog >= 1 ? W + 2 : Math.max(0, PAD.l + (xFin - PAD.l) * prog));
    el.fin.setAttribute('transform', 'translate(' + xFin.toFixed(1) + ' ' + ys[N - 1].toFixed(1) + ')');
  }

  /* ---------- animaciones ---------- */
  function cuadro(dt) {
    if (!anim) return false;
    if (anim.modo === 'entrada') {
      anim.t += dt; var p = clamp(anim.t / 1.0, 0, 1), e = 1 - Math.pow(1 - p, 3);
      pintarYs(cur.ys, e);
      if (p >= 1) { el.fin.setAttribute('opacity', 1); anim = null; return false; }
      else el.fin.setAttribute('opacity', 0);
    } else if (anim.modo === 'morph') {
      anim.spr.paso(dt); var q = anim.spr.v, ys = [], i;
      for (i = 0; i < N; i++) ys.push(lerp(anim.desde[i], cur.ys[i], q));
      pintarYs(ys, 1); ysAct = ys;
      if (anim.spr.quieto()) { pintarYs(cur.ys, 1); ysAct = cur.ys; anim = null; return false; }
    }
    return true;
  }
  function pulgar(inm) {
    var b = botones[S.rango]; if (!b) return;
    var box = $('#rangos'), r = b.getBoundingClientRect(), r0 = box.getBoundingClientRect();
    pul.x.ir(r.left - r0.left, inm); pul.w.ir(r.width, inm);
    var p = $('#pulgar');
    if (inm) { p.style.transform = 'translateX(' + pul.x.v + 'px)'; p.style.width = pul.w.v + 'px'; } else Motor.add(pulgarPaso);
  }
  function pulgarPaso(dt) {
    var p = $('#pulgar'); pul.x.paso(dt); pul.w.paso(dt);
    p.style.transform = 'translateX(' + pul.x.v.toFixed(1) + 'px)'; p.style.width = pul.w.v.toFixed(1) + 'px';
    return !(pul.x.quieto() && pul.w.quieto());
  }
  function botonesRangos() {
    var box = $('#rangos'), dia = hayDia();
    RANGOS.forEach(function (r) {
      var b = botones[r]; if (!b) {
        b = document.createElement('button'); b.type = 'button'; b.textContent = r; b.dataset.r = r; b.setAttribute('aria-label', ETIQ[r]);
        box.appendChild(b); botones[r] = b;
        b.addEventListener('click', function () { api.rango(r); });
      }
      b.hidden = (r === '1D' && !dia);
      b.setAttribute('aria-pressed', r === S.rango);
    });
  }

  var api = {
    rango: function (r) {
      if (r === S.rango) return; S.rango = r; guardar('rango', r);
      botonesRangos(); pulgar(false); api.dibujar('morph'); tecleoVibra();
    },
    dibujar: function (modo) {
      W = cont.clientWidth; H = cont.clientHeight; if (W < 20) return;
      if (S.rango === '1D' && !hayDia()) S.rango = '1M';
      var c = serie(S.rango); if (!c) { S.rango = '1M'; c = serie('1M'); }
      botonesRangos();
      preparar(c);
      var desde = ysAct && ysAct.length === N ? ysAct.slice() : null;
      cur = c; montar(c); pulgar(true);
      if (modo === 'morph' && desde && !reducido()) {
        anim = { modo: 'morph', desde: desde, spr: new Resorte(0, { k: 150, c: 17, eps: 0.002, epsV: 0.02 }) }; anim.spr.ir(1);
        pintarYs(desde, 1); el.fin.setAttribute('opacity', 1); ysAct = desde; Motor.add(cuadro);
      } else if (modo === 'entrada' && !reducido()) {
        anim = { modo: 'entrada', t: 0 }; ysAct = c.ys; pintarYs(c.ys, 0); Motor.add(cuadro);
      } else { anim = null; ysAct = c.ys; pintarYs(c.ys, 1); el.fin.setAttribute('opacity', 1); }
      if (modo !== 'inmediato' && el.ejes && !reducido()) { volar(el.ejes, [{ opacity: 0 }, { opacity: 1 }], { k: 120, c: 20 }); volar(el.mm, [{ opacity: 0 }, { opacity: 1 }], { k: 120, c: 20 }); }
      api.lectura(); api.frase();
    },
    lectura: function () {
      var L = $('#lectura'); if (!cur) return;
      var monto = valorMonto();
      if (S.hipo != null && cursor) {
        L.innerHTML = '<span class="l1">' + (cursor.tipo === 'h' ? 'Hoy ' : '') + fechaLarga(cursor.t, cur) + '</span><span class="l2">' + fmt(S.hipo, decimalesTasa(S.hipo)) + ' ' + S.a + '</span><span class="l3">' + fmt(monto, monto % 1 ? 2 : 0) + ' ' + S.de + ' = ' + fmt(monto * S.hipo, decimalesResultado(monto * S.hipo, S.a)) + ' ' + S.a + '</span>';
        return;
      }
      var p0 = cur.pts[0].v, p1 = tasaAB(S.de, S.a), pct = (p1 / p0 - 1) * 100, sube = pct >= 0;
      L.innerHTML = '<span class="l1">' + ETIQ[cur.rango] + '</span><span class="l2" style="color:' + (Math.abs(pct) < 0.005 ? 'var(--txt)' : sube ? 'var(--sube)' : 'var(--baja)') + '">' + (sube ? '▲ ' : '▼ ') + fmt(Math.abs(pct), 2) + ' %</span><span class="l3">1 ' + S.de + ' = ' + fmt(p1, decimalesTasa(p1)) + ' ' + S.a + '</span>';
    },
    frase: function () {
      if (!cur) return;
      var p0 = cur.pts[0].v, p1 = tasaAB(S.de, S.a), pct = (p1 / p0 - 1) * 100, A = INFO[S.de], B = INFO[S.a];
      var nomA = A.art + ' ' + A.c, frente = B.art === 'el' ? 'al ' + B.c : 'a ' + B.art + ' ' + B.c;
      var per = PER[cur.rango], txt;
      if (Math.abs(pct) < 0.05) txt = per + ' ' + nomA + ' casi no se movió frente ' + frente + '.';
      else {
        var diff = Math.abs(p1 - p0), dd = diff >= 10 ? 0 : diff >= 1 ? 2 : clamp(Math.ceil(-Math.log10(diff)) + 1, 2, 6);
        var sim = INFO[S.a].sim, num = fmt(diff, dd);
        var pdec = Math.abs(pct) < 1 ? 2 : 1;
        txt = per + ' ' + nomA + ' ' + (pct > 0 ? 'subió' : 'bajó') + ' <b>' + fmt(Math.abs(pct), pdec) + ' %</b> frente ' + frente + ': hoy te rinde <b>' + sim + num + '</b> ' + (pct > 0 ? 'más' : 'menos') + ' por cada ' + A.v1[0] + '.';
      }
      $('#frase').innerHTML = txt;
    },
    ajustarPulgar: function () { pulgar(true); }
  };

  /* ---------- arrastre sobre la curva ---------- */
  var activo = false;
  function enPunto(e) {
    if (!cur) return;
    var r = cont.getBoundingClientRect(), x = clamp(e.clientX - r.left, cur.px[0], cur.px[cur.px.length - 1]);
    var lo = 0, hi = cur.px.length - 1;
    while (hi - lo > 1) { var m = (lo + hi) >> 1; if (cur.px[m] > x) hi = m; else lo = m; }
    var i = (Math.abs(cur.px[lo] - x) <= Math.abs(cur.px[hi] - x)) ? lo : hi, p = cur.pts[i];
    cursor = { t: p.t, v: p.v, tipo: cur.tipo };
    el.cur.getAnimations().forEach(function (an) { an.cancel(); });
    el.cur.setAttribute('opacity', 1); el.cur.setAttribute('transform', 'translate(' + cur.px[i].toFixed(1) + ' 0)');
    $('circle', el.cur).setAttribute('cy', cur.py[i].toFixed(1));
    S.hipo = p.v; S.hipoTxt = 'Si lo hubieras cambiado ' + (cur.tipo === 'h' ? fechaLarga(p.t, cur) : 'el ' + fechaLarga(p.t, cur));
    render({ sinChips: true, completo: false }); api.lectura();
  }
  cont.addEventListener('pointerdown', function (e) { activo = true; try { cont.setPointerCapture(e.pointerId); } catch (_) { } enPunto(e); });
  cont.addEventListener('pointermove', function (e) { if (activo) enPunto(e); });
  function soltar() {
    if (!activo) return; activo = false; cursor = null; S.hipo = null;
    if (el.cur) volar(el.cur, [{ opacity: 1 }, { opacity: 0 }], { k: 200, c: 30 });
    render({ sinChips: true }); api.lectura();
  }
  cont.addEventListener('pointerup', soltar); cont.addEventListener('pointercancel', soltar); cont.addEventListener('lostpointercapture', soltar);
  cont.addEventListener('keydown', function () { });
  if (window.ResizeObserver) { var ro = new ResizeObserver(function () { if (cont.clientWidth && Math.abs(cont.clientWidth - W) > 1) api.dibujar('inmediato'); }); ro.observe(cont); }
  return api;
})();
