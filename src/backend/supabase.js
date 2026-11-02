import { createClient } from '@supabase/supabase-js';

const TABLES = ['subjects', 'works', 'tasks', 'entries', 'attachments', 'events', 'ai_messages'];
const BUCKET = 'archivos';

function fail(error) {
  if (error) throw new Error(error.message);
}

export function createSupabaseBackend({ url, key, email }) {
  const sb = createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true } });
  let channel = null;

  return {
    demo: false,

    async hasSession() {
      const { data } = await sb.auth.getSession();
      return Boolean(data.session);
    },
    async signIn(password) {
      const { error } = await sb.auth.signInWithPassword({ email, password });
      if (error) throw new Error('Esa no es la clave del grupo.');
    },
    async signOut() {
      await sb.auth.signOut();
    },

    async loadAll() {
      const results = await Promise.all(
        TABLES.map((t) => sb.from(t).select('*').order('created_at', { ascending: true })),
      );
      const db = {};
      results.forEach((r, i) => {
        fail(r.error);
        db[TABLES[i]] = r.data;
      });
      const settings = await sb.from('settings').select('key,value');
      fail(settings.error);
      db.settings = Object.fromEntries(settings.data.map((s) => [s.key, s.value]));
      return db;
    },

    async insert(table, rows) {
      fail((await sb.from(table).insert(rows)).error);
    },
    async update(table, id, patch) {
      fail((await sb.from(table).update(patch).eq('id', id)).error);
    },
    async remove(table, id) {
      fail((await sb.from(table).delete().eq('id', id)).error);
    },
    async toggleTask(id, person) {
      fail((await sb.rpc('toggle_task', { task_id: id, person })).error);
    },
    async setSetting(key, value) {
      fail((await sb.from('settings').upsert({ key, value })).error);
    },

    async upload(path, file) {
      fail((await sb.storage.from(BUCKET).upload(path, file, { contentType: file.type || undefined })).error);
    },
    async fileUrl(path, download) {
      const { data, error } = await sb.storage.from(BUCKET).createSignedUrl(path, 3600, download ? { download } : undefined);
      fail(error);
      return data.signedUrl;
    },
    async removeFiles(paths) {
      if (paths.length) fail((await sb.storage.from(BUCKET).remove(paths)).error);
    },

    connect(me, { onChange, onStatus, onPresence }) {
      channel = sb.channel('estuche', { config: { presence: { key: me } } });
      channel.on('postgres_changes', { event: '*', schema: 'public' }, (payload) => {
        if (!TABLES.includes(payload.table)) return;
        onChange(payload.table, payload.eventType, payload.eventType === 'DELETE' ? payload.old : payload.new);
      });
      channel.on('presence', { event: 'sync' }, () => onPresence(Object.keys(channel.presenceState())));
      channel.subscribe(async (status) => {
        onStatus(status === 'SUBSCRIBED');
        if (status === 'SUBSCRIBED') await channel.track({ at: Date.now() });
      });
      return () => sb.removeChannel(channel);
    },

    calendarUrl(token) {
      return `${url}/rest/v1/rpc/calendario?token=${token}&apikey=${key}`;
    },
  };
}
