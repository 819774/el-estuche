import { useCallback, useState } from 'react';
import { useStore, isDone } from '../store.jsx';
import { NAMES, colorOf } from '../people.js';
import { Avatar, Button, Empty, Name } from '../ui.jsx';
import { Ticket } from '../shared.jsx';
import { TaskRow } from './Work.jsx';
import { EventForm } from '../forms.jsx';
import { ago, daysUntil, todayISO } from '../lib/date.js';
import { go } from '../router.js';

export function Home() {
  const { db, me } = useStore();
  const [who, setWho] = useState(me);
  const [editing, setEditing] = useState(null);
  const close = useCallback(() => setEditing(null), []);

  const activeWorks = new Set(db.works.filter((w) => w.status === 'activo').map((w) => w.id));
  const pending = db.tasks
    .filter((t) => activeWorks.has(t.work_id) && !isDone(t))
    .filter((t) => (t.assignees.length ? t.assignees.includes(who) && !t.done_by.includes(who) : true))
    .sort((a, b) => (a.due_date ?? '9').localeCompare(b.due_date ?? '9'));
  const mine = pending.filter((t) => t.assignees.includes(me)).length;

  const upcoming = db.events.filter((e) => e.date >= todayISO()).sort((a, b) => a.date.localeCompare(b.date));
  const soon = upcoming.filter((e) => daysUntil(e.date) <= 7).length;

  const news = [
    ...db.entries.map((e) => ({ ...e, who: e.author, text: e.body })),
    ...db.attachments.filter((a) => !a.entry_id).map((a) => ({ ...a, who: a.created_by, text: `Ha añadido ${a.name}` })),
  ].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 6);

  const summary = [
    mine ? `${mine} ${mine === 1 ? 'pendiente tuyo' : 'pendientes tuyos'}` : 'Nada pendiente tuyo',
    soon ? `${soon} ${soon === 1 ? 'fecha' : 'fechas'} esta semana` : 'sin fechas esta semana',
  ].join(' y ');

  return (
    <>
      <section className="hello" style={{ '--c': colorOf(me) }}>
        <span className="tape" aria-hidden />
        <h1>Hola, {me}</h1>
        <p>{summary}</p>
      </section>

      <div className="home-grid">
        <section className="block block-wide">
          <div className="block-head">
            <h2>Lo próximo</h2>
            <a href="#/calendario">Ver calendario</a>
          </div>
          {upcoming.length ? (
            <div className="ticket-row">
              {upcoming.slice(0, 6).map((e) => <Ticket key={e.id} event={e} onEdit={setEditing} />)}
            </div>
          ) : (
            <Empty emoji="🗓️" title="Todavía no hay fechas">
              <Button variant="ghost" onClick={() => go('/calendario')}>Añadir entrega o examen</Button>
            </Empty>
          )}
        </section>

        <section className="block">
          <div className="block-head">
            <h2>Pendientes</h2>
            <div className="who-filter" role="group" aria-label="Ver pendientes de">
              {NAMES.map((name) => (
                <button key={name} type="button" aria-pressed={who === name} aria-label={`Ver pendientes de ${name}`} onClick={() => setWho(name)}>
                  <Avatar name={name} size="xs" muted={who !== name} />
                </button>
              ))}
            </div>
          </div>
          {pending.length ? (
            <ul className="task-list">
              {pending.map((t) => <TaskRow key={t.id} task={t} showWork />)}
            </ul>
          ) : (
            <Empty emoji="🎉" title={`${who === me ? 'No tienes' : `${who} no tiene`} nada pendiente`} />
          )}
        </section>

        <section className="block">
          <div className="block-head"><h2>Novedades</h2></div>
          {news.length ? (
            <ul className="news">
              {news.map((n) => {
                const work = db.works.find((w) => w.id === n.work_id);
                return (
                  <li key={n.id}>
                    <a href={`#/trabajo/${n.work_id}`}>
                      <Avatar name={n.who} size="sm" />
                      <span>
                        <span className="news-line"><Name name={n.who} /> en {work?.title}</span>
                        {n.text && <span className="news-text">{n.text}</span>}
                        <span className="news-time">{ago(n.created_at)}</span>
                      </span>
                    </a>
                  </li>
                );
              })}
            </ul>
          ) : <Empty emoji="🌱" title="Aún no hay novedades" />}
        </section>
      </div>
      {editing && <EventForm event={editing} onClose={close} />}
    </>
  );
}
