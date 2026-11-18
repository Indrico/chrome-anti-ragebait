# Chrome Anti-Ragebait

Ekstensi Chrome desktop yang otomatis menyembunyikan dugaan ragebait dan unggahan dengan istilah politik dari *For You* dan *Following* di Beranda X. Aturan bawaan berfokus pada bahasa Indonesia, slang, serta campuran Indonesia–Inggris.

## Pemasangan di Chrome

1. Unduh ZIP ekstensi dari [rilis terbaru](https://github.com/Indrico/chrome-anti-ragebait/releases/latest), lalu ekstrak.
2. Buka `chrome://extensions` dan aktifkan **Developer mode**.
3. Klik **Load unpacked**, lalu pilih folder hasil ekstrak yang langsung berisi `manifest.json`. Jika memasang dari kode sumber, pilih folder `extension`.
4. Buka atau muat ulang `https://x.com/home`. Filter aktif otomatis. Klik ikon **Anti-Ragebait** untuk menjedanya di semua tab X.

Gunakan Chrome desktop versi 120 atau lebih baru. Pemasangan tidak memerlukan akun tambahan, API key, atau pengaturan kata kunci.

Untuk memperbarui pemasangan yang sudah ada, salin isi ZIP baru ke folder ekstensi yang sedang dipakai. Klik **Reload** pada kartu ekstensi di `chrome://extensions`, lalu muat ulang X.

## Cakupan filter

Filter membaca teks unggahan dan kutipan yang tampil di Beranda. Istilah politik bawaan mencakup kata dan frasa seperti *pemilu*, *pilkada*, *DPR*, dan *partai politik*. Unggahan yang cocok disembunyikan juga saat nadanya netral. Konten bergambar atau bervideo dinilai dari teks unggahan yang menyertainya. Profil, pencarian, dan halaman utas dapat dibuka seperti biasa.

Filter ragebait sengaja sensitif. Sindiran halus bisa lolos dan candaan dengan gaya provokatif bisa tersembunyi. Pemfilteran tidak memberikan jaminan tentang pencatatan tayangan oleh X.

## Jumlah dan riwayat blokir

Klik ikon **Anti-Ragebait** untuk melihat total unggahan unik yang diblokir serta 50 entri terbaru. Entri mencantumkan akun jika tersedia, waktu pemblokiran, alasan, dan cuplikan yang terbuka saat entri dipilih.

Pemeriksaan dan penyimpanan berlangsung di browser. Status sakelar, pengenal untuk menghitung unggahan unik, dan 50 entri terbaru tersimpan di perangkat. Penghitungan dimulai saat Chrome menggunakan versi 0.2.0 atau lebih baru.

## Pengujian

Untuk menjalankan pengujian dari sumber, gunakan Node.js 20 atau lebih baru.

```sh
npm ci
npx playwright install chromium
npm test
```

`npm run test:rules` menjalankan pengujian aturan saja. Pengujian Chromium memuat ekstensi sungguhan pada halaman timeline tiruan, termasuk scroll, navigasi, sakelar lintas tab, dan riwayat blokir.

Dalam pemeriksaan tambahan pada 12 contoh sintetis berlabel, 9 sesuai dengan label awal. Contoh ini membantu menemukan batas aturan. Akurasi pada feed X belum diukur.

| Contoh | Hasil filter |
| --- | --- |
| “Wah, standar kalian lucu. Besok jangan pura-pura kaget kalau diperlakukan sama.” | Sindiran yang diberi label ragebait masih tampil. |
| “Liat deh, gue yakin hari ini bakal ada kubu yang kepanasan.” | Pancingan tersirat masih tampil. |
| “Berani bantah??? Ini ajakan adu argumen dengan data.” | Ajakan debat berbasis data ikut tersembunyi. |
