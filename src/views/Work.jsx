import { useCallback, useState } from 'react';
import { LuArrowLeft, LuCalendarPlus, LuCheck, LuLink, LuPencil, LuPlus, LuSend, LuSparkles, LuTrash2, LuUpload } from 'react-icons/lu';
import { backend, isDone, newId, progress, useStore } from '../store.jsx';
import { colorOf } from '../people.js';
import { Avatar, Button, Empty, IconButton, Name, PeoplePicker, Progress, useConfirm, Modal } from '../ui.jsx';
import { EventForm, LinkForm, WorkForm } from '../forms.jsx';
import { AttachButton, Attachment, Ticket, useUploader } from '../shared.jsx';
import { ago, shortDate } from '../lib/date.js';
import { suggestTasks } from '../lib/ai.js';
import { go } from '../router.js';

export function TaskRow({ task, showWork }) {
  const { db, me, toggleTask, remove } = useStore();
  const confirm = useConfirm();
  const work = db.works.find((w) => w.id === task.work_id);
  const done = isDone(task);
  const shared = task.assignees.length === 0;
  const myBox = shared || task.assignees.includes(me);
  const checked = shared ? task.done_by.length > 0 : task.done_by.includes(me);

  const destroy = async () => {
    const ok = await confirm({ title: '¿Borrar este pendiente?', body: task.title, action: 'Borrar' });
    if (ok) remove('tasks', task.id);
  };

  return (
    <li className={`task${done ? ' task-done' : ''}`}>
      {myBox ? (
        <button
          type="button"
          className="check"
          role="checkbox"
          aria-checked={checked}
          aria-label={`Marcar como hecho: ${task.title}`}
          style={{ '--c': colorOf(me) }}
          onClick={() => toggleTask(task, shared ? (task.done_by[0] ?? me) : me)}
        >
          {checked && <LuCheck aria-hidden />}
        </button>
      ) : <span className="check-space" />}
      <div className="task-text">
        <span className="task-title">{task.title}</span>
        <span className="task-meta">
          {showWork && work && <a href={`#/trabajo/${work.id}`}>{work.title}</a>}
          {task.due_date && <span>Antes del {shortDate(task.due_date)}</span>}
          {task.created_by && !showWork && <span>Lo pidió {task.created_by}</span>}
        </span>
      </div>
      <div className="task-people">
        {task.assignees.map((name) => (
          <button
            key={name}
            type="button"
            className="task-person"
            aria-pressed={task.done_by.includes(name)}
            aria-label={`${name}: ${task.done_by.includes(name) ? 'hecho' : 'pendiente'}`}
            onClick={() => toggleTask(task, name)}
          >
            <Avatar name={name} size="sm" done={task.done_by.includes(name)} muted={!task.done_by.includes(name)} />
          </button>
        ))}
      </div>
      {!showWork && <IconButton icon={LuTrash2} label={`Borrar ${task.title}`} onClick={destroy} />}
    </li>
  );
}

function TaskComposer({ workId }) {
  const { me, add } = useStore();
  const [title, setTitle] = useState('');
  const [assignees, setAssignees] = useState([]);
  const [due, setDue] = useState('');
  const [open, setOpen] = useState(false);
  const submit = (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    add('tasks', { work_id: workId, title: title.trim(), assignees, done_by: [], due_date: due || null, created_by: me });
    setTitle('');
    setAssignees([]);
    setDue('');
    setOpen(false);
  };
  return (
    <form className="composer" onSubmit={submit}>
      <div className="composer-line">
        <input aria-label="Nuevo pendiente" placeholder="Añadir un pendiente…" value={title} onChange={(e) => setTitle(e.target.value)} onFocus={() => setOpen(true)} />
        <Button type="submit" icon={LuPlus} small disabled={!title.trim()}>Añadir</Button>
      </div>
      {open && (
        <div className="composer-more">
          <PeoplePicker value={assignees} onChange={setAssignees} />
          <label className="inline-date">Antes del <input type="date" value={due} onChange={(e) => setDue(e.target.value)} /></label>
        </div>
      )}
    </form>
  );
}

