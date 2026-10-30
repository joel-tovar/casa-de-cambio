/* Intérprete de voz de Casa de Cambio · español colombiano hablado.
   interpretar(texto, ctx?) -> { ok, monto, de, a, faltan, tokens, usoActual }
   Función pura, sin DOM. En el navegador queda embebida; en Node se exporta. */
(function (root) {
  'use strict';

  var sinTildes = function (s) {
    return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  };

  /* ---------- números en palabras ---------- */
  var UNI = {
    cero: 0, un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9,
    diez: 10, once: 11, doce: 12, trece: 13, catorce: 14, quince: 15, dieciseis: 16, diecisiete: 17,
    dieciocho: 18, diecinueve: 19, veinte: 20, veintiun: 21, veintiuno: 21, veintiuna: 21, veintidos: 22,
    veintitres: 23, veinticuatro: 24, veinticinco: 25, veintiseis: 26, veintisiete: 27, veintiocho: 28,
    veintinueve: 29, treinta: 30, cuarenta: 40, cincuenta: 50, sesenta: 60, setenta: 70, ochenta: 80,
    noventa: 90, cien: 100, ciento: 100, doscientos: 200, doscientas: 200, trescientos: 300, trescientas: 300,
    cuatrocientos: 400, cuatrocientas: 400, quinientos: 500, quinientas: 500, seiscientos: 600,
    seiscientas: 600, setecientos: 700, setecientas: 700, ochocientos: 800, ochocientas: 800,
    novecientos: 900, novecientas: 900
  };
  var ESC_MIL = { mil: 1, luca: 1, lucas: 1 };
  var ESC_MILLON = { millon: 1, millones: 1, palo: 1, palos: 1 };
  var esEscala = function (w) { return ESC_MIL[w] || ESC_MILLON[w]; };

  function parseDigitos(raw, siguienteEsEscala) {
    // "1.500" -> 1500 · "1,5" -> 1.5 · "2.000,50" -> 2000.5 · "1,500" -> 1500 (o 1,5 si sigue "millones")
    var s = raw.replace(/^(us)?\$/, '');
    if (!/^\d[\d.,]*$/.test(s)) return null;
    s = s.replace(/[.,]+$/, '');
    var puntos = (s.match(/\./g) || []).length, comas = (s.match(/,/g) || []).length;
    if (puntos && comas) {
      var ultP = s.lastIndexOf('.'), ultC = s.lastIndexOf(',');
      if (ultC > ultP) return parseFloat(s.replace(/\./g, '').replace(',', '.'));
      return parseFloat(s.replace(/,/g, ''));
    }
    if (puntos > 1) return parseFloat(s.replace(/\./g, ''));
    if (comas > 1) return parseFloat(s.replace(/,/g, ''));
    if (puntos === 1) {
      var d = s.split('.')[1];
      if (d.length === 3 && !siguienteEsEscala) return parseFloat(s.replace('.', ''));
      if (d.length === 3 && siguienteEsEscala) return parseFloat(s); // 1.500 millones = 1,5 millones? no: mil quinientos millones
      return parseFloat(s);
    }
    if (comas === 1) {
      var e = s.split(',')[1];
      if (e.length === 3 && !siguienteEsEscala) return parseFloat(s.replace(',', ''));
      return parseFloat(s.replace(',', '.'));
    }
    return parseFloat(s);
  }

  /* ---------- monedas ---------- */
  var MONEDAS = {
    COP: ['pesos colombianos', 'peso colombiano', 'colombianos', 'colombiano', 'colombia', 'pesos', 'peso', 'pesitos', 'cop'],
    USD: ['dolares americanos', 'dolares estadounidenses', 'dolares gringos', 'dolares', 'dolar', 'verdes', 'verde', 'gringos', 'gringo', 'usd', 'estados unidos'],
    EUR: ['euros', 'euro', 'eur'],
    GTQ: ['quetzales', 'quetzal', 'guatemala', 'gtq'],
    MXN: ['pesos mexicanos', 'peso mexicano', 'mexicanos', 'mexico', 'mxn'],
    HNL: ['lempiras', 'lempira', 'honduras', 'hnl'],
    PEN: ['nuevos soles', 'soles', 'sol', 'peru', 'pen'],
    CLP: ['pesos chilenos', 'peso chileno', 'chilenos', 'chile', 'clp'],
    ARS: ['pesos argentinos', 'peso argentino', 'argentinos', 'argentina', 'ars'],
    BRL: ['reales', 'real', 'brasil', 'brl'],
    CRC: ['colones', 'colon', 'costa rica', 'crc'],
    DOP: ['pesos dominicanos', 'peso dominicano', 'republica dominicana', 'dominicanos', 'dominicana', 'dop'],
    GBP: ['libras esterlinas', 'libras', 'libra', 'gbp'],
    CAD: ['dolares canadienses', 'dolar canadiense', 'canadienses', 'canadiense', 'canada', 'cad'],
    AED: ['dirhams', 'dirham', 'dirhames', 'dubai', 'emiratos', 'aed'],
    CNY: ['yuanes', 'yuan', 'china', 'cny', 'renminbi']
  };
  var FRASES = []; // [tokens[], codigo]
  Object.keys(MONEDAS).forEach(function (cod) {
    MONEDAS[cod].forEach(function (f) { FRASES.push([f.split(' '), cod]); });
  });
  FRASES.sort(function (x, y) { return y[0].length - x[0].length; });

  var PREP_DESTINO = { a: 1, en: 1, hacia: 1, para: 1, pasalo: 1, pasalas: 1, pasalos: 1 };
  var CUANTOS = { cuantos: 1, cuantas: 1, cuanto: 1 };

  /* ---------- tokenización ---------- */
  function tokenizar(texto) {
    var partes = String(texto).replace(/[¿?¡!;:"“”()]/g, ' ').split(/\s+/).filter(Boolean);
    var res = [];
    partes.forEach(function (p) {
      // separa "$100" o "100usd" pegados
      var raw = p;
      var n = sinTildes(p).replace(/^[.,]+|[.,]+$/g, '');
      if (/^(us)?\$\d/.test(n)) n = n.replace(/^(us)?\$/, '');
      if (/^\d/.test(n)) {
        var m = n.match(/^([\d.,]+)([a-z]+)$/);
        if (m) { res.push({ raw: raw, n: m[1] }); res.push({ raw: raw, n: m[2], pegado: true }); return; }
      }
      if (n === '$') return;
      res.push({ raw: raw, n: n });
    });
    return res;
  }

  var esNumeroPalabra = function (w) { return Object.prototype.hasOwnProperty.call(UNI, w); };
  var esDigitos = function (w) { return /^\d[\d.,]*$/.test(w); };
  var esNumTok = function (w) { return esNumeroPalabra(w) || esDigitos(w) || esEscala(w) || w === 'medio' || w === 'media'; };

  /* Busca el tramo numérico que empieza en i. Devuelve {fin, valor} o null. */
  function tramoNumero(tk, i) {
    var w = tk[i].n;
    if (!esNumTok(w)) return null;
    if ((w === 'medio' || w === 'media') && !(tk[i + 1] && esEscala(tk[i + 1].n))) return null;
    var j = i, mill = 0, mil = 0, cur = 0, ultimaEscala = null, vio = false;
    while (j < tk.length) {
      var t = tk[j].n;
      if (t === 'y' && vio && tk[j + 1] && (esNumeroPalabra(tk[j + 1].n) || tk[j + 1].n === 'medio' || tk[j + 1].n === 'media' || esDigitos(tk[j + 1].n))) {
        // "treinta y cinco", "dos millones y medio": se salta; pero "cien y cinco" no importa
        j++; continue;
      }
      if (esDigitos(t)) {
        var sig = tk[j + 1] && esEscala(tk[j + 1].n);
        var v = parseDigitos(t, sig);
        if (v === null || isNaN(v)) break;
        if (vio && ultimaEscala === null && cur !== 0) break; // dos números seguidos sin escala: otro monto
        cur += v; vio = true; ultimaEscala = null; j++; continue;
      }
      if (esNumeroPalabra(t)) {
        if (t === 'cero' && vio) break;
        cur += UNI[t]; vio = true; ultimaEscala = null; j++; continue;
      }
      if (t === 'medio' || t === 'media') {
        if (ultimaEscala === 'millon') { mill += 500000; ultimaEscala = null; vio = true; j++; continue; }
        if (ultimaEscala === 'mil') { mil += 500; ultimaEscala = null; vio = true; j++; continue; }
        if (tk[j + 1] && esEscala(tk[j + 1].n)) { cur += 0.5; vio = true; j++; continue; }
        break;
      }
      if (ESC_MIL[t]) {
        var baseM = cur || 1;
        if (!vio) baseM = 1;
        mil += baseM * 1000; cur = 0; ultimaEscala = 'mil'; vio = true; j++; continue;
      }
      if (ESC_MILLON[t]) {
        var baseL = (mil + cur) || 1;
        mill += baseL * 1000000; mil = 0; cur = 0; ultimaEscala = 'millon'; vio = true; j++; continue;
      }
      break;
    }
    if (!vio || j === i) return null;
    return { ini: i, fin: j, valor: mill + mil + cur, jerga: /^(luca|lucas|palo|palos)$/.test(tk[j - 1].n) };
  }

  function buscarMonedas(tk) {
    var res = [], i = 0;
    while (i < tk.length) {
      var hallada = null;
      for (var f = 0; f < FRASES.length && !hallada; f++) {
        var fr = FRASES[f][0], ok = true;
        if (i + fr.length > tk.length) continue;
        for (var k = 0; k < fr.length; k++) if (tk[i + k].n !== fr[k]) { ok = false; break; }
        if (ok) hallada = { ini: i, fin: i + fr.length, cod: FRASES[f][1] };
      }
      if (hallada) { res.push(hallada); i = hallada.fin; } else i++;
    }
    return res;
  }

  function interpretar(texto, ctx) {
    var tk = tokenizar(texto || '');
    var nums = [], i = 0;
    while (i < tk.length) {
      var r = tramoNumero(tk, i);
      if (r) { nums.push(r); i = r.fin; } else i++;
    }
    var mons = buscarMonedas(tk);
    var num = nums[0] || null;
    var texto_n = tk.map(function (t) { return t.n; }).join(' ');
    var monto = num ? num.valor : null, de = null, a = null;
    var usoActual = [];

    var idxCuantos = -1;
    tk.forEach(function (t, ix) { if (idxCuantos < 0 && CUANTOS[t.n]) idxCuantos = ix; });

    if (num) {
      var antes = mons.filter(function (m) { return m.fin <= num.ini; });
      var despues = mons.filter(function (m) { return m.ini >= num.fin; });
      if (idxCuantos >= 0 && idxCuantos < num.ini && antes.length) {
        // "cuántos euros son dos millones de pesos"
        a = antes[0].cod;
        de = despues.length ? despues[0].cod : null;
      } else if (num.jerga && (!despues.length || PREP_DESTINO[tk[despues[0].ini - 1].n])) {
        // «2 lucas a dólares»: la luca y el palo ya son pesos
        de = 'COP'; a = despues.length ? despues[0].cod : null;
      } else if (despues.length) {
        de = despues[0].cod;
        a = despues[1] ? despues[1].cod : null;
        if (!a && antes.length && !despues[1]) a = antes[antes.length - 1].cod;
      } else if (antes.length) {
        de = antes[0].cod; a = antes[1] ? antes[1].cod : null;
      }
    } else if (mons.length) {
      if (/\b(a como|a cuanto|cuanto|como)\b.*\b(esta|anda|cotiza|vale|va|cierra|amanecio|estan|valen)\b/.test(texto_n) && mons.length === 1) {
        monto = 1; de = mons[0].cod; a = (de === 'COP') ? 'USD' : 'COP';
      } else if (mons.length === 1) {
        var prev = tk[mons[0].ini - 1];
        if (prev && PREP_DESTINO[prev.n]) a = mons[0].cod; else de = mons[0].cod;
      } else {
        de = mons[0].cod; a = mons[1].cod;
      }
    }
    if (de && a && de === a) a = null;

    var entendido = !!(num || mons.length);
    // valores por defecto desde el estado actual
    if (ctx && entendido) {
      if (monto === null && ctx.monto != null) { monto = ctx.monto; usoActual.push('monto'); }
      if (!de && !a) { de = ctx.de; a = ctx.a; usoActual.push('de', 'a'); }
      else if (de && !a) {
        a = ctx.a; usoActual.push('a');
        if (a === de) a = (de === 'COP') ? 'USD' : 'COP';
      } else if (!de && a) {
        de = ctx.de; usoActual.push('de');
        if (de === a) de = (a === 'COP') ? 'USD' : 'COP';
      }
    }
    var faltan = [];
    if (!entendido) faltan = ['monto', 'de', 'a'];
    else {
      if (monto === null) faltan.push('monto');
      if (!de) faltan.push('de');
      if (!a) faltan.push('a');
    }

    // fichas para mostrar en pantalla
    var rolDe = null, rolA = null;
    var marcas = {};
    if (num) marcas[num.ini] = { fin: num.fin, tipo: 'monto', valor: num.valor };
    // rol de cada moneda mencionada
    var usadoDe = false, usadoA = false;
    mons.forEach(function (m) {
      var tipo = 'otro';
      if (m.cod === de && !usadoDe) { tipo = 'de'; usadoDe = true; }
      else if (m.cod === a && !usadoA) { tipo = 'a'; usadoA = true; }
      marcas[m.ini] = { fin: m.fin, tipo: tipo, codigo: m.cod };
    });
    var fichas = [];
    for (var p = 0; p < tk.length;) {
      var mk = marcas[p];
      if (mk) {
        var f = { tipo: mk.tipo, texto: tk.slice(p, mk.fin).map(function (t) { return t.raw; }).join(' ') };
        if (mk.valor !== undefined) f.valor = mk.valor;
        if (mk.codigo) f.codigo = mk.codigo;
        fichas.push(f); p = mk.fin;
      } else { fichas.push({ tipo: 'palabra', texto: tk[p].raw }); p++; }
    }
    return { ok: entendido && faltan.length === 0, entendido: entendido, monto: monto, de: de, a: a, faltan: faltan, tokens: fichas, usoActual: usoActual };
  }

  /* ---------- número en letras (para la voz) ---------- */
  var U = ['cero', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez', 'once', 'doce', 'trece', 'catorce', 'quince',
    'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve', 'veinte', 'veintiuno', 'veintidós', 'veintitrés', 'veinticuatro', 'veinticinco',
    'veintiséis', 'veintisiete', 'veintiocho', 'veintinueve'];
  var D = ['', '', '', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa'];
  var C = ['', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos', 'seiscientos', 'setecientos', 'ochocientos', 'novecientos'];
  function menos1000(n, apocope) {
    if (n === 0) return '';
    if (n === 100) return 'cien';
    var c = Math.floor(n / 100), r = n % 100, s = [];
    if (c) s.push(C[c]);
    if (r) {
      if (r < 30) { var u = U[r]; if (apocope && r === 1) u = 'un'; else if (apocope && r === 21) u = 'veintiún'; s.push(u); }
      else {
        var d = Math.floor(r / 10), u2 = r % 10;
        s.push(u2 ? D[d] + ' y ' + (apocope && u2 === 1 ? 'un' : U[u2]) : D[d]);
      }
    }
    return s.join(' ');
  }
  function ent(n, apoc) {
    if (n >= 1e6) {
      var m = Math.floor(n / 1e6), r = n % 1e6;
      return (m === 1 ? 'un millón' : ent(m, true) + ' millones') + (r ? ' ' + ent(r, apoc) : '');
    }
    if (n >= 1000) {
      var k = Math.floor(n / 1000), r2 = n % 1000;
      return (k === 1 ? 'mil' : menos1000(k, true) + ' mil') + (r2 ? ' ' + menos1000(r2, apoc) : '');
    }
    return menos1000(n, apoc);
  }
  var entL = function (n, ap) { return ent(n, ap); };
  function enteroEnLetras(n) {
    n = Math.floor(Math.abs(n));
    if (n === 0) return 'cero';
    if (n >= 1e12) return String(n);
    return ent(n, false);
  }
  function numeroEnLetras(x, sustantivo) {
    var ent = Math.floor(Math.abs(x)), dec = Math.round((Math.abs(x) - ent) * 100);
    if (dec === 100) { ent += 1; dec = 0; }
    var s = sustantivo ? (ent === 0 ? 'cero' : ent >= 1e12 ? String(ent) : entL(ent, true)) : enteroEnLetras(ent);
    if (dec) s += ' con ' + enteroEnLetras(dec);
    return s;
  }

  var api = { interpretar: interpretar, numeroEnLetras: numeroEnLetras, MONEDAS_SINONIMOS: MONEDAS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Interprete = api;
})(typeof window !== 'undefined' ? window : this);
