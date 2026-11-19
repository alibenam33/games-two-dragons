package fr.twodragons.game;

import android.app.Activity;
import android.content.res.AssetFileDescriptor;
import android.graphics.Color;
import android.media.AudioAttributes;
import android.media.AudioManager;
import android.media.SoundPool;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import java.io.IOException;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/** Single screen: the bundled web game (assets/www/index.html) in a full-screen WebView, offline. */
public class MainActivity extends Activity {
    private static final String GAME_URL = "file:///android_asset/www/index.html";

    // Android back button: closes the confirmation dialog if it is open, otherwise leaves the app.
    private static final String BACK_SCRIPT =
        "(function () { var d = document.querySelector('dialog[open]');"
        + " if (d) { d.close('cancel'); return true; } return false; })()";

    private WebView webView;
    private SoundPool pool;

    /**
     * window.NativeAudio: sound effects played by Android's SoundPool (see js/audio.js). The WebView's
     * Web Audio lags by about a second on some tablets. The WAV files are stored uncompressed in the APK.
     */
    public class NativeAudio {
        private final Map<String, Integer> ids = new ConcurrentHashMap<>();

        @JavascriptInterface
        public boolean load(String path) {
            if (ids.containsKey(path)) return true;
            try (AssetFileDescriptor fd = getAssets().openFd("www/" + path)) {
                ids.put(path, pool.load(fd, 1));
                return true;
            } catch (IOException e) {
                return false;
            }
        }

        @JavascriptInterface
        public void play(String path, double volume) {
            Integer id = ids.get(path);
            if (id != null) pool.play(id, (float) volume, (float) volume, 1, 0, 1f);
        }
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        int paper = Color.parseColor("#F2E8D4");
        getWindow().getDecorView().setBackgroundColor(paper);
        if (Build.VERSION.SDK_INT >= 28) {
            // Draw under the camera cutout too, so the scenery fills the whole screen.
            getWindow().getAttributes().layoutInDisplayCutoutMode =
                WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
        }

        setVolumeControlStream(AudioManager.STREAM_MUSIC);
        pool = new SoundPool.Builder().setMaxStreams(8).setAudioAttributes(new AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_GAME).setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build()).build();

        webView = new WebView(this);
        webView.addJavascriptInterface(new NativeAudio(), "NativeAudio");
        webView.setBackgroundColor(paper);
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        // The ambience (Web Audio) starts on the first touch anyway; don't let the WebView block it.
        settings.setMediaPlaybackRequiresUserGesture(false);
        // The layout is calibrated: ignore the system font size.
        settings.setTextZoom(100);
        webView.setWebViewClient(new WebViewClient());
        setContentView(webView);

        if (savedInstanceState != null) {
            webView.restoreState(savedInstanceState);
        } else {
            webView.loadUrl(GAME_URL);
        }
    }

    @SuppressWarnings("deprecation")
    private void hideSystemBars() {
        getWindow().getDecorView().setSystemUiVisibility(
            View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY | View.SYSTEM_UI_FLAG_FULLSCREEN
            | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
            | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION);
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) hideSystemBars();
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        webView.saveState(outState);
    }

    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        webView.evaluateJavascript(BACK_SCRIPT, handled -> {
            if (!"true".equals(handled)) finish();
        });
    }

    // The ambience runs on Web Audio: suspend it explicitly, the WebView does not always fire visibilitychange.
    private void setGamePaused(boolean paused) {
        webView.evaluateJavascript("window.TwoDragonsPause && window.TwoDragonsPause(" + paused + ")", null);
    }

    @Override
    protected void onPause() {
        setGamePaused(true);
        webView.onPause();
        pool.autoPause();
        super.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        pool.autoResume();
        webView.onResume();
        setGamePaused(false);
        hideSystemBars();
    }

    @Override
    protected void onDestroy() {
        pool.release();
        webView.destroy();
        super.onDestroy();
    }
}
