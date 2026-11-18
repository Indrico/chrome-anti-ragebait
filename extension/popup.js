const toggle = document.getElementById('enabled');
const statusMessage = document.getElementById('status');

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
