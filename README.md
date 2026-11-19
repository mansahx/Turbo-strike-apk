# Turbo Strike – Car Soccer (Android APK)

Game sepak bola mobil 3D (Three.js) yang dibungkus menjadi aplikasi Android dengan [Capacitor](https://capacitorjs.com/).
APK dibuat otomatis oleh GitHub Actions — tidak perlu install Android Studio.

## Cara dapat APK

1. Buat repo baru di GitHub, lalu upload/push seluruh isi folder ini.
2. Buka tab **Actions** → workflow **Build APK** berjalan otomatis (± 5–8 menit).
3. Setelah hijau, buka run tersebut → **Artifacts** → unduh `TurboStrike-apk` → ekstrak → `TurboStrike.apk`.
4. Pindahkan ke HP, izinkan "Install dari sumber tidak dikenal", lalu install.

### Rilis dengan link unduh publik
```bash
git tag v1.0.0
git push origin v1.0.0
```
APK akan otomatis terpasang di halaman **Releases**.

## Struktur
- `www/` – game web (`index.html` + `js/`), ini yang dibungkus ke APK
- `capacitor.config.json` – id app `com.senmaydev.turbostrike`, nama "Turbo Strike"
- `scripts/patch-android.sh` – kunci landscape + layar penuh
- `.github/workflows/build-apk.yml` – pipeline build APK
- `docs/PANDUAN.txt` – panduan asli & daftar kelompok

## Catatan
- APK yang dihasilkan adalah **debug APK** (sudah ditandatangani debug key, bisa langsung diinstall). Untuk Google Play perlu release build + keystore sendiri.
- Font Titillium Web dimuat dari Google Fonts; tanpa internet game tetap jalan dengan font cadangan.
- Mengubah nama/id app: edit `capacitor.config.json`.
- Uji di PC: buka `www/index.html` di Chrome.
