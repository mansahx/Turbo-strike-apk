#!/usr/bin/env bash
# Dijalankan setelah `cap add android`:
#  - kunci orientasi landscape
#  - mode layar penuh (sembunyikan status bar & tombol navigasi)
set -euo pipefail
cd "$(dirname "$0")/../android"

MANIFEST="app/src/main/AndroidManifest.xml"
if ! grep -q 'screenOrientation' "$MANIFEST"; then
  sed -i 's|<activity|<activity android:screenOrientation="sensorLandscape"|' "$MANIFEST"
fi

JAVA_FILE=$(find app/src/main/java -name MainActivity.java | head -n1)
PKG=$(grep -m1 '^package ' "$JAVA_FILE" | sed 's/package \(.*\);/\1/')
cat > "$JAVA_FILE" <<JAVA
package ${PKG};

import android.os.Bundle;
import android.view.View;
import android.view.WindowManager;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        hideSystemUi();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) hideSystemUi();
    }

    private void hideSystemUi() {
        getWindow().getDecorView().setSystemUiVisibility(
            View.SYSTEM_UI_FLAG_LAYOUT_STABLE
            | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
            | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
            | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
            | View.SYSTEM_UI_FLAG_FULLSCREEN
            | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY);
    }
}
JAVA
echo "Patch Android selesai (landscape + fullscreen)."
