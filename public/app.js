const STORAGE_KEY = 'valtier_whatsapp_webapp_token';

const state = {
  token: readStoredToken(),
  result: null,
  showInternal: false,
};

const elements = {
  appAlert: document.getElementById('appAlert'),
  loginView: document.getElementById('loginView'),
  viewerView: document.getElementById('viewerView'),
  loginForm: document.getElementById('loginForm'),
  accessCode: document.getElementById('accessCode'),
  loginButton: document.getElementById('loginButton'),
  loginError: document.getElementById('loginError'),
  logoutButton: document.getElementById('logoutButton'),
  sheetMeta: document.getElementById('sheetMeta'),
  searchForm: document.getElementById('searchForm'),
  phoneInput: document.getElementById('phoneInput'),
  searchButton: document.getElementById('searchButton'),
  showInternal: document.getElementById('showInternal'),
  profilePanel: document.getElementById('profilePanel'),
  chatAvatar: document.getElementById('chatAvatar'),
  chatTitle: document.getElementById('chatTitle'),
  chatSubtitle: document.getElementById('chatSubtitle'),
  chatCount: document.getElementById('chatCount'),
  messageList: document.getElementById('messageList'),
};

window.addEventListener('error', (event) => {
  showAppError(event.message || 'The page hit an unexpected browser error.');
});

window.addEventListener('unhandledrejection', (event) => {
  showAppError(getErrorMessage(event.reason));
});

elements.loginForm.addEventListener('submit', handleLogin);
elements.searchForm.addEventListener('submit', handleSearch);
elements.logoutButton.addEventListener('click', handleLogout);
elements.showInternal.addEventListener('change', () => {
  state.showInternal = elements.showInternal.checked;
  renderMessages();
});

bootstrap();

async function bootstrap() {
  if (!state.token) {
    showLogin();
    return;
  }

  try {
    const session = await apiGet('/api/session');
    renderSession(session);
    showViewer();
  } catch (error) {
    clearSession();
    showLogin(getErrorMessage(error));
  }
}

async function handleLogin(event) {
  event.preventDefault();
  setLoginBusy(true);
  hideAppError();
  elements.loginError.textContent = '';

  try {
    const result = await apiPost('/api/login', {
      accessCode: elements.accessCode.value,
    }, false);

    state.token = result.token;
    writeStoredToken(state.token);
    elements.accessCode.value = '';
    renderSession(result);
    showViewer();
  } catch (error) {
    const message = getErrorMessage(error);
    elements.loginError.textContent = message;
    showAppError(message);
  } finally {
    setLoginBusy(false);
  }
}

async function handleSearch(event) {
  event.preventDefault();
  const phone = elements.phoneInput.value.trim();

  if (!phone) {
    setSearchStatus('Enter a phone number.');
    return;
  }

  setSearchBusy(true);
  hideAppError();
  setSearchStatus('Searching chat history...');

  try {
    state.result = await apiPost('/api/search', { phone });
    renderSearchResult();
  } catch (error) {
    const message = getErrorMessage(error);
    setSearchStatus(message);
    showAppError(message);

    if (/session/i.test(message)) {
      clearSession();
      showLogin(message);
    }
  } finally {
    setSearchBusy(false);
  }
}

function handleLogout() {
  clearSession();
  showLogin();
}

function renderSession(session) {
  const mode = session.demoMode ? 'demo mode' : 'live Google Sheet';
  elements.sheetMeta.textContent = `Connected to ${session.sheetName || 'Hoja 1'} / ${mode}`;
}

