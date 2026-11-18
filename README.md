# Chrome Anti-Ragebait

Ekstensi Chrome desktop yang otomatis menyembunyikan unggahan yang diduga ragebait dari *For You* dan *Following* di Beranda X. Aturannya sudah termasuk dalam ekstensi dan berfokus pada bahasa Indonesia, slang, serta campuran Indonesia–Inggris.

## Pemasangan di Chrome

1. Clone repositori ini atau unduh melalui menu **Code → Download ZIP**, lalu ekstrak ZIP.
2. Buka `chrome://extensions` dan aktifkan **Developer mode**.
3. Klik **Load unpacked**, lalu pilih folder `extension` yang berisi `manifest.json`.
4. Buka atau muat ulang `https://x.com/home`. Filter aktif otomatis. Klik ikon **Anti-Ragebait** untuk menjedanya di semua tab X.

Gunakan Chrome desktop versi 120 atau lebih baru. Pemasangan tidak memerlukan akun tambahan, API key, atau pengaturan kata kunci.

## Cakupan filter

Filter membaca teks unggahan dan kutipan yang tampil di Beranda. Unggahan yang terjaring beserta tombol interaksinya disembunyikan dari feed. Konten bergambar atau bervideo dinilai dari teks unggahan yang menyertainya. Profil, pencarian, dan halaman utas dapat dibuka seperti biasa.

Filter sengaja sensitif. Sindiran halus bisa lolos dan candaan dengan gaya provokatif bisa tersembunyi. Pemeriksaan berlangsung di browser. Ekstensi hanya menyimpan status sakelar secara lokal. Pemfilteran tidak memberikan jaminan tentang pencatatan tayangan oleh X.

## Pengujian

Untuk menjalankan pengujian dari sumber, gunakan Node.js 20 atau lebih baru.

```sh
npm ci
npx playwright install chromium
npm test
```

`npm run test:rules` menjalankan pengujian aturan saja. Pengujian Chromium memuat ekstensi sungguhan pada halaman timeline tiruan, termasuk scroll, navigasi, dan sakelar lintas tab.

Dalam pemeriksaan tambahan pada 12 contoh sintetis berlabel, 9 sesuai dengan label awal. Contoh ini membantu menemukan batas aturan. Akurasi pada feed X belum diukur.

| Contoh | Hasil filter |
| --- | --- |
| “Wah, standar kalian lucu. Besok jangan pura-pura kaget kalau diperlakukan sama.” | Sindiran yang diberi label ragebait masih tampil. |
| “Liat deh, gue yakin hari ini bakal ada kubu yang kepanasan.” | Pancingan tersirat masih tampil. |
| “Berani bantah??? Ini ajakan adu argumen dengan data.” | Ajakan debat berbasis data ikut tersembunyi. |