function SuggestModal({ work, subject, onClose }) {
  const { db, me, add } = useStore();
  const key = db.settings.gemini_key;
  const [state, setState] = useState({ status: 'idle', items: [], picked: [] });

  const run = async () => {
    setState({ status: 'loading', items: [], picked: [] });
    try {
      const items = backend.demo && !key
        ? ['Leer las instrucciones del trabajo', 'Repartir los apartados', 'Buscar fuentes', 'Redactar el borrador', 'Revisar el texto final']
        : await suggestTasks(key, db, work, subject);
      setState({ status: 'ready', items, picked: items });
    } catch (e) {
      setState({ status: 'error', message: e.message, items: [], picked: [] });
    }
  };
  const addAll = () => {
    state.picked.forEach((title) => add('tasks', { work_id: work.id, title, assignees: [], done_by: [], due_date: null, created_by: me }));
    onClose();
  };
  const toggle = (t) => setState((s) => ({ ...s, picked: s.picked.includes(t) ? s.picked.filter((x) => x !== t) : [...s.picked, t] }));

  return (
    <Modal title="Ideas para este trabajo" onClose={onClose}>
      {!key && !backend.demo ? <p className="confirm-text">Primero añade la clave de Gemini en Ajustes.</p> : (
        <>
          {state.status === 'idle' && (
            <>
              <p className="confirm-text">La IA lee lo que tenéis y propone pendientes. Tú eliges cuáles se añaden.</p>
              <div className="form-actions"><Button icon={LuSparkles} onClick={run}>Proponer pendientes</Button></div>
            </>
          )}
          {state.status === 'loading' && <p className="loading">Pensando…</p>}
          {state.status === 'error' && <p className="form-error" role="alert">{state.message}</p>}
          {state.status === 'ready' && (
            <>
              <ul className="suggest">
                {state.items.map((t) => (
                  <li key={t}>
                    <label><input type="checkbox" checked={state.picked.includes(t)} onChange={() => toggle(t)} /> {t}</label>
                  </li>
                ))}
              </ul>
              <div className="form-actions">
                <Button onClick={addAll} disabled={!state.picked.length}>Añadir {state.picked.length} pendientes</Button>
              </div>
            </>
          )}
        </>
      )}
    </Modal>
  );
}

function Journal({ workId }) {
  const { db, me, add, removeWithFiles } = useStore();
  const confirm = useConfirm();
  const { upload, busy } = useUploader(workId);
  const [body, setBody] = useState('');
  const [files, setFiles] = useState([]);
  const entries = db.entries.filter((e) => e.work_id === workId).sort((a, b) => b.created_at.localeCompare(a.created_at));

  const submit = async (e) => {
    e.preventDefault();
    if (!body.trim() && !files.length) return;
    const pending = files;
    const row = { id: newId(), work_id: workId, author: me, body: body.trim() };
    setBody('');
    setFiles([]);
    await add('entries', row);
    if (pending.length) upload(pending, row.id);
  };
  const destroy = async (entry, attached) => {
    const ok = await confirm({ title: '¿Borrar esta nota?', body: entry.body, action: 'Borrar' });
    if (ok) removeWithFiles('entries', entry.id, attached.filter((a) => a.path).map((a) => a.path));
  };
  const paste = (e) => {
    const images = [...e.clipboardData.files];
    if (images.length) setFiles((f) => [...f, ...images]);
  };

  return (
    <>
      <form className="journal-form" onSubmit={submit} style={{ '--c': colorOf(me) }}>
        <Avatar name={me} />
        <div>
          <textarea aria-label="Qué has hecho" rows={2} placeholder="¿Qué has hecho hoy en este trabajo?" value={body} onChange={(e) => setBody(e.target.value)} onPaste={paste} />
          {files.length > 0 && <p className="hint">{files.length === 1 ? files[0].name : `${files.length} archivos listos`}</p>}
          <div className="journal-actions">
            <AttachButton label="Foto o archivo" onFiles={(list) => setFiles((f) => [...f, ...list])} />
            <Button type="submit" small icon={LuSend} disabled={!body.trim() && !files.length}>Publicar</Button>
          </div>
        </div>
      </form>
      {busy > 0 && <p className="hint uploading">Subiendo {busy === 1 ? 'archivo' : `${busy} archivos`}…</p>}
      {entries.length ? (
        <ol className="journal">
          {entries.map((entry) => {
            const attached = db.attachments.filter((a) => a.entry_id === entry.id);
            return (
              <li key={entry.id} style={{ '--c': colorOf(entry.author) }}>
                <Avatar name={entry.author} size="sm" />
                <div className="entry">
                  <p className="entry-head"><Name name={entry.author} /> <time>{ago(entry.created_at)}</time></p>
                  {entry.body && <p className="entry-body">{entry.body}</p>}
                  {attached.length > 0 && <div className="attachments">{attached.map((a) => <Attachment key={a.id} item={a} />)}</div>}
                </div>
                <IconButton icon={LuTrash2} label="Borrar nota" onClick={() => destroy(entry, attached)} />
              </li>
            );
          })}
        </ol>
      ) : <Empty emoji="✍️" title="Aún no habéis contado nada" />}
    </>
  );
}

