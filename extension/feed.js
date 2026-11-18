(() => {
  const adapter = feedAdapters[location.hostname.replace(/^www\./u, '')];
  if (!adapter) return;
  const activeAttribute = 'data-anti-ragebait-active';
  const stateAttribute = 'data-anti-ragebait-state';
  const markedCard = `[${stateAttribute}]`;
  const candidateCards = `${adapter.card}, ${markedCard}`;
  const pendingCards = new Map();
  const settings = { enabled: true, politicsEnabled: true };
  const settingKeys = Object.keys(settings);
  const changesDuringLoad = {};

  let settingsReady = false;
  let activeSurface = null;
  let frameId = 0;
  const observer = new MutationObserver(handleMutations);

  function findTermMatch(texts, findTerm, reason) {
    for (const { normalizedText } of texts) {
      const term = findTerm(normalizedText);
      if (term) return { reason, term, normalizedText };
    }
    return null;
  }

  function getBlockDecision({ id, author, texts: parts }) {
    const texts = parts.map((text) => ({ ...text, normalizedText: normalizePostText(text.rawText) }));
    let match = findTermMatch(texts, findProfanityTerm, 'profanity');
    if (!match && activeSurface === 'home') {
      if (settings.politicsEnabled) {
        match = findTermMatch(texts, findPoliticalName, 'politics') ??
          findTermMatch(texts, findPoliticalTerm, 'politics');
      }
      if (!match) {
        const ragebait = texts.find(({ rawText, language }) => isIndonesianRagebait(rawText, language));
        if (ragebait) match = { reason: 'ragebait', term: null, normalizedText: ragebait.normalizedText };
      }
    }
    if (!match) return null;

    const { reason, term, normalizedText } = match;
    const preview = normalizedText.slice(0, 180);
    return {
      site: adapter.site,
      id: id ?? null,
      author: author ?? null,
      reason,
      term,
      excerpt: normalizedText.length > preview.length ? `${preview}…` : preview,
      fallbackText: id ? null : texts.map((text) => text.normalizedText).join('\n').slice(0, 4096),
    };
  }

  async function recordBlockedPosts(posts) {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'blocked:record', posts });
      if (!response?.ok) throw new Error('Recording failed');
    } catch {
      console.warn('Anti-Ragebait tidak dapat mencatat seluruh pemblokiran.');
    }
  }

  function scheduleBatch() {
    if (settingsReady && pendingCards.size && !frameId) {
      frameId = requestAnimationFrame(processBatch);
    }
  }

  function processBatch() {
    frameId = 0;
    const deadline = performance.now() + 6;
    const blockedPosts = [];
    for (const [card, post] of pendingCards) {
      pendingCards.delete(card);
      if (canReadCard(card)) {
        const decision = getBlockDecision(post);
        card.setAttribute(stateAttribute, decision ? 'blocked' : 'visible');
        if (decision) blockedPosts.push(decision);
      } else {
        card.removeAttribute(stateAttribute);
      }
      if (performance.now() >= deadline) break;
    }
    if (blockedPosts.length) void recordBlockedPosts(blockedPosts);
    scheduleBatch();
  }

  function canReadCard(card) {
    if (!card.isConnected || !card.matches(adapter.card)) return false;
    if (adapter.scope && !card.closest(adapter.scope)) return false;
    if (!adapter.excluded) return true;
    return !card.closest(adapter.excluded) && !card.parentElement?.closest(adapter.card);
  }

  function queueCard(card) {
    const readable = canReadCard(card);
    const post = readable ? adapter.read(card) : null;
    if (!post?.texts.length) {
      pendingCards.delete(card);
      if (adapter.site === 'x' && readable) card.setAttribute(stateAttribute, 'visible');
      else card.removeAttribute(stateAttribute);
      return;
    }
    card.setAttribute(stateAttribute, 'pending');
    pendingCards.set(card, post);
    scheduleBatch();
  }

  function containsPostContent(node) {
    return node instanceof Element &&
      (node.matches(adapter.content) || node.querySelector(adapter.content));
  }

  function collectCards(root, cards) {
    if (root.matches(candidateCards)) cards.add(root);
    for (const card of root.querySelectorAll(candidateCards)) cards.add(card);
  }

  function handleMutations(records) {
    const cards = new Set();
    for (const record of records) {
      const target = record.target instanceof Element ? record.target : record.target.parentElement;
      if (!target) continue;
      let card = target.closest(adapter.card) ?? target.closest(markedCard);
      if (adapter.excluded && card) {
        // Text arriving inside a shared post is part of the outer feed card.
        let parentCard = card.parentElement?.closest(adapter.card);
        while (parentCard) {
          card = parentCard;
          parentCard = card.parentElement?.closest(adapter.card);
        }
      }
      if (record.type === 'attributes') {
        if (card) cards.add(card);
        else collectCards(target, cards);
        continue;
      }

      if (adapter.excluded && target.closest(adapter.excluded)) continue;
      if (card && (target.closest(adapter.content) ||
          [...record.addedNodes, ...record.removedNodes].some(containsPostContent))) {
        cards.add(card);
      }
      for (const node of record.addedNodes) {
        if (node instanceof Element) collectCards(node, cards);
      }
    }
    for (const card of cards) queueCard(card);
  }

  function refreshActivation() {
    const root = document.documentElement;
    if (!root) return;
    const path = location.pathname.replace(/\/$/u, '') || '/';
    const nextSurface = settings.enabled ? adapter.surface(path) : null;
    if (activeSurface === nextSurface) return;

    observer.disconnect();
    cancelAnimationFrame(frameId);
    frameId = 0;
    pendingCards.clear();

    activeSurface = nextSurface;
    if (!activeSurface) {
      root.removeAttribute(activeAttribute);
      root.querySelectorAll(markedCard).forEach((card) => card.removeAttribute(stateAttribute));
      return;
    }

    root.setAttribute(activeAttribute, adapter.site);
    observer.observe(root, {
      childList: true,
      subtree: true,
      characterData: true,
      attributeFilter: adapter.site === 'x' ? ['lang', 'data-testid', 'href'] : [
        'lang', 'dir', 'role', 'href', 'hidden', 'aria-hidden', 'aria-modal', 'contenteditable',
        'data-testid', 'data-caption', 'data-pagelet', 'data-pressable-container', 'data-text-post-text',
        'data-ad-preview', 'data-ad-comet-preview', 'data-ad-rendering-role',
      ],
    });
    root.querySelectorAll(candidateCards).forEach(queueCard);
  }

  function applySettings(updatedSettings) {
    const previousSurface = activeSurface;
    const previousPoliticsEnabled = settings.politicsEnabled;
    Object.assign(settings, updatedSettings);
    refreshActivation();
    if (previousSurface === 'home' && activeSurface === 'home' &&
        previousPoliticsEnabled !== settings.politicsEnabled) {
      document.querySelectorAll(adapter.card).forEach(queueCard);
    }
  }

  if (document.documentElement) {
    refreshActivation();
  } else {
    const rootObserver = new MutationObserver(() => {
      if (!document.documentElement) return;
      rootObserver.disconnect();
      refreshActivation();
    });
    rootObserver.observe(document, { childList: true });
  }
  navigation.addEventListener('currententrychange', refreshActivation);

  chrome.storage.local.onChanged.addListener((changes) => {
    if (!changes.enabled && !changes.politicsEnabled) return;
    const updatedSettings = {};
    for (const key of settingKeys) {
      if (changes[key]) updatedSettings[key] = changes[key].newValue !== false;
    }
    if (!settingsReady) Object.assign(changesDuringLoad, updatedSettings);
    applySettings(updatedSettings);
  });

  async function loadSettings() {
    let storedSettings;
    try {
      const stored = await chrome.storage.local.get(settingKeys);
      storedSettings = { enabled: stored.enabled !== false, politicsEnabled: stored.politicsEnabled !== false };
    } catch (error) {
      storedSettings = { enabled: false };
      console.warn('Anti-Ragebait tidak dapat membaca pengaturan.', error);
    }
    applySettings({ ...storedSettings, ...changesDuringLoad });
    settingsReady = true;
    scheduleBatch();
  }

  void loadSettings();
})();
