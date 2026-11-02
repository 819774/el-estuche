import { useCallback, useEffect, useState } from 'react';
import { LuBookOpen, LuCalendarDays, LuFolderPlus, LuHouse, LuPlus, LuCalendarPlus, LuSparkles, LuFilePlus2, LuRefreshCw } from 'react-icons/lu';
import { backend, readMe, saveMe, StoreProvider, useStore } from './store.jsx';
import { NAMES, colorOf, PEOPLE } from './people.js';
import { Avatar, Button, ConfirmHost, Empty, Modal } from './ui.jsx';
import { go, useRoute } from './router.js';
import { EventForm, SubjectForm, WorkForm } from './forms.jsx';
import { Home } from './views/Home.jsx';
import { Subjects, SubjectDetail } from './views/Subjects.jsx';
import { WorkDetail } from './views/Work.jsx';
import { CalendarView } from './views/Calendar.jsx';
import { Assistant } from './views/Assistant.jsx';
import { Settings } from './views/Settings.jsx';

function Logo() {
  return (
    <a className="logo" href="#/" aria-label="El Estuche, inicio">
      <span className="logo-pens" aria-hidden>
        {PEOPLE.map((p) => <i key={p.name} style={{ background: p.color }} />)}
      </span>
      <span>El Estuche</span>
    </a>
  );
}

function Login({ onDone }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await backend.signIn(password);
      onDone();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };
  return (
    <main className="gate">
      <div className="gate-card">
        <Logo />
        <h1>Clave del grupo</h1>
        <form onSubmit={submit}>
          <input type="password" aria-label="Clave del grupo" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required autoFocus />
          {error && <p className="form-error" role="alert">{error}</p>}
          <Button type="submit" disabled={busy}>{busy ? 'Entrando…' : 'Entrar'}</Button>
        </form>
      </div>
    </main>
  );
}

function WhoAmI({ onPick }) {
  return (
    <main className="gate">
      <div className="gate-card gate-wide">
        <Logo />
        <h1>¿Quién eres?</h1>
        <div className="who-grid">
          {NAMES.map((name) => (
            <button key={name} type="button" className="who" style={{ '--c': colorOf(name) }} onClick={() => onPick(name)}>
              <Avatar name={name} size="xl" />
              <span>{name}</span>
            </button>
          ))}
        </div>
      </div>
    </main>
  );
}

const NAV = [
  { path: '/', label: 'Inicio', icon: LuHouse, match: (p) => p === '/' },
  { path: '/asignaturas', label: 'Asignaturas', icon: LuBookOpen, match: (p) => /^\/(asignatura|trabajo)/.test(p) },
  { path: '/calendario', label: 'Fechas', icon: LuCalendarDays, match: (p) => p.startsWith('/calendario') },
  { path: '/ia', label: 'Pregunta', icon: LuSparkles, match: (p) => p.startsWith('/ia') },
];

function NewMenu({ onClose, onPick }) {
  const { db } = useStore();
  const items = [
    { key: 'work', label: 'Trabajo', icon: LuFilePlus2, disabled: !db.subjects.length },
    { key: 'event', label: 'Entrega o examen', icon: LuCalendarPlus },
    { key: 'subject', label: 'Asignatura', icon: LuFolderPlus },
  ];
  return (
    <Modal title="¿Qué quieres añadir?" onClose={onClose}>
      <div className="new-menu">
        {items.map(({ key, label, icon: Icon, disabled }) => (
          <button key={key} type="button" disabled={disabled} onClick={() => onPick(key)}>
            <Icon aria-hidden /> {label}
          </button>
        ))}
      </div>
    </Modal>
  );
}

function Status() {
  const { live, online, me } = useStore();
  const others = online.filter((n) => n !== me);
  return (
    <div className="status">
      <span className={`pulse${live ? '' : ' pulse-off'}`} title={live ? 'En directo' : 'Reconectando'} />
      <span className="status-text">{live ? (others.length ? 'Conectadas' : 'En directo') : 'Reconectando…'}</span>
      {others.map((n) => <Avatar key={n} name={n} size="xs" />)}
    </div>
  );
}

