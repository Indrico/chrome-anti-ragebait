const toggles = Object.keys(filterDefaults).map((id) => document.getElementById(id));
const statusMessage = document.getElementById('status');
const dataUse = document.getElementById('data-use');
const acceptDataUse = document.getElementById('accept-data-use');
const controls = document.getElementById('filter-controls');
const history = document.getElementById('history');
const blockedCount = document.getElementById('blocked-count');
const historyStatus = document.getElementById('history-status');
const blockHistory = document.getElementById('block-history');
const entryTemplate = document.getElementById('history-entry');
const formatCount = new Intl.NumberFormat('id-ID');
const formatTime = new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
const reasonLabels = { ragebait: 'Ragebait', politics: 'Politik', profanity: 'Umpatan', blueCheck: 'Centang biru' };
const siteLabels = { x: 'X', facebook: 'Facebook', instagram: 'Instagram', threads: 'Threads' };
let historyRequest = 0;

function showError(message) {
  statusMessage.textContent = message;
  statusMessage.hidden = false;
}

for (const toggle of toggles) {
  toggle.addEventListener('change', async () => {
    const requested = toggle.checked;
    toggle.disabled = true;
    statusMessage.hidden = true;
    try {
      await chrome.storage.local.set({ [toggle.id]: requested });
    } catch {
      toggle.checked = !requested;
      showError('Pengaturan gagal disimpan. Coba lagi.');
    } finally {
      toggle.disabled = false;
    }
  });
}

async function initializePopup(focusControls = false) {
  try {
    const settings = await chrome.storage.local.get([dataUseConsentKey, ...Object.keys(filterDefaults)]);
    if (settings[dataUseConsentKey] !== true) {
      dataUse.hidden = false;
      return;
    }
    for (const toggle of toggles) {
      toggle.checked = readFilterSetting(toggle.id, settings[toggle.id]);
      toggle.disabled = false;
    }
    dataUse.hidden = true;
    controls.hidden = false;
    history.hidden = false;
    if (focusControls) toggles[0].focus();
    void loadHistory();
  } catch {
    showError('Pengaturan gagal dibaca. Buka ulang popup.');
  }
}

acceptDataUse.addEventListener('click', async () => {
  acceptDataUse.disabled = true;
  statusMessage.hidden = true;
  try {
    await chrome.storage.local.set({ [dataUseConsentKey]: true });
    await initializePopup(true);
  } catch {
    showError('Persetujuan gagal disimpan. Coba lagi.');
  } finally {
    acceptDataUse.disabled = false;
  }
});

function createHistoryEntry(entry) {
  const row = entryTemplate.content.firstElementChild.cloneNode(true);
  row.dataset.key = entry.key;
  const site = entry.site ?? 'x';
  const author = entry.author ? (site === 'facebook' ? entry.author : `@${entry.author}`) : 'Unggahan';
  const label = reasonLabels[entry.reason];
  const reason = entry.term ? `${label} (${entry.term})` : label;
  row.querySelector('.entry-label').textContent = `${author} · ${reason}`;
  row.querySelector('.entry-site').textContent = siteLabels[site];
  const time = row.querySelector('time');
  time.dateTime = new Date(entry.blockedAt).toISOString();
  time.textContent = formatTime.format(entry.blockedAt);
  row.querySelector('.entry-excerpt').textContent = entry.excerpt || 'Unggahan tanpa teks.';
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
  if (message?.type === 'blocked:changed' && !history.hidden) void loadHistory();
});
void initializePopup();
