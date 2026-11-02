import { useEffect, useRef, useState } from 'react';
import { LuSend, LuTrash2 } from 'react-icons/lu';
import { backend, newId, useStore } from '../store.jsx';
import { Avatar, Button, IconButton, useConfirm } from '../ui.jsx';
import { askChat } from '../lib/ai.js';

const IDEAS = [
  '¿Qué tengo pendiente esta semana?',
  '¿Qué es lo más urgente del grupo?',
  'Reparte lo que queda de forma justa',
  'Hazme un plan de estudio para el próximo examen',
];

export function Assistant({ onSettings }) {
  const { db, me, add, remove, toast } = useStore();
  const confirm = useConfirm();
  const [text, setText] = useState('');
  const [thinking, setThinking] = useState(false);
  const end = useRef(null);
  const messages = db.ai_messages;
  const key = db.settings.gemini_key;
  const ready = Boolean(key) || backend.demo;

  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [messages.length, thinking]);

  const send = async (question) => {
    const q = question.trim();
    if (!q || thinking) return;
    setText('');
    setThinking(true);
    const mine = { id: newId(), author: me, role: 'user', body: q };
    try {
      await add('ai_messages', mine);
      const answer = key
        ? await askChat(key, db, me, [...messages, mine])
        : 'En la demostración no hay IA conectada. Con vuestra clave gratis de Gemini responderé con los datos reales del grupo.';
      await add('ai_messages', { id: newId(), author: null, role: 'model', body: answer });
    } catch (e) {
      toast(e.message);
    } finally {
      setThinking(false);
    }
  };

  const clear = async () => {
    const ok = await confirm({ title: '¿Vaciar la conversación?', body: 'Se borra para las cinco.', action: 'Vaciar' });
    if (ok) messages.forEach((m) => remove('ai_messages', m.id));
  };

  return (
    <div className="chat">
      <div className="page-head">
        <h1>Pregunta</h1>
        {messages.length > 0 && <IconButton icon={LuTrash2} label="Vaciar conversación" onClick={clear} />}
      </div>

      {!ready ? (
        <div className="ai-setup">
          <p className="empty-title">Falta conectar la IA</p>
          <p>Es gratis y solo hay que hacerlo una vez: crea una clave en Google AI Studio y pégala en Ajustes.</p>
          <Button onClick={onSettings}>Abrir Ajustes</Button>
        </div>
      ) : (
        <>
          <div className="messages" aria-live="polite">
            {messages.length === 0 && (
              <div className="ideas">
                <p>La IA conoce vuestros trabajos, pendientes y fechas. Prueba con:</p>
                {IDEAS.map((idea) => <button key={idea} type="button" onClick={() => send(idea)}>{idea}</button>)}
              </div>
            )}
            {messages.map((m) => (
              <div key={m.id} className={`bubble bubble-${m.role}`}>
                {m.role === 'user' ? <Avatar name={m.author} size="sm" /> : <span className="bot" aria-hidden>✨</span>}
                <p>{m.body}</p>
              </div>
            ))}
            {thinking && <div className="bubble bubble-model"><span className="bot" aria-hidden>✨</span><p className="loading">Pensando…</p></div>}
            <div ref={end} />
          </div>
          <form className="chat-form" onSubmit={(e) => { e.preventDefault(); send(text); }}>
            <input aria-label="Tu pregunta" placeholder="Escribe tu pregunta…" value={text} onChange={(e) => setText(e.target.value)} />
            <Button type="submit" icon={LuSend} aria-label="Enviar" disabled={!text.trim() || thinking}>Enviar</Button>
          </form>
          <p className="hint">Se envían a Google los títulos y notas del grupo. No escribáis datos personales.</p>
        </>
      )}
    </div>
  );
}