export function WorkDetail({ id }) {
  const { db, patch, removeWithFiles } = useStore();
  const confirm = useConfirm();
  const { upload, busy } = useUploader(id);
  const [form, setForm] = useState(null);
  const close = useCallback(() => setForm(null), []);
  const work = db.works.find((w) => w.id === id);
  if (!work) return <Empty emoji="🔍" title="Este trabajo ya no existe"><a className="btn btn-ghost" href="#/asignaturas">Ver asignaturas</a></Empty>;

  const subject = db.subjects.find((s) => s.id === work.subject_id);
  const tasks = db.tasks.filter((t) => t.work_id === id).sort((a, b) => Number(isDone(a)) - Number(isDone(b)));
  const events = db.events.filter((e) => e.work_id === id).sort((a, b) => a.date.localeCompare(b.date));
  const looseFiles = db.attachments.filter((a) => a.work_id === id);
  const delivered = work.status === 'entregado';

  const destroy = async () => {
    const ok = await confirm({
      title: `¿Borrar ${work.title}?`,
      body: 'Se borrarán sus pendientes, notas, archivos y fechas.',
      action: 'Borrar trabajo',
    });
    if (!ok) return;
    const paths = looseFiles.filter((a) => a.path).map((a) => a.path);
    go(`/asignatura/${work.subject_id}`);
    removeWithFiles('works', id, paths);
  };

  return (
    <>
      <a className="back" href={`#/asignatura/${work.subject_id}`}><LuArrowLeft aria-hidden /> {subject?.name}</a>
      <header className="banner banner-work" style={{ '--c': subject?.color }}>
        <div className="banner-main">
          <h1>{work.title}</h1>
          {work.description && <p>{work.description}</p>}
          <Progress value={delivered ? 1 : progress(tasks)} color="#fff" />
        </div>
        <div className="banner-tools">
          <button type="button" className="status-pill" aria-pressed={delivered} onClick={() => patch('works', id, { status: delivered ? 'activo' : 'entregado' })}>
            {delivered ? '✅ Entregado' : 'Marcar entregado'}
          </button>
          <IconButton icon={LuPencil} label="Editar trabajo" onClick={() => setForm({ type: 'work' })} />
          <IconButton icon={LuTrash2} label="Borrar trabajo" onClick={destroy} />
        </div>
      </header>

      <div className="work-grid">
        <div>
          <section className="block">
            <div className="block-head">
              <h2>Pendientes</h2>
              <Button small variant="ghost" icon={LuSparkles} onClick={() => setForm({ type: 'ai' })}>Ideas con IA</Button>
            </div>
            <TaskComposer workId={id} />
            {tasks.length > 0 && <ul className="task-list">{tasks.map((t) => <TaskRow key={t.id} task={t} />)}</ul>}
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
            ) : <p className="hint">Sin fecha de entrega todavía.</p>}
          </section>

          <section className="block">
            <div className="block-head">
              <h2>Archivos y enlaces</h2>
              <div className="head-tools">
                <Button small variant="ghost" icon={LuLink} onClick={() => setForm({ type: 'link' })}>Enlace</Button>
                <AttachButton label="Subir" onFiles={(list) => upload(list)} />
              </div>
            </div>
            {busy > 0 && <p className="hint uploading"><LuUpload aria-hidden /> Subiendo…</p>}
            {looseFiles.length ? (
              <div className="attachments">{looseFiles.map((a) => <Attachment key={a.id} item={a} />)}</div>
            ) : <p className="hint">Pega aquí el enlace del Word o sube fotos y archivos.</p>}
          </section>
        </div>

        <section className="block">
          <div className="block-head"><h2>Lo que hemos ido haciendo</h2></div>
          <Journal workId={id} />
        </section>
      </div>

      {form?.type === 'work' && <WorkForm work={work} onClose={close} />}
      {form?.type === 'event' && <EventForm event={form.event} workId={id} subjectId={work.subject_id} onClose={close} />}
      {form?.type === 'link' && <LinkForm workId={id} onClose={close} />}
      {form?.type === 'ai' && <SuggestModal work={work} subject={subject} onClose={close} />}
    </>
  );
}
