package pl.kamil.kopalnia;

import android.os.Bundle;
import android.view.WindowManager;

import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.BridgeActivity;

// ------------------------------------------------------------
// APLIKACJA NA TELEFON (Android)
//
// Gra to ta sama strona co w przeglądarce (index.html, src/...),
// a Capacitor (BridgeActivity) pokazuje ją bez paska adresu.
// Tu jest tylko to, czego strona sama nie zrobi:
//   - pełny ekran (paski systemu wysuwają się po przeciągnięciu
//     palcem od krawędzi),
//   - ekran nie gaśnie w trakcie gry,
//   - wyjście z aplikacji = zapis postępu (zdarzenie "apppause").
// Opis: docs/aplikacje.md.
// ------------------------------------------------------------

public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
    }

    @Override
    public void onResume() {
        super.onResume();
        hideSystemBars();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            hideSystemBars();
        }
    }

    @Override
    public void onPause() {
        if (bridge != null && bridge.getWebView() != null) {
            bridge.getWebView().evaluateJavascript("window.dispatchEvent(new Event('apppause'))", null);
        }
        super.onPause();
    }

    private void hideSystemBars() {
        WindowInsetsControllerCompat controller =
            WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        controller.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
        controller.hide(WindowInsetsCompat.Type.systemBars());
    }

}