function Shell({ onSwitch, onSignOut }) {
  const { db, me, toasts, error, refresh } = useStore();
  const path = useRoute();
  const [menu, setMenu] = useState(false);
  const [form, setForm] = useState(null);
  const [settings, setSettings] = useState(false);
  const closeMenu = useCallback(() => setMenu(false), []);
  const closeForm = useCallback(() => setForm(null), []);
  const closeSettings = useCallback(() => setSettings(false), []);

  if (error && !db) {
    return (
      <main className="gate">
        <div className="gate-card">
          <Logo />
          <h1>No se han podido cargar los datos</h1>
          <p className="confirm-text">{error}</p>
          <Button icon={LuRefreshCw} onClick={refresh}>Reintentar</Button>
          <Button variant="ghost" onClick={onSignOut}>Salir</Button>
        </div>
      </main>
    );
  }
  if (!db) return <main className="gate"><p className="loading">Abriendo el estuche…</p></main>;

  const [, section, id] = path.split('/');
  let view;
  if (section === '') view = <Home />;
  else if (section === 'asignaturas') view = <Subjects />;
  else if (section === 'asignatura') view = <SubjectDetail id={id} />;
  else if (section === 'trabajo') view = <WorkDetail id={id} />;
  else if (section === 'calendario') view = <CalendarView />;
  else if (section === 'ia') view = <Assistant onSettings={() => setSettings(true)} />;
  else view = <Empty emoji="🧭" title="Esta página no existe"><Button onClick={() => go('/')}>Volver al inicio</Button></Empty>;

  return (
    <div className="shell">
      <aside className="rail">
        <Logo />
        <nav aria-label="Principal">
          {NAV.map(({ path: to, label, icon: Icon, match }) => (
            <a key={to} href={`#${to}`} aria-current={match(path) ? 'page' : undefined}><Icon aria-hidden /><span>{label}</span></a>
          ))}
        </nav>
        <Button icon={LuPlus} onClick={() => setMenu(true)}>Añadir</Button>
      </aside>

      <div className="stage">
        <header className="top">
          <span className="top-logo"><Logo /></span>
          <Status />
          <button type="button" className="me" onClick={() => setSettings(true)} aria-label="Ajustes">
            <Avatar name={me} /><span>{me}</span>
          </button>
        </header>
        {backend.demo && <p className="demo-note">Demostración: lo que añadas aquí no se guarda. Abre dos pestañas para ver el directo.</p>}
        <main className="page">{view}</main>
      </div>

      <nav className="tabs" aria-label="Principal">
        {NAV.slice(0, 2).map(({ path: to, label, icon: Icon, match }) => (
          <a key={to} href={`#${to}`} aria-current={match(path) ? 'page' : undefined}><Icon aria-hidden /><span>{label}</span></a>
        ))}
        <button type="button" className="tabs-add" aria-label="Añadir" onClick={() => setMenu(true)}><LuPlus aria-hidden /></button>
        {NAV.slice(2).map(({ path: to, label, icon: Icon, match }) => (
          <a key={to} href={`#${to}`} aria-current={match(path) ? 'page' : undefined}><Icon aria-hidden /><span>{label}</span></a>
        ))}
      </nav>

      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div className="toast" key={t.id}>{t.person && <Avatar name={t.person} size="xs" />}<span>{t.text}</span></div>
        ))}
      </div>

      {menu && <NewMenu onClose={closeMenu} onPick={(k) => { setMenu(false); setForm(k); }} />}
      {form === 'subject' && <SubjectForm onClose={closeForm} />}
      {form === 'work' && <WorkForm onClose={closeForm} subjectId={section === 'asignatura' ? id : undefined} />}
      {form === 'event' && <EventForm onClose={closeForm} />}
      {settings && <Settings onClose={closeSettings} onSwitch={onSwitch} onSignOut={onSignOut} />}
    </div>
  );
}

export function App() {
  const [session, setSession] = useState(null);
  const [me, setMe] = useState(() => readMe());

  useEffect(() => {
    backend.hasSession().then(setSession).catch(() => setSession(false));
  }, []);

  const pick = (name) => { saveMe(name); setMe(name); };
  const switchPerson = () => { saveMe(null); setMe(null); };
  const signOut = async () => {
    await backend.signOut();
    saveMe(null);
    setMe(null);
    setSession(false);
  };

  if (session === null) return <main className="gate"><p className="loading">Abriendo el estuche…</p></main>;
  if (!session) return <Login onDone={() => setSession(true)} />;
  if (!NAMES.includes(me)) return <WhoAmI onPick={pick} />;
  return (
    <StoreProvider me={me} key={me}>
      <ConfirmHost>
        <Shell onSwitch={switchPerson} onSignOut={signOut} />
      </ConfirmHost>
    </StoreProvider>
  );
}
