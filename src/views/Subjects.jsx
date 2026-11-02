import { useCallback, useState } from 'react';
import { LuArrowLeft, LuCalendarPlus, LuPencil, LuPlus } from 'react-icons/lu';
import { progress, useStore, isDone } from '../store.jsx';
import { Button, Empty, IconButton, Progress } from '../ui.jsx';
import { EventForm, SubjectForm, WorkForm } from '../forms.jsx';
import { Ticket } from '../shared.jsx';
import { countdown, todayISO } from '../lib/date.js';

export function Subjects() {
  const { db } = useStore();
  const [creating, setCreating] = useState(false);
  const close = useCallback(() => setCreating(false), []);

  return (
    <>
      <div className="page-head">
        <h1>Asignaturas</h1>
        <Button icon={LuPlus} onClick={() => setCreating(true)}>Nueva</Button>
      </div>
      {db.subjects.length ? (
        <div className="folders">
          {db.subjects.map((s) => {
            const works = db.works.filter((w) => w.subject_id === s.id);
            const ids = new Set(works.map((w) => w.id));
            const tasks = db.tasks.filter((t) => ids.has(t.work_id));
            const next = db.events.filter((e) => e.subject_id === s.id && e.date >= todayISO()).sort((a, b) => a.date.localeCompare(b.date))[0];
            return (
              <a key={s.id} className="folder" href={`#/asignatura/${s.id}`} style={{ '--c': s.color }}>
                <span className="folder-tab">{works.length} {works.length === 1 ? 'trabajo' : 'trabajos'}</span>
                <span className="folder-face">
                  <span className="folder-emoji" aria-hidden>{s.emoji}</span>
                  <span className="folder-name">{s.name}</span>
                  <span className="folder-next">{next ? `${next.title}: ${countdown(next.date).toLowerCase()}` : 'Sin fechas a la vista'}</span>
                  <Progress value={progress(tasks)} color="#fff" />
                </span>
              </a>
            );
          })}
        </div>
      ) : (
        <Empty emoji="🎒" title="Crea la primera asignatura">
          <Button icon={LuPlus} onClick={() => setCreating(true)}>Nueva asignatura</Button>
        </Empty>
      )}
      {creating && <SubjectForm onClose={close} />}
    </>
  );
}

export function SubjectDetail({ id }) {
  const { db } = useStore();
  const [form, setForm] = useState(null);
  const close = useCallback(() => setForm(null), []);
  const subject = db.subjects.find((s) => s.id === id);
  if (!subject) return <Empty emoji="🔍" title="Esta asignatura ya no existe"><a className="btn btn-ghost" href="#/asignaturas">Ver asignaturas</a></Empty>;

  const works = db.works.filter((w) => w.subject_id === id);
  const events = db.events.filter((e) => e.subject_id === id).sort((a, b) => a.date.localeCompare(b.date));

  return (
    <>
      <a className="back" href="#/asignaturas"><LuArrowLeft aria-hidden /> Asignaturas</a>
      <header className="banner" style={{ '--c': subject.color }}>
        <span className="banner-emoji" aria-hidden>{subject.emoji}</span>
        <h1>{subject.name}</h1>
        <IconButton icon={LuPencil} label="Editar asignatura" onClick={() => setForm({ type: 'subject' })} />
      </header>

      <section className="block">
        <div className="block-head">
          <h2>Trabajos</h2>
          <Button small variant="ghost" icon={LuPlus} onClick={() => setForm({ type: 'work' })}>Nuevo trabajo</Button>
        </div>
        {works.length ? (
          <div className="work-list">
            {works.map((w) => {
              const tasks = db.tasks.filter((t) => t.work_id === w.id);
              const open = tasks.filter((t) => !isDone(t)).length;
              return (
                <a key={w.id} href={`#/trabajo/${w.id}`} className="work-card" style={{ '--c': subject.color }}>
                  <span className="work-title">{w.title}</span>
                  <span className="work-meta">{w.status === 'entregado' ? '✅ Entregado' : open ? `${open} ${open === 1 ? 'pendiente' : 'pendientes'}` : 'Sin pendientes'}</span>
                  <Progress value={w.status === 'entregado' ? 1 : progress(tasks)} color={subject.color} />
                </a>
              );
            })}
          </div>
        ) : <Empty emoji="📄" title="Aún no hay trabajos aquí" />}
      </section>

      <section className="block">
        <div className="block-head">
          <h2>Fechas</h2>
          <Button small variant="ghost" icon={LuCalendarPlus} onClick={() => setForm({ type: 'event' })}>Añadir fecha</Button>
        </div>
        {events.length ? (
          <div className="ticket-row">
            {events.map((e) => <Ticket key={e.id} event={e} onEdit={(ev) => setForm({ type: 'event', event: ev })} />)}
          </div>
        ) : <Empty emoji="🗓️" title="Sin entregas ni exámenes" />}
      </section>

      {form?.type === 'subject' && <SubjectForm subject={subject} onClose={close} />}
      {form?.type === 'work' && <WorkForm subjectId={id} onClose={close} />}
      {form?.type === 'event' && <EventForm event={form.event} subjectId={id} onClose={close} />}
    </>
  );
}
