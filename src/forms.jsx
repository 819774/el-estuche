import { useState } from 'react';
import { EVENT_KINDS, SUBJECT_COLORS, SUBJECT_EMOJI } from './people.js';
import { useStore } from './store.jsx';
import { Button, Field, Modal, useConfirm } from './ui.jsx';
import { todayISO } from './lib/date.js';
import { go } from './router.js';

export function SubjectForm({ subject, onClose }) {
  const { me, add, patch, remove } = useStore();
  const confirm = useConfirm();
  const [name, setName] = useState(subject?.name === 'Sin asignatura' ? '' : subject?.name ?? '');
  const [emoji, setEmoji] = useState(subject?.emoji ?? SUBJECT_EMOJI[0]);
  const [color, setColor] = useState(subject?.color ?? SUBJECT_COLORS[0]);

  const submit = async (e) => {
    e.preventDefault();
    const values = { name: name.trim(), emoji, color };
    onClose();
    if (subject) await patch('subjects', subject.id, values);
    else {
      const row = await add('subjects', { ...values, created_by: me });
      go(`/asignatura/${row.id}`);
    }
  };
  const destroy = async () => {
    const ok = await confirm({
      title: `¿Borrar ${subject.name}?`,
      body: 'Se borrarán también sus trabajos, pendientes y fechas.',
      action: 'Borrar asignatura',
    });
    if (!ok) return;
    onClose();
    go('/asignaturas');
    remove('subjects', subject.id);
  };

  return (
    <Modal title={subject ? 'Editar asignatura' : 'Nueva asignatura'} onClose={onClose}>
      <form onSubmit={submit}>
        <Field label="Nombre">
          {(id) => <input id={id} value={name} onChange={(e) => setName(e.target.value)} placeholder="Orientación educativa" required />}
        </Field>
        <fieldset className="field">
          <legend>Icono</legend>
          <div className="swatches">
            {SUBJECT_EMOJI.map((em) => (
              <button key={em} type="button" className="swatch swatch-emoji" aria-pressed={em === emoji} onClick={() => setEmoji(em)}>{em}</button>
            ))}
          </div>
        </fieldset>
        <fieldset className="field">
          <legend>Color</legend>
          <div className="swatches">
            {SUBJECT_COLORS.map((c) => (
              <button key={c} type="button" className="swatch" style={{ background: c }} aria-label={`Color ${c}`} aria-pressed={c === color} onClick={() => setColor(c)} />
            ))}
          </div>
        </fieldset>
        <div className="form-actions">
          {subject && <Button variant="danger-ghost" onClick={destroy}>Borrar</Button>}
          <Button type="submit">{subject ? 'Guardar' : 'Crear asignatura'}</Button>
        </div>
      </form>
    </Modal>
  );
}

