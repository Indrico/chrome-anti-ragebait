# Chrome Anti-Ragebait

Ekstensi Chrome desktop yang otomatis menyaring dugaan ragebait, istilah dan nama politik, serta umpatan di X, Facebook, Instagram, dan Threads. Aturan bawaan berfokus pada bahasa Indonesia, slang, serta campuran Indonesia–Inggris.

## Pemasangan di Chrome

1. Unduh ZIP ekstensi dari [rilis terbaru](https://github.com/Indrico/chrome-anti-ragebait/releases/latest), lalu ekstrak.
2. Buka `chrome://extensions` dan aktifkan **Developer mode**.
3. Klik **Load unpacked**, lalu pilih folder hasil ekstrak yang langsung berisi `manifest.json`. Jika memasang dari kode sumber, pilih folder `extension`.
4. Izinkan akses situs jika diminta oleh Chrome. Buka atau muat ulang situs yang didukung. Filter aktif otomatis. Klik ikon **Anti-Ragebait** untuk mengatur filter.

Gunakan Chrome desktop versi 120 atau lebih baru. Pemasangan tidak memerlukan akun tambahan, API key, atau pengaturan kata kunci.

Untuk memperbarui pemasangan yang sudah ada, salin isi ZIP baru ke folder ekstensi yang sedang dipakai. Klik **Reload** pada kartu ekstensi di `chrome://extensions`, tinjau izin tambahan untuk Facebook, Instagram, dan Threads jika Chrome memintanya, lalu muat ulang tab situs tersebut dan X.

## Cakupan filter

| Situs desktop | Beranda | Pencarian |
| --- | --- | --- |
| X | Kartu For You dan Following | Kartu dengan teks unggahan |
| Facebook | Kartu di feed utama | Kartu unggahan pada hasil utama atau tab unggahan |
| Instagram | Kartu dengan caption di feed utama | Kartu hasil pencarian kata kunci dengan caption yang tampil |
| Threads | Kartu di feed For You dan Following | Kartu dengan teks unggahan |

Filter membaca teks unggahan, caption, dan kutipan yang sudah tampil. Beranda menyaring ragebait, politik, dan umpatan. Pencarian menyaring politik dan umpatan. Daftar politik bawaan mencakup kata dan frasa seperti *pemilu*, *pilkada*, *DPR*, dan *partai politik*. Unggahan yang cocok disembunyikan juga saat nadanya netral.

Daftar nama politik mencakup presiden dan wakil presiden sejak Reformasi, calon Pilpres 2024, ketua DPR, MPR, dan DPD yang ditetapkan untuk periode 2024–2029, serta 18 partai nasional peserta Pemilu 2024. Filter mengenali nama lengkap, alias seperti **Jokowi** dan **Cak Imin**, serta tagar utuh seperti **#AniesBaswedan**. Singkatan ambigu seperti **PAN** perlu konteks **Partai PAN**. [Sekretariat Kabinet](https://setkab.go.id/profil-kabinet/) · [KPU](https://jdih.kpu.go.id/data/data_kepkpu/2023kpt1632.pdf) · [Risalah MPR](https://www.mpr.go.id/dokumen/risalah/file/1758790146_file_mpr.pdf) · [Daftar partai KPU](https://jdih.kpu.go.id/data/data_kepkpu/2022kpt551.pdf)

Di popup, **Blokir politik** mengatur kategori politik di Beranda dan pencarian. **Saring hasil pencarian** menjeda filter hanya di halaman pencarian. Keduanya aktif secara default dan berlaku di keempat situs. Sakelar **Saring unggahan** menjeda semua filter.

Di Beranda dan hasil pencarian, satu kata utuh dari daftar umpatan sudah cukup untuk menyembunyikan unggahan. Daftar mencakup *goblok*, *tolol*, *brengsek*, *anjing*, dan *monyet*, termasuk pemakaian harfiah pada unggahan tentang hewan. Riwayat menampilkan alasan **Umpatan** dan kata yang cocok. Pengguna tetap bisa mengetik istilah tersebut di kotak pencarian.

Hasil berupa kisi foto tanpa caption tetap tampil. Konten bergambar atau bervideo dinilai dari teks unggahan yang menyertainya. Pesan, komentar, profil, halaman unggahan individual, dan pemutar Reels berada di luar cakupan filter.

Filter ragebait sengaja sensitif. Sindiran halus bisa lolos dan candaan dengan gaya provokatif bisa tersembunyi. Pemfilteran tidak memberikan jaminan tentang pencatatan tayangan oleh X.

## Jumlah dan riwayat blokir

Klik ikon **Anti-Ragebait** untuk melihat total gabungan unggahan unik yang diblokir serta 50 entri terbaru. Entri mencantumkan situs, akun jika tersedia, waktu pemblokiran, alasan, dan cuplikan yang terbuka saat entri dipilih. Riwayat dari versi sebelumnya diberi label **X**.

Sematkan ikon **Anti-Ragebait** di toolbar Chrome untuk melihat total tanpa membuka popup. Ikon menampilkan `999+` mulai dari 1.000 unggahan. Arahkan kursor ke ikon atau buka popup untuk melihat angka lengkap.

Pemeriksaan dan penyimpanan berlangsung di browser. Status sakelar, pengenal untuk menghitung unggahan unik, dan 50 entri terbaru tersimpan di perangkat. Penghitungan dimulai saat Chrome menggunakan versi 0.2.0 atau lebih baru.

## Pengujian

Untuk menjalankan pengujian dari sumber, gunakan Node.js 20 atau lebih baru.

```sh
npm ci
npx playwright install chromium
npm test
```

`npm run test:rules` menjalankan pengujian aturan saja. Pengujian Chromium memuat ekstensi sungguhan pada halaman tiruan Beranda dan pencarian di keempat situs, termasuk scroll, navigasi, sakelar bersama, dan riwayat blokir lama. Pengujian feed Facebook, Instagram, dan Threads dengan sesi yang sudah masuk belum terverifikasi.

Dalam pemeriksaan tambahan pada 12 contoh sintetis berlabel, 9 sesuai dengan label awal. Contoh ini membantu menemukan batas aturan. Akurasi pada feed X belum diukur.

| Contoh | Hasil filter |
| --- | --- |
| “Wah, standar kalian lucu. Besok jangan pura-pura kaget kalau diperlakukan sama.” | Sindiran yang diberi label ragebait masih tampil. |
| “Liat deh, gue yakin hari ini bakal ada kubu yang kepanasan.” | Pancingan tersirat masih tampil. |
| “Berani bantah??? Ini ajakan adu argumen dengan data.” | Ajakan debat berbasis data ikut tersembunyi. |
