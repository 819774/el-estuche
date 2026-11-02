import { useState } from 'react';
import { LuCalendarSync, LuCopy, LuDownload, LuExternalLink, LuLogOut, LuUserRound } from 'react-icons/lu';
import { backend, useStore } from '../store.jsx';
import { Button, Field, Modal } from '../ui.jsx';
import { buildICS, saveFile } from '../lib/calendar.js';

export function GoogleBox() {
  const { db, toast } = useStore();
  const feed = backend.calendarUrl(db.settings.calendar_token);
  const subscribe = feed
    ? `https://calendar.google.com/calendar/render?cid=${encodeURIComponent(feed.replace(/^https:/, 'webcal:'))}`
    : null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(feed);
      toast('Enlace copiado');
    } catch {
      toast('No se ha podido copiar. Selecciónalo a mano en Ajustes.');
    }
  };

  return (
    <section className="gcal">
      <h2>Google Calendar</h2>
      <p>Suscríbete una vez y las fechas del grupo aparecerán en tu calendario. Google tarda unas horas en refrescarlas.</p>
      <div className="gcal-actions">
        {subscribe && (
          <a className="btn btn-primary btn-small" href={subscribe} target="_blank" rel="noreferrer">
            <LuCalendarSync aria-hidden /><span>Suscribirme</span><LuExternalLink aria-hidden className="tiny" />
          </a>
        )}
        {feed && <Button small variant="ghost" icon={LuCopy} onClick={copy}>Copiar enlace</Button>}
        <Button small variant="ghost" icon={LuDownload} onClick={() => saveFile('el-estuche.ics', buildICS(db.events, db.subjects), 'text/calendar')}>Descargar .ics</Button>
      </div>
    </section>
  );
}

export function Settings({ onClose, onSwitch, onSignOut }) {
  const { db, me, setSetting, toast } = useStore();
  const [key, setKey] = useState(db.settings.gemini_key ?? '');

  const saveKey = async (e) => {
    e.preventDefault();
    await setSetting('gemini_key', key.trim());
    toast('Clave de la IA guardada para las cinco');
  };
  const backup = () => {
    const { settings, ...data } = db;
    saveFile(`el-estuche-copia-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(data, null, 2), 'application/json');
  };

  return (
    <Modal title="Ajustes" onClose={onClose}>
      <div className="settings-row">
        <Button variant="ghost" icon={LuUserRound} onClick={onSwitch}>No soy {me}</Button>
        {!backend.demo && <Button variant="ghost" icon={LuLogOut} onClick={onSignOut}>Salir</Button>}
      </div>
      <form onSubmit={saveKey} className="settings-block">
        <Field label="Clave de Gemini para la IA" hint="Solo hace falta ponerla una vez. Se crea gratis en aistudio.google.com.">
          {(id) => <input id={id} type="password" autoComplete="off" value={key} onChange={(e) => setKey(e.target.value)} placeholder="Pega aquí la clave" />}
        </Field>
        <Button type="submit" small>Guardar clave</Button>
      </form>
      <div className="settings-block">
        <GoogleBox />
      </div>
      <div className="settings-block">
        <p className="hint">Supabase gratis no hace copias automáticas. Descarga una de vez en cuando.</p>
        <Button small variant="ghost" icon={LuDownload} onClick={backup}>Descargar copia de seguridad</Button>
      </div>
    </Modal>
  );
}
