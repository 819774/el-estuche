import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { createSupabaseBackend } from './backend/supabase.js';
import { createDemoBackend } from './backend/demo.js';

const StoreContext = createContext(null);
export const useStore = () => useContext(StoreContext);

const config = { url: __SUPABASE_URL__, key: __SUPABASE_KEY__, email: __TEAM_EMAIL__ };
export const backend = config.url && config.key && config.email
  ? createSupabaseBackend(config)
  : createDemoBackend();

const NOTIFY = {
  tasks: (r) => `ha añadido un pendiente: ${r.title}`,
  entries: () => 'ha contado un avance',
  events: (r) => `ha añadido una fecha: ${r.title}`,
  works: (r) => `ha creado el trabajo ${r.title}`,
  subjects: (r) => `ha creado la asignatura ${r.name}`,
  attachments: (r) => `ha añadido ${r.name}`,
};

export const newId = () => crypto.randomUUID();

function merge(list, type, row) {
  const i = list.findIndex((r) => r.id === row.id);
  if (type === 'DELETE') return i >= 0 ? list.filter((r) => r.id !== row.id) : list;
  if (i >= 0) {
    const next = [...list];
    next[i] = { ...next[i], ...row };
    return next;
  }
  return [...list, row];
}

export function readMe() {
  try { return localStorage.getItem('estuche.persona'); } catch { return null; }
}
export function saveMe(name) {
  try {
    if (name) localStorage.setItem('estuche.persona', name);
    else localStorage.removeItem('estuche.persona');
  } catch { /* sin almacenamiento: se vuelve a preguntar */ }
}

export function StoreProvider({ me, children }) {
  const [db, setDb] = useState(null);
  const [live, setLive] = useState(false);
  const [online, setOnline] = useState([]);
  const [toasts, setToasts] = useState([]);
  const [error, setError] = useState(null);
  const meRef = useRef(me);
  meRef.current = me;

  const toast = useCallback((text, person = null) => {
    const id = newId();
    setToasts((t) => [...t.slice(-2), { id, text, person }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4500);
  }, []);

  const refresh = useCallback(async () => {
    try {
      setDb(await backend.loadAll());
      setError(null);
    } catch (e) {
      setError(e.message);
    }
  }, []);

  useEffect(() => {
    refresh();
    let wasLive = false;
    const stop = backend.connect(me, {
      onChange(table, type, row) {
        setDb((d) => (d ? { ...d, [table]: merge(d[table], type, row) } : d));
        const author = row.created_by ?? row.author;
        if (type === 'INSERT' && NOTIFY[table] && author && author !== meRef.current) {
          toast(`${author} ${NOTIFY[table](row)}`, author);
        }
      },
      onStatus(ok) {
        setLive(ok);
        if (ok && wasLive === false) refresh();
        wasLive = ok;
      },
      onPresence: setOnline,
    });
    const onVisible = () => { if (document.visibilityState === 'visible') refresh(); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', refresh);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', refresh);
    };
  }, [me, refresh, toast]);

  // Si el directo se corta, se recarga cada 30 segundos hasta que vuelva.
  useEffect(() => {
    if (live) return undefined;
    const timer = setInterval(refresh, 30000);
    return () => clearInterval(timer);
  }, [live, refresh]);

  const guard = useCallback(async (work) => {
    try {
      await work();
    } catch (e) {
      toast(`No se ha guardado: ${e.message}`);
      refresh();
      throw e;
    }
  }, [refresh, toast]);

  const actions = useMemo(() => ({
    add(table, row) {
      const full = { id: newId(), created_at: new Date().toISOString(), ...row };
      setDb((d) => ({ ...d, [table]: merge(d[table], 'INSERT', full) }));
      return guard(() => backend.insert(table, full)).then(() => full);
    },
    patch(table, id, values) {
      setDb((d) => ({ ...d, [table]: merge(d[table], 'UPDATE', { id, ...values }) }));
      return guard(() => backend.update(table, id, values));
    },
    remove(table, id) {
      setDb((d) => ({ ...d, [table]: merge(d[table], 'DELETE', { id }) }));
      return guard(() => backend.remove(table, id));
    },
    toggleTask(task, person) {
      const done_by = task.done_by.includes(person)
        ? task.done_by.filter((p) => p !== person)
        : [...task.done_by, person];
      setDb((d) => ({ ...d, tasks: merge(d.tasks, 'UPDATE', { id: task.id, done_by }) }));
      return guard(() => backend.toggleTask(task.id, person));
    },
    async setSetting(key, value) {
      setDb((d) => ({ ...d, settings: { ...d.settings, [key]: value } }));
      return guard(() => backend.setSetting(key, value));
    },
    async removeWithFiles(table, id, paths) {
      await actions.remove(table, id);
      backend.removeFiles(paths).catch(() => {});
    },
  }), [guard]);

  const value = useMemo(() => ({ db, me, live, online, toasts, error, toast, refresh, ...actions }), [db, me, live, online, toasts, error, toast, refresh, actions]);
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

// Una tarea está hecha cuando la ha marcado todo el mundo que la tiene asignada.
export const isDone = (task) => (task.assignees.length
  ? task.assignees.every((p) => task.done_by.includes(p))
  : task.done_by.length > 0);

export function progress(tasks) {
  const units = tasks.reduce((sum, t) => sum + Math.max(t.assignees.length, 1), 0);
  const done = tasks.reduce((sum, t) => sum + (t.assignees.length
    ? t.assignees.filter((p) => t.done_by.includes(p)).length
    : (t.done_by.length ? 1 : 0)), 0);
  return units ? done / units : 0;
}
