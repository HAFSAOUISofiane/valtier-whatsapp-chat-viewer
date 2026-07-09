const STATIC_ACCESS_CODE = 'test';
const STORAGE_KEY = 'valtier_whatsapp_pages_session';
const DB_NAME = 'valtier_whatsapp_viewer';
const DB_STORE = 'snapshots';
const SNAPSHOT_KEY = 'latest';

const state = {
  isLoggedIn: readStoredSession(),
  values: [],
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
  snapshotPanel: document.getElementById('snapshotPanel'),
  snapshotFile: document.getElementById('snapshotFile'),
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
elements.logoutButton.addEventListener('click', handleLogout);
elements.searchForm.addEventListener('submit', handleSearch);
elements.snapshotFile.addEventListener('change', handleSnapshotUpload);
elements.showInternal.addEventListener('change', () => {
  state.showInternal = elements.showInternal.checked;
  renderMessages();
});

bootstrap();

async function bootstrap() {
  if (!state.isLoggedIn) {
    showLogin();
    return;
  }

  showViewer();
  await loadCachedSnapshot();
}

async function handleLogin(event) {
  event.preventDefault();
  const accessCode = elements.accessCode.value.trim();

  if (accessCode !== STATIC_ACCESS_CODE) {
    elements.loginError.textContent = 'The access code is not valid.';
    return;
  }

  state.isLoggedIn = true;
  writeStoredSession();
  elements.accessCode.value = '';
  elements.loginError.textContent = '';
  showViewer();
  await loadCachedSnapshot();
}

function handleLogout() {
  state.isLoggedIn = false;
  state.values = [];
  state.result = null;
  removeStoredSession();
  showLogin();
}

async function handleSnapshotUpload(event) {
  const file = event.target.files && event.target.files[0];

  if (!file) {
    return;
  }

  hideAppError();
  setSearchStatus('Reading CSV snapshot...');

  try {
    const csvText = await file.text();
    loadCsvText(csvText, file.name);
    await saveCachedSnapshot(csvText, file.name);
    setSearchStatus(`Loaded ${Math.max(state.values.length - 1, 0)} rows from ${file.name}.`);
  } catch (error) {
    const message = getErrorMessage(error);
    setSearchStatus(message);
    showAppError(message);
  } finally {
    event.target.value = '';
  }
}

function handleSearch(event) {
  event.preventDefault();
  const phone = elements.phoneInput.value.trim();

  hideAppError();

  if (!state.values.length) {
    setSearchStatus('Upload the CSV snapshot first.');
    showAppError('Upload the CSV snapshot first. The GitHub Pages version cannot read the private Google Sheet directly.');
    return;
  }

  if (!phone) {
    setSearchStatus('Enter a phone number.');
    return;
  }

  try {
    state.result = buildChatResult(state.values, phone);
    renderSearchResult();
  } catch (error) {
    const message = getErrorMessage(error);
    setSearchStatus(message);
    showAppError(message);
  }
}

async function loadCachedSnapshot() {
  try {
    const cached = await readCachedSnapshot();

    if (!cached || !cached.csvText) {
      renderSnapshotState(null);
      return;
    }

    loadCsvText(cached.csvText, cached.fileName || 'cached CSV');
    setSearchStatus(`Loaded cached CSV snapshot with ${Math.max(state.values.length - 1, 0)} rows.`);
  } catch (error) {
    renderSnapshotState(null);
  }
}

function loadCsvText(csvText, fileName) {
  if (!csvText.slice(0, 500).includes('phone_digits')) {
    throw new Error('This CSV does not look like the WhatsApp Chat History export. Expected a phone_digits column.');
  }

  state.values = parseCsv(csvText);
  renderSnapshotState(fileName);
}

function renderSnapshotState(fileName) {
  const hasData = state.values.length > 1;
  elements.snapshotPanel.classList.toggle('hidden', hasData);
  elements.sheetMeta.textContent = hasData
    ? `Browser-only mode / ${Math.max(state.values.length - 1, 0)} rows loaded${fileName ? ` / ${fileName}` : ''}`
    : 'Browser-only mode / upload CSV to search';

  if (!hasData) {
    elements.chatTitle.textContent = 'Client conversation';
    elements.chatSubtitle.textContent = 'Waiting for a CSV upload';
  }
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
        <p class="muted">The search checked phone_digits and phone_local in the uploaded CSV.</p>
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

function buildChatResult(values, rawPhone) {
  const normalizedQuery = normalizePhone(rawPhone);

  if (normalizedQuery.length < 6) {
    throw new Error('Enter at least 6 phone digits.');
  }

  if (!values || values.length < 2) {
    return emptyResult(normalizedQuery, rawPhone);
  }

  const headers = values[0].map((header) => String(header || '').trim());
  const headerIndex = buildHeaderIndex(headers);
  const matchedRows = [];

  values.slice(1).forEach((row, offset) => {
    const record = rowToRecord(row, headerIndex);

    if (phoneMatches(normalizedQuery, record.phone_digits, record.phone_local)) {
      matchedRows.push({
        rowNumber: 2 + offset,
        record,
      });
    }
  });

  if (!matchedRows.length) {
    return emptyResult(normalizedQuery, rawPhone);
  }

  const messages = buildMessages(matchedRows);
  const client = buildClientSummary(matchedRows, messages);
  const visibleMessages = messages.filter((message) => !message.isInternal);
  const internalMessages = messages.filter((message) => message.isInternal);

  return {
    normalizedQuery,
    rawPhone,
    client,
    messages,
    stats: {
      rowsMatched: matchedRows.length,
      messages: messages.length,
      visibleMessages: visibleMessages.length,
      internalMessages: internalMessages.length,
      firstMessageAt: visibleMessages.length ? visibleMessages[0].timestampDisplay : '',
      lastMessageAt: visibleMessages.length ? visibleMessages[visibleMessages.length - 1].timestampDisplay : '',
    },
  };
}

function buildMessages(matchedRows) {
  const messages = [];

  matchedRows.forEach((item) => {
    const record = item.record;
    const timestamp = record.timestamp || '';
    const clientText = normalizeMessageText(record.message || record.message_es);
    const assistantText = normalizeMessageText(record.ai_reply);
    const timestampValue = timestampToMillis(timestamp);

    if (clientText) {
      messages.push(buildMessage({
        role: 'client',
        label: 'Client',
        text: clientText,
        timestamp,
        timestampValue,
        rowNumber: item.rowNumber,
        sequence: 0,
        record,
        isInternal: false,
      }));
    }

    if (assistantText) {
      const isInternal = isInternalMessage(assistantText);

      messages.push(buildMessage({
        role: isInternal ? 'internal' : 'assistant',
        label: isInternal ? 'Internal record' : 'Valtiera',
        text: assistantText,
        timestamp,
        timestampValue,
        rowNumber: item.rowNumber,
        sequence: clientText ? 1 : 0,
        record,
        isInternal,
      }));
    }
  });

  return messages.sort((left, right) => {
    if (left.timestampValue !== right.timestampValue) {
      return left.timestampValue - right.timestampValue;
    }

    if (left.rowNumber !== right.rowNumber) {
      return left.rowNumber - right.rowNumber;
    }

    return left.sequence - right.sequence;
  });
}

function buildMessage(input) {
  return {
    id: `${input.rowNumber}:${input.sequence}`,
    role: input.role,
    label: input.label,
    text: input.text,
    timestamp: input.timestamp,
    timestampValue: input.timestampValue,
    timestampDisplay: formatTimestamp(input.timestamp),
    dateDisplay: formatDateOnly(input.timestamp),
    timeDisplay: formatTimeOnly(input.timestamp),
    rowNumber: input.rowNumber,
    sequence: input.sequence,
    isInternal: input.isInternal,
    leadScore: input.record.LeadScore || '',
    leadCategory: input.record.LeadCategory || '',
  };
}

function buildClientSummary(matchedRows, messages) {
  const first = matchedRows[0].record;
  const latest = matchedRows[matchedRows.length - 1].record;
  const clientName = chooseClientName(matchedRows);
  const refs = extractRefs(messages.map((message) => message.text).join('\n'));

  return {
    name: clientName || 'Unknown client',
    phoneDigits: first.phone_digits || '',
    phoneLocal: first.phone_local || '',
    latestLeadScore: latest.LeadScore || '',
    latestLeadCategory: latest.LeadCategory || '',
    refs,
  };
}

function emptyResult(normalizedQuery, rawPhone) {
  return {
    normalizedQuery,
    rawPhone,
    client: null,
    messages: [],
    stats: {
      rowsMatched: 0,
      messages: 0,
      visibleMessages: 0,
      internalMessages: 0,
      firstMessageAt: '',
      lastMessageAt: '',
    },
  };
}

function rowToRecord(row, headerIndex) {
  return {
    phone_digits: valueByHeader(row, headerIndex, 'phone_digits'),
    phone_local: valueByHeader(row, headerIndex, 'phone_local'),
    wa_name: valueByHeader(row, headerIndex, 'wa_name'),
    direction: valueByHeader(row, headerIndex, 'direction'),
    message: valueByHeader(row, headerIndex, 'message'),
    ai_reply: valueByHeader(row, headerIndex, 'ai_reply'),
    timestamp: valueByHeader(row, headerIndex, 'timestamp'),
    LeadScore: valueByHeader(row, headerIndex, 'LeadScore'),
    LeadCategory: valueByHeader(row, headerIndex, 'LeadCategory'),
    LeadReason: valueByHeader(row, headerIndex, 'LeadReason'),
    message_es: valueByHeader(row, headerIndex, 'message_es'),
    client_lang: valueByHeader(row, headerIndex, 'client_lang'),
  };
}

function buildHeaderIndex(headers) {
  return headers.reduce((index, header, position) => {
    index[String(header || '').trim().toLowerCase()] = position;
    return index;
  }, {});
}

function valueByHeader(row, headerIndex, headerName) {
  const position = headerIndex[String(headerName || '').trim().toLowerCase()];

  if (position === undefined || position === null) {
    return '';
  }

  return String(row[position] || '').trim();
}

function parseCsv(csvText) {
  const rows = [];
  let row = [];
  let value = '';
  let inQuotes = false;

  for (let index = 0; index < csvText.length; index += 1) {
    const char = csvText[index];
    const nextChar = csvText[index + 1];

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        value += '"';
        index += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        value += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      row.push(value);
      value = '';
    } else if (char === '\n') {
      row.push(value);
      rows.push(row);
      row = [];
      value = '';
    } else if (char !== '\r') {
      value += char;
    }
  }

  if (value || row.length) {
    row.push(value);
    rows.push(row);
  }

  return rows.map((csvRow) => csvRow.slice(0, 12));
}

function phoneMatches(queryDigits, phoneDigits, phoneLocal) {
  const full = normalizePhone(phoneDigits);
  const local = normalizePhone(phoneLocal);
  const queryLocal = queryDigits.length > 9 ? queryDigits.slice(-9) : queryDigits;
  const candidates = [full, local];

  if (full.length >= 9) {
    candidates.push(full.slice(-9));
  }

  if (local && full.startsWith('34')) {
    candidates.push(`34${local}`);
  }

  return candidates
    .filter(Boolean)
    .some((candidate) => candidate === queryDigits || candidate === queryLocal);
}

function normalizePhone(value) {
  return String(value || '')
    .replace(/^00/, '')
    .replace(/\D/g, '');
}

function normalizeMessageText(text) {
  return String(text || '')
    .replace(/\r\n/g, '\n')
    .replace(/\n{4,}/g, '\n\n\n')
    .trim();
}

function isInternalMessage(text) {
  const normalized = String(text || '').trim();

  return [
    /^Contexto interno:/i,
    /^\*?Accion CRM\*?:/i,
    /^\*?Acción CRM\*?:/i,
    /^ACTIVE_SOLICITUD_CONTEXT_JSON=/i,
    /^CRM_/i,
  ].some((pattern) => pattern.test(normalized));
}

function chooseClientName(matchedRows) {
  const names = matchedRows
    .map((item) => item.record.wa_name)
    .filter(Boolean)
    .filter((name) => !/valtier/i.test(name));

  return names[0] || (matchedRows[0] && matchedRows[0].record.wa_name) || '';
}

function extractRefs(text) {
  const refs = {};
  const regex = /(?:ref(?:erencia)?\.?\s*:?\s*|ref-)(\d{3,6})/gi;
  let match;

  while ((match = regex.exec(text)) !== null) {
    refs[match[1]] = true;
  }

  return Object.keys(refs).slice(0, 12);
}

function timestampToMillis(timestamp) {
  const parsed = Date.parse(timestamp);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function formatTimestamp(timestamp) {
  const date = parseTimestamp(timestamp);

  if (!date) {
    return timestamp || '';
  }

  return new Intl.DateTimeFormat('es-ES', {
    timeZone: 'Europe/Madrid',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function formatDateOnly(timestamp) {
  const date = parseTimestamp(timestamp);

  if (!date) {
    return '';
  }

  return new Intl.DateTimeFormat('es-ES', {
    timeZone: 'Europe/Madrid',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function formatTimeOnly(timestamp) {
  const date = parseTimestamp(timestamp);

  if (!date) {
    return '';
  }

  return new Intl.DateTimeFormat('es-ES', {
    timeZone: 'Europe/Madrid',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function parseTimestamp(timestamp) {
  if (!timestamp) {
    return null;
  }

  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? null : date;
}

function showLogin(errorMessage) {
  elements.viewerView.classList.add('hidden');
  elements.loginView.classList.remove('hidden');
  elements.loginError.textContent = errorMessage || '';
  setTimeout(() => elements.accessCode.focus(), 50);
}

function showViewer() {
  hideAppError();
  elements.loginView.classList.add('hidden');
  elements.viewerView.classList.remove('hidden');
  setTimeout(() => elements.phoneInput.focus(), 50);
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

function readStoredSession() {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true';
  } catch (error) {
    return false;
  }
}

function writeStoredSession() {
  try {
    localStorage.setItem(STORAGE_KEY, 'true');
  } catch (error) {
    console.warn(error);
  }
}

function removeStoredSession() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.warn(error);
  }
}

function openSnapshotDb() {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      reject(new Error('IndexedDB is not available in this browser.'));
      return;
    }

    const request = indexedDB.open(DB_NAME, 1);

    request.onupgradeneeded = () => {
      request.result.createObjectStore(DB_STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function saveCachedSnapshot(csvText, fileName) {
  try {
    const db = await openSnapshotDb();
    const tx = db.transaction(DB_STORE, 'readwrite');
    tx.objectStore(DB_STORE).put({
      csvText,
      fileName,
      savedAt: new Date().toISOString(),
    }, SNAPSHOT_KEY);
    await waitForTransaction(tx);
    db.close();
  } catch (error) {
    console.warn(error);
  }
}

async function readCachedSnapshot() {
  const db = await openSnapshotDb();
  const tx = db.transaction(DB_STORE, 'readonly');
  const store = tx.objectStore(DB_STORE);
  const result = await new Promise((resolve, reject) => {
    const request = store.get(SNAPSHOT_KEY);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return result;
}

function waitForTransaction(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
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