function renderSearchResult() {
  const result = state.result;

  if (!result || !result.client) {
    renderNoMatch(result);
    return;
  }

  const client = result.client;
  elements.chatAvatar.textContent = getInitials(client.name);
  elements.chatTitle.textContent = client.name || 'Unknown client';
  elements.chatSubtitle.textContent = formatPhoneLine(client);
  setSearchStatus(`${result.stats.rowsMatched} matching rows found.`);

  elements.profilePanel.innerHTML = `
    <h2>${escapeHtml(client.name || 'Unknown client')}</h2>
    <div class="profile-lines">
      <div class="profile-line">
        <label>Phone digits</label>
        <strong>${escapeHtml(client.phoneDigits || '-')}</strong>
      </div>
      <div class="profile-line">
        <label>Local phone</label>
        <strong>${escapeHtml(client.phoneLocal || '-')}</strong>
      </div>
      <div class="profile-line">
        <label>Latest lead status</label>
        <strong>${escapeHtml(buildLeadLine(client))}</strong>
      </div>
    </div>
    <div class="chips">
      ${(client.refs || []).map((ref) => `<span class="chip">Ref ${escapeHtml(ref)}</span>`).join('')}
      <span class="chip">${result.stats.visibleMessages} messages</span>
      <span class="chip">${result.stats.rowsMatched} sheet rows</span>
    </div>
    <p id="searchStatus" class="status-line">${escapeHtml(result.stats.firstMessageAt || '')}${result.stats.lastMessageAt ? ' to ' + escapeHtml(result.stats.lastMessageAt) : ''}</p>
    <button class="button" type="button" data-copy-phone="${escapeHtml(client.phoneDigits || client.phoneLocal || '')}">Copy phone</button>
  `;

  const copyButton = elements.profilePanel.querySelector('[data-copy-phone]');

  if (copyButton) {
    copyButton.addEventListener('click', copyPhone);
  }

  renderMessages();
}

function renderNoMatch(result) {
  const query = result ? result.rawPhone : '';

  elements.chatAvatar.textContent = 'V';
  elements.chatTitle.textContent = 'No conversation found';
  elements.chatSubtitle.textContent = query ? `No rows for ${query}` : 'Waiting for a phone search';
  elements.chatCount.textContent = '0 messages';
  elements.profilePanel.innerHTML = `
    <h2>No match found</h2>
    <p class="muted">Try the international format, local format, or digits only.</p>
    <p id="searchStatus" class="status-line">${escapeHtml(query || '')}</p>
  `;
  elements.messageList.innerHTML = `
    <div class="empty-state">
      <div class="empty-state-box">
        <h2>No rows matched</h2>
        <p class="muted">The search checked phone_digits and phone_local.</p>
      </div>
    </div>
  `;
}

