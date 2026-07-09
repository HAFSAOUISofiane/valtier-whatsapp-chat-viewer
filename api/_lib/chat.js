const { normalizePhone, phoneMatches } = require('./phone');

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

module.exports = {
  buildChatResult,
};
