const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

// 'YYYY-MM-DD' for an instant, as seen in the given IANA timezone
const dayString = (date, timeZone) =>
  new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);

const validTimeZone = (tz) => {
  try { new Intl.DateTimeFormat('en-CA', { timeZone: tz }); return true; } catch { return false; }
};

const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

// Every day between two YYYY-MM-DD strings. Returns null if the range is too long to fill.
const eachDay = (from, to, max = 800) => {
  const start = Date.parse(`${from}T00:00:00Z`);
  const end   = Date.parse(`${to}T00:00:00Z`);
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return [];
  if ((end - start) / 86400000 + 1 > max) return null;
  const out = [];
  for (let t = start; t <= end; t += 86400000) out.push(new Date(t).toISOString().slice(0, 10));
  return out;
};

// Every month ('YYYY-MM') between two dates. Returns null if too long.
const eachMonth = (from, to, max = 240) => {
  let [y, m] = from.slice(0, 7).split('-').map(Number);
  const [ey, em] = to.slice(0, 7).split('-').map(Number);
  const out = [];
  while (y < ey || (y === ey && m <= em)) {
    if (out.length >= max) return null;
    out.push(`${y}-${String(m).padStart(2, '0')}`);
    m += 1;
    if (m > 12) { m = 1; y += 1; }
  }
  return out;
};

const assertDayRange = (from, to) => {
  const bad = (msg) => Object.assign(new Error(msg), { statusCode: 400 });
  for (const d of [from, to]) {
    if (d && (!DAY_RE.test(d) || Number.isNaN(Date.parse(`${d}T00:00:00Z`)))) {
      throw bad('Dates must be valid and in YYYY-MM-DD format');
    }
  }
  if (from && to && from > to) throw bad('"from" date must be on or before "to" date');
};

module.exports = { dayString, validTimeZone, escapeRegex, round2, eachDay, eachMonth, assertDayRange };