export function WorkForm({ work, subjectId, onClose }) {
  const { me, db, add, patch } = useStore();
  const [title, setTitle] = useState(work?.title ?? '');
  const [description, setDescription] = useState(work?.description ?? '');
  const [subject, setSubject] = useState(work?.subject_id ?? subjectId ?? db.subjects[0]?.id ?? '');

  const submit = async (e) => {
    e.preventDefault();
    const values = { title: title.trim(), description: description.trim(), subject_id: subject };
    onClose();
    if (work) await patch('works', work.id, values);
    else {
      const row = await add('works', { ...values, status: 'activo', created_by: me });
      go(`/trabajo/${row.id}`);
    }
  };

  return (
    <Modal title={work ? 'Editar trabajo' : 'Nuevo trabajo'} onClose={onClose}>
      <form onSubmit={submit}>
        <Field label="Título">
          {(id) => <input id={id} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Trabajo del tema 3" required />}
        </Field>
        <Field label="Asignatura">
          {(id) => (
            <select id={id} value={subject} onChange={(e) => setSubject(e.target.value)} required>
              {db.subjects.map((s) => <option key={s.id} value={s.id}>{s.emoji} {s.name}</option>)}
            </select>
          )}
        </Field>
        <Field label="De qué va (opcional)">
          {(id) => <textarea id={id} rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Lo que pide la profe, extensión, formato…" />}
        </Field>
        <div className="form-actions">
          <Button type="submit">{work ? 'Guardar' : 'Crear trabajo'}</Button>
        </div>
      </form>
    </Modal>
  );
}

export function EventForm({ event, date, subjectId, workId, onClose }) {
  const { me, db, add, patch, remove } = useStore();
  const [kind, setKind] = useState(event?.kind ?? 'entrega');
  const work = db.works.find((w) => w.id === (event?.work_id ?? workId));
  const [title, setTitle] = useState(event?.title ?? work?.title ?? '');
  const [day, setDay] = useState(event?.date ?? date ?? todayISO());
  const [time, setTime] = useState(event?.time?.slice(0, 5) ?? '');
  const [subject, setSubject] = useState(event?.subject_id ?? subjectId ?? work?.subject_id ?? '');
  const [notes, setNotes] = useState(event?.notes ?? '');

  const submit = async (e) => {
    e.preventDefault();
    const values = {
      kind, title: title.trim(), date: day, time: time || null, subject_id: subject || null, notes: notes.trim(),
    };
    onClose();
    if (event) await patch('events', event.id, values);
    else await add('events', { ...values, work_id: workId ?? null, created_by: me });
  };

  return (
    <Modal title={event ? 'Editar fecha' : 'Nueva fecha'} onClose={onClose}>
      <form onSubmit={submit}>
        <div className="kind-row" role="group" aria-label="Tipo de fecha">
          {Object.entries(EVENT_KINDS).map(([key, k]) => (
            <button key={key} type="button" className="kind" aria-pressed={kind === key} style={{ '--c': k.color }} onClick={() => setKind(key)}>
              <span aria-hidden>{k.emoji}</span> {k.label}
            </button>
          ))}
        </div>
        <Field label="Título">
          {(id) => <input id={id} value={title} onChange={(e) => setTitle(e.target.value)} placeholder={kind === 'examen' ? 'Examen del tema 1 al 4' : 'Entrega final'} required />}
        </Field>
        <div className="form-two">
          <Field label="Día">
            {(id) => <input id={id} type="date" value={day} onChange={(e) => setDay(e.target.value)} required />}
          </Field>
          <Field label="Hora (opcional)">
            {(id) => <input id={id} type="time" value={time} onChange={(e) => setTime(e.target.value)} />}
          </Field>
        </div>
        <Field label="Asignatura">
          {(id) => (
            <select id={id} value={subject} onChange={(e) => setSubject(e.target.value)}>
              <option value="">Ninguna</option>
              {db.subjects.map((s) => <option key={s.id} value={s.id}>{s.emoji} {s.name}</option>)}
            </select>
          )}
        </Field>
        <Field label="Notas (opcional)">
          {(id) => <textarea id={id} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Aula, material, qué entra…" />}
        </Field>
        <div className="form-actions">
          {event && <Button variant="danger-ghost" onClick={() => { onClose(); remove('events', event.id); }}>Borrar</Button>}
          <Button type="submit">{event ? 'Guardar' : 'Guardar fecha'}</Button>
        </div>
      </form>
    </Modal>
  );
}

export function LinkForm({ workId, onClose }) {
  const { me, add } = useStore();
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const submit = async (e) => {
    e.preventDefault();
    const clean = /^https?:\/\//i.test(url.trim()) ? url.trim() : `https://${url.trim()}`;
    onClose();
    await add('attachments', { work_id: workId, kind: 'link', name: name.trim() || clean, url: clean, created_by: me });
  };
  return (
    <Modal title="Añadir enlace" onClose={onClose}>
      <form onSubmit={submit}>
        <Field label="Enlace" hint="Por ejemplo, el del Word en OneDrive o Google Drive.">
          {(id) => <input id={id} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" required inputMode="url" />}
        </Field>
        <Field label="Nombre (opcional)">
          {(id) => <input id={id} value={name} onChange={(e) => setName(e.target.value)} placeholder="Word del trabajo" />}
        </Field>
        <div className="form-actions"><Button type="submit">Añadir enlace</Button></div>
      </form>
    </Modal>
  );
}
