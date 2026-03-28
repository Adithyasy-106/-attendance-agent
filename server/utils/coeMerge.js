/**
 * Merge PDF/client COE rows with registry fallback; dedupe conservatively.
 */
function eventKey(e) {
  const name = String(e.name || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .slice(0, 42);
  return `${e.isoDate || ''}|${e.isoEndDate || ''}|${e.type || ''}|${name}`;
}

function mergeCoeEvents(clientList, registryList) {
  const seen = new Set();
  const out = [];
  const add = (e) => {
    if (!e || !e.isoDate) return;
    const k = eventKey(e);
    if (seen.has(k)) return;
    seen.add(k);
    out.push({
      name: e.name,
      date: e.date || e.isoDate,
      type: e.type || 'Academic',
      isoDate: e.isoDate,
      isoEndDate: e.isoEndDate || null,
      source: e.source || 'merged',
    });
  };
  for (const e of clientList || []) add(e);
  for (const e of registryList || []) add(e);
  return out.sort((a, b) => String(a.isoDate).localeCompare(String(b.isoDate)));
}

module.exports = { mergeCoeEvents };
