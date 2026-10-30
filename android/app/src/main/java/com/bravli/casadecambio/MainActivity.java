package com.bravli.casadecambio;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import android.speech.tts.TextToSpeech;
import android.view.View;
import android.webkit.JavascriptInterface;
import android.webkit.WebSettings;
import android.webkit.WebView;

import org.json.JSONObject;

import java.util.ArrayList;
import java.util.Locale;

public class MainActivity extends Activity {
    private static final int PEDIR_MIC = 7;

    private WebView web;
    private SpeechRecognizer oido;
    private TextToSpeech voz;
    private String idiomaPendiente = "es-CO";

    @Override
    protected void onCreate(Bundle guardado) {
        super.onCreate(guardado);
        web = new WebView(this);
        web.setBackgroundColor(0xFF0A0E15);
        web.setOverScrollMode(View.OVER_SCROLL_NEVER);
        WebSettings ajustes = web.getSettings();
        ajustes.setJavaScriptEnabled(true);
        ajustes.setDomStorageEnabled(true);
        ajustes.setAllowFileAccess(true);
        ajustes.setMediaPlaybackRequiresUserGesture(false);
        web.addJavascriptInterface(new Puente(), "AndroidVoz");
        setContentView(web);
        voz = new TextToSpeech(this, estado -> {
            if (estado == TextToSpeech.SUCCESS) voz.setLanguage(new Locale("es", "CO"));
        });
        web.loadUrl("file:///android_asset/www/index.html");
    }

    @Override
    public void onBackPressed() {
        if (web.canGoBack()) web.goBack();
        else super.onBackPressed();
    }

    @Override
    protected void onDestroy() {
        if (oido != null) oido.destroy();
        if (voz != null) voz.shutdown();
        web.destroy();
        super.onDestroy();
    }

    private void avisar(String tipo, String clave, Object valor, boolean esFinal) {
        try {
            JSONObject ev = new JSONObject();
            ev.put("tipo", tipo);
            if (clave != null) ev.put(clave, valor);
            if (esFinal) ev.put("final", true);
            String js = "window.__vozNativa&&window.__vozNativa(" + ev + ")";
            runOnUiThread(() -> web.evaluateJavascript(js, null));
        } catch (Exception ignorado) {
        }
    }

    private void escucharAhora(String idioma) {
        if (!SpeechRecognizer.isRecognitionAvailable(this)) {
            avisar("error", "codigo", "service-not-allowed", false);
            avisar("fin", null, null, false);
            return;
        }
        if (oido == null) {
            oido = SpeechRecognizer.createSpeechRecognizer(this);
            oido.setRecognitionListener(new Oyente());
        }
        Intent i = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
        i.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
        i.putExtra(RecognizerIntent.EXTRA_LANGUAGE, idioma);
        i.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true);
        i.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1);
        oido.startListening(i);
    }

    @Override
    public void onRequestPermissionsResult(int codigo, String[] permisos, int[] resultados) {
        if (codigo != PEDIR_MIC) return;
        if (resultados.length > 0 && resultados[0] == PackageManager.PERMISSION_GRANTED) {
            escucharAhora(idiomaPendiente);
        } else {
            avisar("error", "codigo", "not-allowed", false);
            avisar("fin", null, null, false);
        }
    }

    private class Oyente implements RecognitionListener {
        @Override public void onReadyForSpeech(Bundle b) { avisar("inicio", null, null, false); }
        @Override public void onBeginningOfSpeech() { }
        @Override public void onRmsChanged(float v) { }
        @Override public void onBufferReceived(byte[] b) { }
        @Override public void onEndOfSpeech() { }
        @Override public void onEvent(int t, Bundle b) { }

        @Override
        public void onPartialResults(Bundle b) {
            String t = primero(b);
            if (t != null && !t.isEmpty()) avisar("texto", "texto", t, false);
        }

        @Override
        public void onResults(Bundle b) {
            String t = primero(b);
            if (t != null) avisar("texto", "texto", t, true);
            avisar("fin", null, null, false);
        }

        @Override
        public void onError(int e) {
            String c = e == SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS ? "not-allowed"
                    : (e == SpeechRecognizer.ERROR_NO_MATCH || e == SpeechRecognizer.ERROR_SPEECH_TIMEOUT) ? "no-speech"
                    : e == SpeechRecognizer.ERROR_AUDIO ? "audio-capture"
                    : "network";
            avisar("error", "codigo", c, false);
            avisar("fin", null, null, false);
        }

        private String primero(Bundle b) {
            ArrayList<String> l = b.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
            return l == null || l.isEmpty() ? null : l.get(0);
        }
    }

    private class Puente {
        @JavascriptInterface
        public String urlTasas() { return BuildConfig.URL_TASAS; }

        @JavascriptInterface
        public void escuchar(String idioma) {
            runOnUiThread(() -> {
                if (Build.VERSION.SDK_INT >= 23
                        && checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
                    idiomaPendiente = idioma;
                    requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO}, PEDIR_MIC);
                } else {
                    escucharAhora(idioma);
                }
            });
        }

        @JavascriptInterface
        public void parar() {
            runOnUiThread(() -> { if (oido != null) oido.cancel(); });
        }

        @JavascriptInterface
        public void hablar(String texto) {
            runOnUiThread(() -> voz.speak(texto, TextToSpeech.QUEUE_FLUSH, null, "cdc"));
        }

        @JavascriptInterface
        public void callar() {
            runOnUiThread(() -> voz.stop());
        }
    }
}
