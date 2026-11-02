import { EVENT_KINDS } from '../people.js';

const compact = (iso) => iso.replaceAll('-', '');
const nextDay = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  const n = new Date(Date.UTC(y, m - 1, d + 1));
  return n.toISOString().slice(0, 10);
};
const addHour = (time) => {
  const [h, m] = time.split(':').map(Number);
  return `${String(Math.min(h + 1, 23)).padStart(2, '0')}${String(m).padStart(2, '0')}00`;
};
const timeParts = (time) => time.slice(0, 5).replace(':', '') + '00';

export function eventTitle(event, subject) {
  const prefix = event.kind === 'otro' ? '' : `${EVENT_KINDS[event.kind].label}: `;
  return `${prefix}${event.title}${subject ? ` (${subject.name})` : ''}`;
}

export function googleLink(event, subject) {
  const dates = event.time
    ? `${compact(event.date)}T${timeParts(event.time)}/${compact(event.date)}T${addHour(event.time)}`
    : `${compact(event.date)}/${compact(nextDay(event.date))}`;
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: eventTitle(event, subject),
    dates,
    ctz: 'Europe/Madrid',
    details: event.notes || 'Añadido desde El Estuche',
  });
  return `https://calendar.google.com/calendar/render?${params}`;
}

const esc = (v) => String(v ?? '').replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');

export function buildICS(events, subjects) {
  const stamp = new Date().toISOString().replace(/[-:]|\.\d+/g, '');
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//El Estuche//ES', 'CALSCALE:GREGORIAN'];
  for (const e of events) {
    const subject = subjects.find((s) => s.id === e.subject_id);
    lines.push('BEGIN:VEVENT', `UID:${e.id}@el-estuche`, `DTSTAMP:${stamp}`);
    if (e.time) {
      lines.push(`DTSTART:${compact(e.date)}T${timeParts(e.time)}`, `DTEND:${compact(e.date)}T${addHour(e.time)}`);
    } else {
      lines.push(`DTSTART;VALUE=DATE:${compact(e.date)}`, `DTEND;VALUE=DATE:${compact(nextDay(e.date))}`);
    }
    lines.push(`SUMMARY:${esc(eventTitle(e, subject))}`);
    if (e.notes) lines.push(`DESCRIPTION:${esc(e.notes)}`);
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n') + '\r\n';
}

export function saveFile(name, content, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
