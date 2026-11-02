const pad = (n) => String(n).padStart(2, '0');

export const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const fromISO = (s) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};
export const todayISO = () => toISO(new Date());

export const daysUntil = (iso) => Math.round((fromISO(iso) - fromISO(todayISO())) / 86400000);

export function countdown(iso) {
  const n = daysUntil(iso);
  if (n === 0) return 'Hoy';
  if (n === 1) return 'Mañana';
  if (n === -1) return 'Ayer';
  if (n < 0) return `Hace ${-n} días`;
  return `En ${n} días`;
}

const fmt = (opts) => new Intl.DateTimeFormat('es-ES', opts);
export const shortDate = (iso) => fmt({ day: 'numeric', month: 'short' }).format(fromISO(iso));
export const longDate = (iso) => fmt({ weekday: 'long', day: 'numeric', month: 'long' }).format(fromISO(iso));
export const monthName = (d) => fmt({ month: 'long', year: 'numeric' }).format(d);
export const dayNum = (iso) => fromISO(iso).getDate();
export const monthShort = (iso) => fmt({ month: 'short' }).format(fromISO(iso)).replace('.', '');
export const clock = (t) => (t ? t.slice(0, 5) : '');

export function ago(ts) {
  const mins = Math.floor((Date.now() - new Date(ts)) / 60000);
  if (mins < 1) return 'ahora';
  if (mins < 60) return `hace ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'ayer';
  if (days < 7) return `hace ${days} días`;
  return shortDate(toISO(new Date(ts)));
}

export function monthGrid(year, month) {
  const first = new Date(year, month, 1);
  const offset = (first.getDay() + 6) % 7;
  return Array.from({ length: 42 }, (_, i) => new Date(year, month, 1 - offset + i));
}
