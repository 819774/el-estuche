// Modo demostración: mismos datos de partida, guardados solo en memoria.
// Dos pestañas abiertas a la vez se sincronizan para poder enseñar el directo.
const ago = (m) => new Date(Date.now() - m * 60000).toISOString();

const SUBJECT = '11111111-1111-4111-8111-111111111111';
const WORK = '22222222-2222-4222-8222-222222222222';

function seed() {
  return {
    subjects: [{ id: SUBJECT, name: 'Sin asignatura', emoji: '✏️', color: '#38BDF8', created_by: 'Almudena', created_at: ago(90) }],
    works: [{ id: WORK, subject_id: SUBJECT, title: 'Trabajo POAT', description: '', status: 'activo', created_by: 'Almudena', created_at: ago(90) }],
    tasks: [{ id: 't1', work_id: WORK, title: 'Revisar si tengo acceso al Word', assignees: ['Paula', 'Belén', 'María', 'Raquel'], done_by: [], due_date: null, created_by: 'Almudena', created_at: ago(60) }],
    entries: [{ id: 'e1', work_id: WORK, author: 'Almudena', body: 'He creado el Word del trabajo.', created_at: ago(60) }],
    attachments: [],
    events: [],
    ai_messages: [],
    settings: { calendar_token: 'demo' },
  };
}

export function createDemoBackend() {
  const db = seed();
  const bus = 'BroadcastChannel' in window ? new BroadcastChannel('estuche-demo') : null;
  const files = new Map();
  let listener = null;

  const emit = (table, type, row) => {
    listener?.(table, type, row);
    bus?.postMessage({ table, type, row });
  };
  const apply = (table, type, row) => {
    const list = db[table];
    const i = list.findIndex((r) => r.id === row.id);
    if (type === 'DELETE') { if (i >= 0) list.splice(i, 1); } else if (i >= 0) list[i] = row; else list.push(row);
  };
  bus?.addEventListener('message', ({ data }) => {
    apply(data.table, data.type, data.row);
    listener?.(data.table, data.type, data.row);
  });

  return {
    demo: true,
    async hasSession() { return true; },
    async signIn() {},
    async signOut() {},
    async loadAll() { return structuredClone(db); },
    async insert(table, rows) {
      for (const row of [].concat(rows)) { apply(table, 'INSERT', row); emit(table, 'INSERT', row); }
    },
    async update(table, id, patch) {
      const row = { ...db[table].find((r) => r.id === id), ...patch };
      apply(table, 'UPDATE', row); emit(table, 'UPDATE', row);
    },
    async remove(table, id) { apply(table, 'DELETE', { id }); emit(table, 'DELETE', { id }); },
    async toggleTask(id, person) {
      const row = db.tasks.find((t) => t.id === id);
      const done_by = row.done_by.includes(person) ? row.done_by.filter((p) => p !== person) : [...row.done_by, person];
      const next = { ...row, done_by };
      apply('tasks', 'UPDATE', next); emit('tasks', 'UPDATE', next);
    },
    async setSetting(key, value) { db.settings[key] = value; },
    async upload(path, file) { files.set(path, URL.createObjectURL(file)); },
    async fileUrl(path) { return files.get(path) ?? ''; },
    async removeFiles() {},
    connect(me, { onChange, onStatus, onPresence }) {
      listener = onChange;
      onStatus(true);
      onPresence([me]);
      return () => { listener = null; };
    },
    calendarUrl() { return ''; },
  };
}

