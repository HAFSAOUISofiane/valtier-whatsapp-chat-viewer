function normalizePhone(value) {
  return String(value || '')
    .replace(/^00/, '')
    .replace(/\D/g, '');
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

module.exports = {
  normalizePhone,
  phoneMatches,
};
