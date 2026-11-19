# Listing Chrome Web Store Anti-Ragebait

Diperbarui 19 November 2026. Paket terbaru untuk pengajuan Store menggunakan versi `0.8.2`.

## Store listing

| Kolom | Nilai |
| --- | --- |
| Item name | Anti-Ragebait |
| Category | Social Media & Networking |
| Language | Bahasa Indonesia |
| Homepage URL | `https://github.com/Indrico/chrome-anti-ragebait` |
| Support URL | `https://github.com/Indrico/chrome-anti-ragebait/issues` |
| Privacy policy URL | `https://github.com/Indrico/chrome-anti-ragebait/blob/main/PRIVACY.md` |

Nama Store mengikuti `manifest.json`. Gunakan email kontak penerbit yang sudah diverifikasi di Developer Dashboard.

### Short description

```text
Saring ragebait, politik, umpatan, dan unggahan centang biru di X, Facebook, Instagram, dan Threads.
```

### Detailed description

```text
Anti-Ragebait menyembunyikan unggahan yang cocok dengan filter bawaan di Beranda dan hasil pencarian yang didukung di X, Facebook, Instagram, dan Threads. Aturan teks berfokus pada bahasa Indonesia dan percakapan yang bercampur bahasa Inggris.

Privasi dan penggunaan data
Setelah Anda menyetujui penggunaan data di popup, filter membaca teks dan lencana pada kartu unggahan yang tampil. Riwayat menyimpan situs, nama atau username penulis jika tersedia, cuplikan teks, alasan, dan waktu pemblokiran untuk 50 entri terbaru. Pengenal unggahan digunakan untuk menghitung setiap unggahan sekali. Pemrosesan dan penyimpanan berlangsung di browser Anda. Ekstensi tidak mengirim data tersebut ke pengembang atau server eksternal.

• Saring dugaan ragebait di Beranda, serta istilah, nama politik Indonesia, dan umpatan di Beranda dan pencarian.
• Nyalakan Blokir centang biru untuk menyembunyikan unggahan dari penulis dengan lencana biru. Sakelar ini mati secara default.
• Atur filter politik dan pencarian secara terpisah di popup.
• Lihat total unggahan unik pada ikon dan buka riwayat untuk melihat alasan serta cuplikan.

Untuk mulai, klik ikon Anti-Ragebait, baca penggunaan data, lalu pilih Setuju dan aktifkan filter. Aturan siap digunakan tanpa daftar kata kunci pribadi. Filter bekerja pada kartu yang dapat dikenali. Kartu pencarian yang hanya menampilkan gambar atau tautan tanpa informasi yang bisa diperiksa dapat tetap tampil.

Untuk bantuan atau laporan masalah, buka tautan Dukungan pada listing.
```

## Aset untuk diunggah

| Kolom | File | Ukuran |
| --- | --- | --- |
| Store icon | [icon-128.png](extension/icons/icon-128.png) | 128 × 128 px, PNG transparan |
| Screenshot 1 | [01-filter-beranda.png](store-assets/01-filter-beranda.png) | 1280 × 800 px |
| Screenshot 2 | [02-sakelar-dan-riwayat.png](store-assets/02-sakelar-dan-riwayat.png) | 1280 × 800 px |
| Small promo tile | [small-promo-tile.png](store-assets/small-promo-tile.png) | 440 × 280 px |

Kedua screenshot diambil dari Chromium dengan ekstensi aktif dan unggahan contoh. Screenshot kedua menampilkan popup yang berjalan dengan riwayat hasil pemfilteran contoh. Ikon 128 px sudah ada di paket ekstensi. Gunakan berkas yang sama jika Dashboard menyediakan kolom unggah ikon.

## Privacy practices

### Single purpose

```text
Menyembunyikan unggahan yang cocok dengan filter pengguna pada Beranda dan hasil pencarian yang didukung di X, Facebook, Instagram, dan Threads, serta menampilkan jumlah dan alasan pemblokiran.
```

### Permission justification

**`storage`**

```text
Stores the user's consent and filtering preferences locally so the same settings apply across supported tabs and browser sessions.
```

**Host permissions**

```text
Content scripts run on x.com, facebook.com, instagram.com, and threads.com, including the listed www subdomains. Access allows the extension to read rendered post text and author badges, hide matching post cards on supported home and search views, and show a local count and block history. Site-wide path matching lets the extension react when these sites navigate to home or search without a page reload.
```

**Remote code**

Pilih **No**. Semua aturan dan kode pemfilteran disertakan di ZIP.

### Data usage

Centang kategori berikut untuk mencerminkan data yang diproses dan disimpan secara lokal. [Panduan privasi Dashboard](https://developer.chrome.com/docs/webstore/cws-dashboard-privacy) · [FAQ data lokal](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq)

| Opsi Dashboard | Dasar pengungkapan |
| --- | --- |
| Website content | Teks, caption, kutipan, dan lencana unggahan diproses di browser. Cuplikan teks dapat disimpan dalam riwayat blokir lokal. |
| Personally identifiable information | Nama atau username penulis unggahan dapat ditampilkan dan disimpan dalam riwayat blokir lokal. |
| Web history | Metadata situs, pengenal unggahan yang diblokir, dan waktu pemblokiran disimpan untuk riwayat serta penghitung lokal. |

Biarkan kategori lainnya kosong. Penyimpanan preferensi sakelar tidak merekam klik, gerakan tetikus, keystroke, atau aktivitas penelusuran umum.

Setelah meninjau isian, penerbit dapat mengesahkan ketiga pernyataan **Data use certification**. Data tidak dijual kepada pihak ketiga, tidak digunakan di luar tujuan yang dinyatakan, dan tidak digunakan untuk penilaian kelayakan kredit atau pinjaman.

## Pengunggahan

1. Buka [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole) dengan akun penerbit. Untuk listing Anti-Ragebait yang sudah ada, buka item tersebut dan unggah `chrome-anti-ragebait-v0.8.2.zip` melalui tab **Package**. Untuk pengajuan pertama, unggah paket yang sama melalui **New item**. [Rilis GitHub v0.8.2](https://github.com/Indrico/chrome-anti-ragebait/releases/tag/v0.8.2)
2. Isi tab **Store listing** dengan teks, URL, screenshot, dan small promo tile di atas. Isi tab **Privacy practices** dengan tujuan, alasan izin, pengungkapan data, dan URL kebijakan privasi.
3. Untuk listing yang ingin dapat ditemukan di Store, pilih **Public** pada tab **Distribution**. Tinjau pilihan wilayah pada akun penerbit sebelum menyimpan.
4. Verifikasi pratinjau dan pilih **Submit for review** saat siap. Pengajuan pertama harus melalui Dashboard. [Petunjuk publikasi Google](https://developer.chrome.com/docs/webstore/publish) · [Batasan API Store](https://developer.chrome.com/docs/webstore/api)

## Catatan pengujian dan versi

Untuk meninjau filter, buka popup dan berikan persetujuan data. Di Beranda atau pencarian yang didukung, gunakan unggahan yang terlihat dengan istilah seperti `pemilu`. Pemblokiran politik aktif secara default. Matikan **Blokir politik** untuk melihat kembali kartu yang lolos dari aturan lain. Riwayat di popup menampilkan alasan pemblokiran.

| Versi | Perubahan |
| --- | --- |
| 0.8.2 | Memulihkan filter politik dan umpatan pada tata letak hasil pencarian X yang baru. |
| 0.8.1 | Ikon asli, persetujuan penggunaan data di popup, dan paket pertama untuk pengajuan Store. |
