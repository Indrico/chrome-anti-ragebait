const toggle = document.getElementById('enabled');
const statusMessage = document.getElementById('status');
const blockedCount = document.getElementById('blocked-count');
const historyStatus = document.getElementById('history-status');
const blockHistory = document.getElementById('block-history');
const entryTemplate = document.getElementById('history-entry');
const formatCount = new Intl.NumberFormat('id-ID');
const formatTime = new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
let historyRequest = 0;

function showError(message) {
  statusMessage.textContent = message;
  statusMessage.hidden = false;
}

toggle.addEventListener('change', async () => {
  const requested = toggle.checked;
  toggle.disabled = true;
  statusMessage.hidden = true;
  try {
    await chrome.storage.local.set({ enabled: requested });
  } catch {
    toggle.checked = !requested;
    showError('Pengaturan gagal disimpan. Coba lagi.');
  } finally {
    toggle.disabled = false;
  }
});

async function initializeToggle() {
  try {
    const { enabled } = await chrome.storage.local.get('enabled');
    toggle.checked = enabled !== false;
    toggle.disabled = false;
  } catch {
    showError('Pengaturan gagal dibaca. Buka ulang popup.');
  }
}

void initializeToggle();

function createHistoryEntry(entry) {
  const row = entryTemplate.content.firstElementChild.cloneNode(true);
  row.dataset.key = entry.key;
  const author = entry.author ? `@${entry.author}` : 'Unggahan X';
  const reason = entry.reason === 'politics' ? `Politik (${entry.term})` : 'Ragebait';
  row.querySelector('.entry-label').textContent = `${author} · ${reason}`;
  const time = row.querySelector('time');
  time.dateTime = new Date(entry.blockedAt).toISOString();
  time.textContent = formatTime.format(entry.blockedAt);
  row.querySelector('.entry-excerpt').textContent = entry.excerpt;
  return row;
}

function renderHistory({ total, recent }) {
  blockedCount.textContent = `${formatCount.format(total)} unggahan unik diblokir`;
  historyStatus.hidden = recent.length > 0;
  historyStatus.textContent = 'Belum ada unggahan yang diblokir.';

  const existingRows = new Map([...blockHistory.children].map((row) => [row.dataset.key, row]));
  recent.forEach((entry, index) => {
    const row = existingRows.get(entry.key) ?? createHistoryEntry(entry);
    const current = blockHistory.children[index] ?? null;
    if (row !== current) blockHistory.insertBefore(row, current);
  });
  while (blockHistory.children.length > recent.length) blockHistory.lastElementChild.remove();
}

async function loadHistory() {
  const request = ++historyRequest;
  try {
    const result = await chrome.runtime.sendMessage({ type: 'blocked:read' });
    if (!result?.ok) throw new Error('History unavailable');
    if (request === historyRequest) renderHistory(result);
  } catch {
    if (request !== historyRequest) return;
    blockedCount.textContent = 'Jumlah unggahan tidak tersedia.';
    historyStatus.textContent = 'Riwayat gagal dimuat.';
    historyStatus.hidden = false;
  }
}

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === 'blocked:changed') void loadHistory();
});
void loadHistory();
