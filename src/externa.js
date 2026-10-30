/* Solo fuera del artefacto (web instalable y APK). El artefacto no lleva este archivo. */
(function () {
  var nativo = window.AndroidVoz;
  window.CDC_TASAS_URL = nativo ? nativo.urlTasas() : 'tasas.json';

  if (!nativo) {
    if ('serviceWorker' in navigator) {
      addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () { }); });
    }
    return;
  }

  /* En Android el WebView no trae reconocimiento de voz: se puentea al del teléfono con la misma forma de la API web. */
  var activo = null;
  window.__vozNativa = function (ev) {
    var r = activo; if (!r) return;
    if (ev.tipo === 'inicio') { if (r.onstart) r.onstart({}); }
    else if (ev.tipo === 'texto') {
      var fila = [{ transcript: ev.texto, confidence: 1 }]; fila.isFinal = !!ev.final;
      var res = [fila]; res.item = function (i) { return res[i]; };
      if (r.onresult) r.onresult({ resultIndex: 0, results: res });
    }
    else if (ev.tipo === 'error') { if (r.onerror) r.onerror({ error: ev.codigo }); }
    else if (ev.tipo === 'fin') { activo = null; if (r.onend) r.onend({}); }
  };
  function SR() { }
  SR.prototype.start = function () { activo = this; nativo.escuchar(this.lang || 'es-CO'); };
  SR.prototype.stop = function () { nativo.parar(); };
  SR.prototype.abort = function () { activo = null; nativo.parar(); };
  window.SpeechRecognition = SR; window.webkitSpeechRecognition = SR;

  function Dicho(t) { this.text = t; }
  window.SpeechSynthesisUtterance = Dicho;
  try {
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: {
        cancel: function () { nativo.callar(); },
        speak: function (u) { nativo.hablar(u.text); },
        getVoices: function () { return []; }
      }
    });
  } catch (e) { }
})();
