import { createContext, useCallback, useContext, useEffect, useId, useRef, useState } from 'react';
import { LuCheck, LuX } from 'react-icons/lu';
import { colorOf, NAMES } from './people.js';

export function Avatar({ name, size = 'md', done, muted, online }) {
  const cls = ['avatar', `avatar-${size}`, muted && 'avatar-muted', online && 'avatar-online'].filter(Boolean).join(' ');
  return (
    <span className={cls} style={{ '--c': colorOf(name) }} title={name}>
      {name?.[0] ?? '?'}
      {done && <span className="avatar-tick"><LuCheck aria-hidden /></span>}
    </span>
  );
}

export function Name({ name }) {
  return <strong className="marker" style={{ '--c': colorOf(name) }}>{name}</strong>;
}

export function Button({ variant = 'primary', icon: Icon, children, small, ...props }) {
  return (
    <button type="button" className={`btn btn-${variant}${small ? ' btn-small' : ''}`} {...props}>
      {Icon && <Icon aria-hidden />}
      {children && <span>{children}</span>}
    </button>
  );
}

export function IconButton({ icon: Icon, label, ...props }) {
  return (
    <button type="button" className="icon-btn" aria-label={label} title={label} {...props}>
      <Icon aria-hidden />
    </button>
  );
}

export function Field({ label, hint, children }) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {children(id)}
      {hint && <p className="hint">{hint}</p>}
    </div>
  );
}

export function PeoplePicker({ value, onChange, label = 'Para quién' }) {
  const toggle = (name) => onChange(value.includes(name) ? value.filter((n) => n !== name) : [...value, name]);
  return (
    <div className="picker" role="group" aria-label={label}>
      {NAMES.map((name) => (
        <button
          key={name}
          type="button"
          className="picker-item"
          aria-pressed={value.includes(name)}
          onClick={() => toggle(name)}
        >
          <Avatar name={name} size="sm" muted={!value.includes(name)} />
          <span>{name}</span>
        </button>
      ))}
    </div>
  );
}

export function Modal({ title, onClose, children }) {
  const ref = useRef(null);
  useEffect(() => {
    const previous = document.activeElement;
    const field = ref.current?.querySelector('input:not([type=file]), textarea');
    (field ?? ref.current)?.focus();
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.classList.add('no-scroll');
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.classList.remove('no-scroll');
      previous?.focus?.();
    };
  }, [onClose]);
  return (
    <div className="modal-back" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <section className="modal" role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={ref}>
        <header className="modal-head">
          <h2>{title}</h2>
          <IconButton icon={LuX} label="Cerrar" onClick={onClose} />
        </header>
        <div className="modal-body">{children}</div>
      </section>
    </div>
  );
}

const ConfirmContext = createContext(() => Promise.resolve(false));
export const useConfirm = () => useContext(ConfirmContext);

export function ConfirmHost({ children }) {
  const [ask, setAsk] = useState(null);
  const confirm = useCallback((opts) => new Promise((resolve) => setAsk({ ...opts, resolve })), []);
  const close = useCallback((answer) => {
    setAsk((a) => { a?.resolve(answer); return null; });
  }, []);
  const cancel = useCallback(() => close(false), [close]);
  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {ask && (
        <Modal title={ask.title} onClose={cancel}>
          {ask.body && <p className="confirm-text">{ask.body}</p>}
          <div className="form-actions">
            <Button variant="ghost" onClick={cancel}>Cancelar</Button>
            <Button variant="danger" onClick={() => close(true)}>{ask.action}</Button>
          </div>
        </Modal>
      )}
    </ConfirmContext.Provider>
  );
}

export function Empty({ emoji, title, children }) {
  return (
    <div className="empty">
      <span className="empty-emoji" aria-hidden>{emoji}</span>
      <p className="empty-title">{title}</p>
      {children}
    </div>
  );
}

export function Progress({ value, color }) {
  const pct = Math.round(value * 100);
  return (
    <div className="progress" role="img" aria-label={`${pct}% hecho`} style={{ '--c': color }}>
      <span style={{ width: `${pct}%` }} />
    </div>
  );
}
