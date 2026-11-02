import { useEffect, useRef, useState } from 'react';
import { LuCalendarPlus, LuExternalLink, LuFile, LuFileSpreadsheet, LuFileText, LuLink, LuPaperclip, LuPresentation, LuTrash2, LuX } from 'react-icons/lu';
import { EVENT_KINDS } from './people.js';
import { backend, newId, useStore } from './store.jsx';
import { Button, IconButton, useConfirm } from './ui.jsx';
import { clock, countdown, daysUntil, dayNum, monthShort } from './lib/date.js';
import { googleLink } from './lib/calendar.js';
import { formatSize, safeName, shrinkImage, tooBig } from './lib/files.js';

const urlCache = new Map();

async function signedUrl(path) {
  const hit = urlCache.get(path);
  if (hit && hit.at > Date.now() - 50 * 60000) return hit.url;
  const url = await backend.fileUrl(path);
  urlCache.set(path, { url, at: Date.now() });
  return url;
}

function iconFor(a) {
  if (a.kind === 'link') return LuLink;
  if (/pdf|word|text/.test(a.mime ?? '') || /\.(pdf|docx?|txt)$/i.test(a.name)) return LuFileText;
  if (/sheet|excel/.test(a.mime ?? '') || /\.xlsx?$/i.test(a.name)) return LuFileSpreadsheet;
  if (/presentation|powerpoint/.test(a.mime ?? '') || /\.pptx?$/i.test(a.name)) return LuPresentation;
  return LuFile;
}

export function Attachment({ item }) {
  const { removeWithFiles } = useStore();
  const confirm = useConfirm();
  const [url, setUrl] = useState(item.kind === 'link' ? item.url : null);
  useEffect(() => {
    if (item.kind === 'file') signedUrl(item.path).then(setUrl).catch(() => setUrl(null));
  }, [item.kind, item.path]);

  const destroy = async () => {
    const ok = await confirm({ title: `¿Borrar ${item.name}?`, action: 'Borrar' });
    if (ok) removeWithFiles('attachments', item.id, item.path ? [item.path] : []);
  };

  if (item.mime?.startsWith('image/') && url) {
    return (
      <figure className="thumb">
        <a href={url} target="_blank" rel="noreferrer"><img src={url} alt={item.name} loading="lazy" /></a>
        <button type="button" className="thumb-del" aria-label={`Borrar ${item.name}`} onClick={destroy}><LuX aria-hidden /></button>
      </figure>
    );
  }
  const Icon = iconFor(item);
  return (
    <div className="file">
      <a className="file-open" href={url ?? undefined} target="_blank" rel="noreferrer">
        <span className="file-icon"><Icon aria-hidden /></span>
        <span className="file-text">
          <span className="file-name">{item.name}</span>
          <span className="file-meta">{item.kind === 'link' ? new URL(item.url).hostname : formatSize(item.size)}</span>
        </span>
      </a>
      <IconButton icon={LuTrash2} label={`Borrar ${item.name}`} onClick={destroy} />
    </div>
  );
}

export function useUploader(workId) {
  const { me, add, toast } = useStore();
  const [busy, setBusy] = useState(0);
  const upload = async (fileList, entryId = null) => {
    const files = [...fileList];
    setBusy((n) => n + files.length);
    for (const original of files) {
      try {
        if (tooBig(original)) {
          toast(`${original.name} pesa más de 50 MB. Súbelo a Drive y añade el enlace.`);
          continue;
        }
        const file = await shrinkImage(original);
        const path = `${workId}/${newId()}-${safeName(file.name)}`;
        await backend.upload(path, file);
        await add('attachments', {
          work_id: workId, entry_id: entryId, kind: 'file', name: file.name, path, mime: file.type, size: file.size, created_by: me,
        });
      } catch (e) {
        toast(`No se ha subido ${original.name}: ${e.message}`);
      } finally {
        setBusy((n) => n - 1);
      }
    }
  };
  return { upload, busy };
}

export function AttachButton({ onFiles, label = 'Adjuntar', small = true, variant = 'ghost' }) {
  const input = useRef(null);
  return (
    <>
      <input
        ref={input}
        type="file"
        multiple
        hidden
        aria-label={label}
        onChange={(e) => { onFiles([...e.target.files]); e.target.value = ''; }}
      />
      <Button variant={variant} small={small} icon={LuPaperclip} onClick={() => input.current.click()}>{label}</Button>
    </>
  );
}

export function Ticket({ event, onEdit }) {
  const { db } = useStore();
  const subject = db.subjects.find((s) => s.id === event.subject_id);
  const kind = EVENT_KINDS[event.kind];
  const left = daysUntil(event.date);
  const urgent = left >= 0 && left <= 3;
  return (
    <article className={`ticket${urgent ? ' ticket-urgent' : ''}${left < 0 ? ' ticket-past' : ''}`} style={{ '--c': subject?.color ?? kind.color }}>
      <button type="button" className="ticket-main" onClick={() => onEdit?.(event)} aria-label={`Editar ${event.title}`}>
        <span className="ticket-date">
          <b>{dayNum(event.date)}</b>
          <span>{monthShort(event.date)}</span>
        </span>
        <span className="ticket-body">
          <span className="ticket-kind">{kind.emoji} {kind.label}{event.time ? ` a las ${clock(event.time)}` : ''}</span>
          <span className="ticket-title">{event.title}</span>
          {subject && <span className="ticket-subject">{subject.name}</span>}
        </span>
      </button>
      <div className="ticket-foot">
        <span className="ticket-count">{countdown(event.date)}</span>
        <a className="ticket-google" href={googleLink(event, subject)} target="_blank" rel="noreferrer">
          <LuCalendarPlus aria-hidden /> Google Calendar <LuExternalLink aria-hidden className="tiny" />
        </a>
      </div>
    </article>
  );
}
