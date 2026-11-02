import { EVENT_KINDS } from '../people.js';
import { todayISO } from './date.js';

// Si Google retira un modelo, se prueba el siguiente de la lista.
const MODELS = ['gemini-flash-lite-latest', 'gemini-flash-latest', 'gemini-2.5-flash-lite', 'gemini-2.5-flash'];
const BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

async function generate(apiKey, body) {
  let last = null;
  for (const model of MODELS) {
    let res;
    try {
      res = await fetch(`${BASE}/${model}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify(body),
      });
    } catch {
      throw new Error('No se ha podido contactar con la IA. Revisa la conexión.');
    }
    if (res.ok) {
      const data = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('').trim();
      if (text) return text;
      last = 'La IA ha devuelto una respuesta vacía. Prueba a reformular la pregunta.';
      continue;
    }
    if (res.status === 400 || res.status === 401 || res.status === 403) {
      throw new Error('La clave de Gemini no es válida. Cámbiala en Ajustes.');
    }
    last = res.status === 429
      ? 'Se ha agotado el cupo gratis de la IA por ahora. Prueba dentro de un rato.'
      : 'La IA no está disponible ahora mismo. Prueba dentro de un rato.';
  }
  throw new Error(last);
}

export function groupContext(db) {
  const lines = [`Hoy es ${todayISO()}.`];
  for (const subject of db.subjects) {
    lines.push(`\nAsignatura: ${subject.name}`);
    for (const work of db.works.filter((w) => w.subject_id === subject.id)) {
      lines.push(`  Trabajo: ${work.title} (${work.status})${work.description ? `. ${work.description}` : ''}`);
      for (const task of db.tasks.filter((t) => t.work_id === work.id)) {
        const missing = task.assignees.filter((p) => !task.done_by.includes(p));
        const state = task.assignees.length
          ? (missing.length ? `falta ${missing.join(', ')}` : 'hecha')
          : (task.done_by.length ? 'hecha' : 'sin repartir');
        lines.push(`    Pendiente: ${task.title} [${state}]${task.due_date ? ` antes del ${task.due_date}` : ''}`);
      }
      for (const entry of db.entries.filter((e) => e.work_id === work.id).slice(-8)) {
        lines.push(`    Hecho por ${entry.author}: ${entry.body}`);
      }
    }
  }
  const upcoming = db.events.filter((e) => e.date >= todayISO());
  if (upcoming.length) lines.push('\nFechas:');
  for (const e of upcoming) {
    const subject = db.subjects.find((s) => s.id === e.subject_id);
    lines.push(`  ${e.date}${e.time ? ` ${e.time.slice(0, 5)}` : ''} ${EVENT_KINDS[e.kind].label}: ${e.title}${subject ? ` (${subject.name})` : ''}`);
  }
  return lines.join('\n');
}

const SYSTEM = `Eres la ayudante de un grupo de cinco compañeras de estudios: Paula, Belén, María, Raquel y Almudena.
Respondes en español, cercana y breve. Usa solo los datos del grupo para hablar de sus trabajos y fechas; si algo no aparece, dilo.
Puedes ayudar a organizarse, repartir tareas, preparar exámenes y explicar conceptos.`;

export function askChat(apiKey, db, me, history) {
  return generate(apiKey, {
    systemInstruction: { parts: [{ text: `${SYSTEM}\nEscribe ahora ${me}.\n\nDatos del grupo:\n${groupContext(db)}` }] },
    contents: history.slice(-16).map((m) => ({ role: m.role, parts: [{ text: m.body }] })),
  });
}

export async function suggestTasks(apiKey, db, work, subject) {
  const text = await generate(apiKey, {
    systemInstruction: { parts: [{ text: SYSTEM }] },
    contents: [{
      role: 'user',
      parts: [{ text: `Propón entre 4 y 7 pendientes concretos y cortos para avanzar en el trabajo "${work.title}" de "${subject?.name ?? ''}". ${work.description}\nNo repitas lo que ya existe.\n\n${groupContext(db)}` }],
    }],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: { type: 'ARRAY', items: { type: 'STRING' } },
    },
  });
  const list = JSON.parse(text);
  return Array.isArray(list) ? list.filter((t) => typeof t === 'string' && t.trim()) : [];
}
