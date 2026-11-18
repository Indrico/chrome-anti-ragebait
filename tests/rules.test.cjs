const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { test } = require('node:test');
const { runInNewContext } = require('node:vm');

const script = ['political-names.js', 'rules.js']
  .map((file) => readFileSync(join(__dirname, '../extension', file), 'utf8'))
  .join('\n');
const classify = runInNewContext(script + '\nisIndonesianRagebait;');
const classifyPolitics = runInNewContext(script + '\n(text) => findPoliticalTerm(normalizePostText(text));');
const classifyPoliticalName = runInNewContext(script + '\n(text) => findPoliticalName(normalizePostText(text));');
const classifyProfanity = runInNewContext(script + '\n(text) => findProfanityTerm(normalizePostText(text));');

const cases = [
  ['ajakan berantem', 'Ayo ribut di kolom komentar.', '', true],
  ['ajakan dengan ejaan penuh-lebar', 'Ａｙｏ ribut di reply!', '', true],
  ['umpan eksplisit', 'Gue sengaja bikin kalian kepancing.', 'id', true],
  ['provokasi bercampur Inggris', 'Lu emang clown. Cry harder.', 'en', true],
  ['campuran tanpa metadata bahasa', 'Lu emang clown. Cry harder.', '', true],
  ['generalisasi mengejek', 'Semua pendukung itu bodoh.', '', true],
  ['tantangan dengan penekanan', 'Berani bantah???', 'id', true],
  ['kritik kebijakan', 'Saya tidak setuju dengan metode survei karena sampelnya terlalu kecil.', 'id', false],
  ['protes dengan penekanan', 'KENAPA TARIF NAIK?!? Ini memberatkan kami.', 'id', false],
  ['umpatan tunggal tidak memicu aturan ragebait', 'Goblok!', 'id', false],
  ['ajakan diskusi', 'Yang gak setuju, boleh kasih sumber dan alasannya.', 'id', false],
  ['ajakan diskusi dengan penekanan', 'Yang nggak setuju??? Boleh kasih sumbernya?', 'id', false],
  ['penyebutan netral', 'Semua pendukung sudah tiba di stadion.', 'id', false],
  ['pemberitahuan untuk kelompok', 'SEMUA FANS BOLEH MASUK!!!', 'id', false],
  ['kutipan yang sedang dilarang', 'Moderator melarang komentar seperti “ayo ribut di kolom komentar”.', 'id', false],
  ['lanjutan provokasi setelah kutipan', 'Moderator melarang komentar seperti "ayo ribut di kolom komentar". Gue sengaja bikin kalian ngamuk.', 'id', true],
  ['bahasa Inggris penuh', 'You are all clowns. Cry harder!!!', 'en', false],
  ['kata pemicu dalam URL', 'Lihat sumber ini: https://example.com/cry-harder???', 'id', false],
  ['ruang kosong', ' \n\t ', '', false],
];

for (const [name, text, lang, expected] of cases) {
  test(name, () => assert.equal(classify(text, lang), expected));
}

const politicalCases = [
  ['istilah politik dengan kapital', 'Jadwal PEMILU sudah diumumkan.', 'pemilu'],
  ['frasa lintas spasi', 'Anggota\n DPR rapat besok.', 'anggota dpr'],
  ['hashtag pemilihan dengan tahun', 'Pantau #Pilkada2029.', 'pilkada'],
  ['hashtag dengan tahun dan akhiran lain', 'Baca #Pilkada2029Archive.', null],
  ['partai dan kampanye nonpolitik', 'Kampanye merek ini tampil di partai semifinal.', null],
  ['awalan akronim dalam kata lain', 'DPrinter merilis model baru.', null],
  ['istilah di URL dan nama akun', 'Cek https://contoh.id/pemilu dan @politik.', null],
];

for (const [name, text, expected] of politicalCases) {
  test(name, () => assert.equal(classifyPolitics(text), expected));
}

const politicalNameCases = [
  ['nama lengkap lintas spasi', 'Membaca profil JOKO\n WIDODO.', 'Joko Widodo'],
  ['alias tokoh', 'Jokowi berkunjung hari ini.', 'Joko Widodo'],
  ['alias dengan beberapa kata', 'Simak wawancara Cak Imin.', 'Muhaimin Iskandar'],
  ['nama dengan apostrof tipografis', 'Kutipan dari Ma’ruf Amin.', "Ma'ruf Amin"],
  ['inisial dengan titik', 'Foto B.J. Habibie.', 'B.J. Habibie'],
  ['inisial tanpa titik', 'Foto BJ Habibie.', 'B.J. Habibie'],
  ['titik inisial harus harfiah', 'Tulisan BxJy Habibie.', null],
  ['tagar nama utuh', 'Ringkasan #AniesBaswedan.', 'Anies Rasyid Baswedan'],
  ['tagar yang lebih panjang', 'Baca #AniesBaswedanArchive.', null],
  ['alias partai bertanda hubung', 'Catatan dari PDI-P.', 'Partai Demokrasi Indonesia Perjuangan'],
  ['singkatan partai dengan konteks', 'Partai PAN menerbitkan pernyataan.', 'Partai Amanat Nasional'],
  ['nama depan umum dan singkatan ambigu', 'Joko dan Raka pergi ke SBY membawa wajan PAN dan pompa 35 PSI.', null],
  ['nama hanya di URL atau nama akun', 'Cek https://contoh.id/jokowi dan @Prabowo.', null],
  ['nama di dalam kata lain', 'Baca arsip Jokowian.', null],
];

for (const [name, text, expected] of politicalNameCases) {
  test(name, () => assert.equal(classifyPoliticalName(text), expected));
}

const profanityCases = [
  ['umpatan tunggal', 'Goblok!', 'goblok'],
  ['variasi ejaan', 'Goblog.', 'goblog'],
  ['hashtag umpatan dengan kapital', '#TOLOL', 'tolol'],
  ['imbuhan umpatan', 'Bajinganlah.', 'bajingan'],
  ['aksara lebar dan karakter tak terlihat', 'ＧＯＢ\u200bＬＯＫ', 'goblok'],
  ['bagian dari token lain', 'Arsip antitolol123.', null],
  ['umpatan hanya di URL atau nama akun', 'Baca https://contoh.id/goblok dan @tolol.', null],
  ['pemakaian harfiah anjing', 'Kami mengadopsi anjing.', 'anjing'],
  ['pemakaian harfiah monyet', 'Seekor monyet duduk di dahan.', 'monyet'],
  ['umpatan baru dengan imbuhan dan kapital', 'ANJINGNYA!', 'anjing'],
  ['umpatan baru dalam tagar utuh', '#MONYET', 'monyet'],
  ['kata yang hanya mengandung sebagian umpatan', 'Mari santai di pantai.', null],
];

for (const [name, text, expected] of profanityCases) {
  test(name, () => assert.equal(classifyProfanity(text), expected));
}
