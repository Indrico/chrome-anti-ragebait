const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { test } = require('node:test');
const { runInNewContext } = require('node:vm');

const script = readFileSync(join(__dirname, '../extension/rules.js'), 'utf8');
const classify = runInNewContext(script + '\nisIndonesianRagebait;');

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
  ['umpatan tunggal', 'Goblok!', 'id', false],
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
