function normalizePostText(text) {
  return text.normalize('NFKC')
    .replace(/[\u200b-\u200d\u2060\ufeff]/gu, '')
    .replace(/(?:https?:\/\/|www\.)\S+/giu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
}

const findPoliticalTerm = (() => {
  const terms = [
    'pemilihan umum', 'pemilihan kepala daerah', 'wakil presiden', 'partai politik',
    'kampanye pemilu', 'ketua partai', 'kader partai', 'politik uang', 'debat capres',
    'anggota dpr', 'dpr ri', 'wali kota', 'pemerintah daerah',
    'pemilu', 'pilpres', 'pilkada', 'pemilukada', 'pileg', 'pilgub', 'pilbup', 'pilwalkot',
    'capres', 'cawapres', 'caleg', 'cagub', 'cawagub', 'paslon', 'dapil', 'golput',
    'presiden', 'gubernur', 'bupati', 'walikota', 'menteri', 'parlemen',
    'parpol', 'politik', 'politikus', 'politisi', 'koalisi', 'oposisi',
    'bawaslu', 'kpu', 'dprd', 'dpr', 'mpr',
  ];
  const wordCharacter = '[\\p{L}\\p{N}_]';
  const pattern = new RegExp(`(?<!${wordCharacter})(?:${terms.join('|')})(?!${wordCharacter})`, 'u');
  const electionHashtag = /#(pemilu|pilpres|pilkada|pileg)20\d{2}(?![\p{L}\p{N}_])/u;

  return (normalizedText) => {
    const text = normalizedText.toLowerCase().replace(/@[a-z0-9_]+/gu, ' ');
    return text.match(pattern)?.[0] ?? text.match(electionHashtag)?.[1] ?? null;
  };
})();

const isIndonesianRagebait = (() => {
  const indonesianMarkers = new Set([
    'aja', 'aku', 'anda', 'bakal', 'banget', 'biar', 'bikin', 'bisa', 'bodoh',
    'deh', 'dibilang', 'dong', 'dungu', 'elo', 'emang', 'enggak', 'gak', 'gimana',
    'goblok', 'gua', 'gue', 'ini', 'itu', 'jangan', 'juga', 'kalian', 'kalo',
    'kalau', 'kamu', 'katanya', 'kayak', 'kenapa', 'kepancing', 'kita', 'kok',
    'loe', 'lu', 'malah', 'mereka', 'ngamuk', 'ngga', 'nggak', 'nih', 'orang',
    'pada', 'pendukung', 'saja', 'sekali', 'semua', 'sengaja', 'setuju', 'siapa',
    'silakan', 'sini', 'sudah', 'tanggapi', 'tetap', 'tidak', 'tolol', 'wkwk', 'yang',
  ]);

  const explicitBait = [
    /\b(?:ayo|sini|mari|coba) (?:kalian |lu |lo )?(?:ribut|berantem|baku hantam|debat kusir) (?:di )?(?:repl(?:y|ies)|(?:kolom )?komentar)\b/u,
    /\b(?:sengaja|cuma mau) (?:bikin|mancing|manasin) (?:lu |lo |kalian |mereka |orang )?(?:marah|ngamuk|emosi|kepancing|keributan)\b/u,
    /\b(?:tag|mention) [^.!?]{1,45} biar (?:dia |mereka |pada )?(?:ngamuk|marah|emosi)\b/u,
  ];
  const provocation = [
    /\b(?:yang (?:ga|gak|ngga|nggak|enggak|tidak) setuju[:,]? (?:sini|boleh nangis)|berani (?:bantah|debat)|(?:bantah|debat) (?:gue|gua|aku) kalau berani)\b/u,
    /\b(?:sini kalau berani|silakan nangis|yang tersinggung berarti|gue tunggu yang baper|pasti (?:ke-?trigger|kepancing|ngamuk)|kebakaran jenggot|cry harder|cope harder|stay mad|prove me wrong)\b/u,
  ];
  const directedMockery = [
    /(?:\b(?:lu|lo|loe|elo|kamu|kalian|mereka|pendukung|fans|netizen|buzzer|orang)|@[a-z0-9_]{1,15}) (?:[a-z-]+ ){0,3}(?:bodoh|goblok|tolol|dungu|otak udang|sampah|idiot|clown)\b/u,
    /\b(?:bodoh|goblok|tolol|dungu|sampah|idiot|clown) (?:lu|lo|loe|elo|kamu|kalian|mereka|fans|pendukung|netizen)\b/u,
  ];
  const sweepingTarget = /\b(?:semua|seluruh|setiap|dasar|tipikal) (?:fans|pendukung|netizen|buzzer|orang|cowok|cewek|warga)\b/u;
  const emphasis = /[!?]{3,}|(?:\b[A-Z]{3,}\b\s+){2}\b[A-Z]{3,}\b/u;
  const rejectedQuote = /(\b(?:dilarang|jangan (?:tulis|bilang|komentar)|(?:melarang|mengecam) (?:ajakan|komentar|ucapan))\b[^.!?"“‘]{0,48})(?:"[^"]+"|“[^”]+”|‘[^’]+’)/giu;

  return (rawText, language = '') => {
    const formatted = normalizePostText(rawText).replace(rejectedQuote, '$1 ').trim();
    const text = formatted.toLowerCase();
    if (!text) return false;

    const tokens = text.match(/(?<![@#\w])[a-z]+\b/gu) ?? [];
    const markers = new Set(tokens.filter((token) => indonesianMarkers.has(token)));
    const strong = explicitBait.some((pattern) => pattern.test(text));
    if (!/^(?:id|in)(?:-|$)/iu.test(language) && markers.size < 2 && !strong) return false;

    if (strong) return true;

    const goading = provocation.some((pattern) => pattern.test(text));
    const mockery = directedMockery.some((pattern) => pattern.test(text));
    // Group mentions and emphasis only strengthen an existing behavioral signal.
    return (goading || mockery) &&
      (goading && mockery || sweepingTarget.test(text) || emphasis.test(formatted));
  };
})();