function renderMessages() {
  const result = state.result;

  if (!result || !result.messages || !result.messages.length) {
    return;
  }

  const messages = result.messages.filter((message) => state.showInternal || !message.isInternal);
  const hiddenInternal = result.messages.length - messages.length;

  elements.chatCount.textContent = `${messages.length} shown${hiddenInternal ? ` / ${hiddenInternal} hidden` : ''}`;

  if (!messages.length) {
    elements.messageList.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-box">
          <h2>No visible chat messages</h2>
          <p class="muted">Internal records are hidden by the current filter.</p>
        </div>
      </div>
    `;
    return;
  }

  let lastDate = '';
  const html = messages.map((message) => {
    const divider = message.dateDisplay && message.dateDisplay !== lastDate
      ? `<div class="day-divider">${escapeHtml(message.dateDisplay)}</div>`
      : '';
    lastDate = message.dateDisplay || lastDate;

    return `
      ${divider}
      <div class="message-row ${escapeHtml(message.role)}">
        <article class="bubble">
          <div class="bubble-label">${escapeHtml(message.label)}</div>
          <div class="bubble-text">${linkify(message.text)}</div>
          <div class="bubble-meta">
            ${message.leadCategory ? `<span>${escapeHtml(message.leadCategory)}</span>` : ''}
            ${message.leadScore ? `<span>Score ${escapeHtml(message.leadScore)}</span>` : ''}
            <span>${escapeHtml(message.timeDisplay || message.timestampDisplay || '')}</span>
          </div>
        </article>
      </div>
    `;
  }).join('');

  elements.messageList.innerHTML = html;
  requestAnimationFrame(() => {
    elements.messageList.scrollTop = elements.messageList.scrollHeight;
  });
}

async function apiGet(url) {
  const response = await fetch(url, {
    headers: buildHeaders(),
  });
  return parseResponse(response);
}

async function apiPost(url, body, includeAuth = true) {
  const response = await fetch(url, {
    method: 'POST',
    headers: buildHeaders(includeAuth),
    body: JSON.stringify(body || {}),
  });
  return parseResponse(response);
}

function buildHeaders(includeAuth = true) {
  const headers = {
    'Content-Type': 'application/json',
  };

  if (includeAuth && state.token) {
    headers.Authorization = `Bearer ${state.token}`;
  }

  return headers;
}

async function parseResponse(response) {
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || `Request failed with status ${response.status}`);
  }

  return data;
}

function showLogin(errorMessage) {
  elements.viewerView.classList.add('hidden');
  elements.loginView.classList.remove('hidden');
  elements.loginError.textContent = errorMessage || '';

  if (errorMessage) {
    showAppError(errorMessage);
  }

  setTimeout(() => elements.accessCode.focus(), 50);
}

function showViewer() {
  hideAppError();
  elements.loginView.classList.add('hidden');
  elements.viewerView.classList.remove('hidden');
  setTimeout(() => elements.phoneInput.focus(), 50);
}

function clearSession() {
  state.token = '';
  state.result = null;
  removeStoredToken();
}

function setLoginBusy(isBusy) {
  elements.loginButton.disabled = isBusy;
  elements.accessCode.disabled = isBusy;
  elements.loginButton.textContent = isBusy ? 'Opening...' : 'Open viewer';
}

function setSearchBusy(isBusy) {
  elements.searchButton.disabled = isBusy;
  elements.phoneInput.disabled = isBusy;
  elements.searchButton.textContent = isBusy ? 'Searching...' : 'Search';
}

function setSearchStatus(message) {
  const target = document.getElementById('searchStatus');

  if (target) {
    target.textContent = message || '';
  }
}

function copyPhone(event) {
  const phone = event.currentTarget.dataset.copyPhone || '';

  if (!phone) {
    return;
  }

  if (!navigator.clipboard) {
    setSearchStatus(phone);
    return;
  }

  navigator.clipboard
    .writeText(phone)
    .then(() => setSearchStatus('Phone copied.'))
    .catch(() => setSearchStatus(phone));
}

function formatPhoneLine(client) {
  const parts = [client.phoneDigits, client.phoneLocal].filter(Boolean);
  return parts.length ? parts.join(' / ') : 'Phone not available';
}

function buildLeadLine(client) {
  const parts = [client.latestLeadCategory, client.latestLeadScore ? `Score ${client.latestLeadScore}` : '']
    .filter(Boolean);

  return parts.length ? parts.join(' / ') : '-';
}

function getInitials(name) {
  const initials = String(name || 'V')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');

  return initials || 'V';
}

function getErrorMessage(error) {
  if (!error) {
    return 'Something went wrong.';
  }

  if (typeof error === 'string') {
    return error;
  }

  return error.message || error.toString();
}

function readStoredToken() {
  try {
    return localStorage.getItem(STORAGE_KEY) || '';
  } catch (error) {
    return '';
  }
}

function writeStoredToken(token) {
  try {
    localStorage.setItem(STORAGE_KEY, token);
  } catch (error) {
    console.warn(error);
  }
}

function removeStoredToken() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.warn(error);
  }
}

function showAppError(message) {
  if (!elements.appAlert || !message) {
    return;
  }

  elements.appAlert.textContent = message;
  elements.appAlert.classList.remove('hidden');
}

function hideAppError() {
  if (!elements.appAlert) {
    return;
  }

  elements.appAlert.textContent = '';
  elements.appAlert.classList.add('hidden');
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function linkify(value) {
  const escaped = escapeHtml(value);
  const urlPattern = /(https?:\/\/[^\s<]+)/g;

  return escaped.replace(urlPattern, (url) => {
    const safeUrl = url.replace(/&amp;/g, '&');
    return `<a href="${url}" target="_blank" rel="noopener">${safeUrl}</a>`;
  });
}
