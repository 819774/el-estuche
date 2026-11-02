import { useCallback, useMemo, useState } from 'react';
import { LuChevronLeft, LuChevronRight, LuPlus } from 'react-icons/lu';
import { useStore, isDone } from '../store.jsx';
import { EVENT_KINDS } from '../people.js';
import { Button, Empty, IconButton } from '../ui.jsx';
import { EventForm } from '../forms.jsx';
import { Ticket } from '../shared.jsx';
import { longDate, monthGrid, monthName, toISO, todayISO } from '../lib/date.js';
import { GoogleBox } from './Settings.jsx';

const WEEK = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

export function CalendarView() {
  const { db } = useStore();
  const now = new Date();
  const [cursor, setCursor] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const [day, setDay] = useState(todayISO());
  const [form, setForm] = useState(null);
  const close = useCallback(() => setForm(null), []);

  const byDay = useMemo(() => {
    const map = {};
    const push = (date, item) => { (map[date] ??= []).push(item); };
    db.events.forEach((e) => push(e.date, { color: EVENT_KINDS[e.kind].color }));
    db.tasks.filter((t) => t.due_date && !isDone(t)).forEach((t) => push(t.due_date, { color: '#A78BFA' }));
    return map;
  }, [db.events, db.tasks]);

  const shift = (n) => setCursor(({ y, m }) => {
    const d = new Date(y, m + n, 1);
    return { y: d.getFullYear(), m: d.getMonth() };
  });

  const today = todayISO();
  const dayEvents = db.events.filter((e) => e.date === day);
  const dayTasks = db.tasks.filter((t) => t.due_date === day && !isDone(t));
  const upcoming = db.events.filter((e) => e.date >= today).sort((a, b) => a.date.localeCompare(b.date));

  return (
    <>
      <div className="page-head">
        <h1>Fechas</h1>
        <Button icon={LuPlus} onClick={() => setForm({ date: day })}>Nueva fecha</Button>
      </div>

      <div className="cal-layout">
        <section className="cal" aria-label="Calendario">
          <div className="cal-head">
            <IconButton icon={LuChevronLeft} label="Mes anterior" onClick={() => shift(-1)} />
            <h2>{monthName(new Date(cursor.y, cursor.m, 1))}</h2>
            <IconButton icon={LuChevronRight} label="Mes siguiente" onClick={() => shift(1)} />
          </div>
          <div className="cal-grid">
            {WEEK.map((d) => <span key={d} className="cal-week" aria-hidden>{d}</span>)}
            {monthGrid(cursor.y, cursor.m).map((date) => {
              const iso = toISO(date);
              const items = byDay[iso] ?? [];
              return (
                <button
                  key={iso}
                  type="button"
                  className={`cal-day${date.getMonth() !== cursor.m ? ' cal-out' : ''}${iso === today ? ' cal-today' : ''}`}
                  aria-pressed={iso === day}
                  aria-label={`${longDate(iso)}${items.length ? `, ${items.length} ${items.length === 1 ? 'cosa' : 'cosas'}` : ''}`}
                  onClick={() => setDay(iso)}
                >
                  <span>{date.getDate()}</span>
                  <span className="cal-dots" aria-hidden>
                    {items.slice(0, 3).map((item, i) => <i key={i} style={{ background: item.color }} />)}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <div className="cal-side">
          <section className="block">
            <div className="block-head">
              <h2 className="cap">{longDate(day)}</h2>
              <Button small variant="ghost" icon={LuPlus} onClick={() => setForm({ date: day })}>Añadir</Button>
            </div>
            {dayEvents.length + dayTasks.length ? (
              <div className="ticket-col">
                {dayEvents.map((e) => <Ticket key={e.id} event={e} onEdit={(ev) => setForm({ event: ev })} />)}
                {dayTasks.map((t) => <a key={t.id} className="day-task" href={`#/trabajo/${t.work_id}`}>☑️ {t.title}</a>)}
              </div>
            ) : <p className="hint">Nada este día.</p>}
          </section>
          <GoogleBox />
        </div>
      </div>

      <section className="block">
        <div className="block-head"><h2>Lo que viene</h2></div>
        {upcoming.length ? (
          <div className="ticket-row">
            {upcoming.map((e) => <Ticket key={e.id} event={e} onEdit={(ev) => setForm({ event: ev })} />)}
          </div>
        ) : <Empty emoji="🗓️" title="Añade la primera entrega o examen" />}
      </section>

      {form && <EventForm event={form.event} date={form.date} onClose={close} />}
    </>
  );
}
