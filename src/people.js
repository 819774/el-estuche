export const PEOPLE = [
  { name: 'Paula', color: '#FF4FA3' },
  { name: 'Belén', color: '#FF8A1F' },
  { name: 'María', color: '#FFD60A' },
  { name: 'Raquel', color: '#12C9A4' },
  { name: 'Almudena', color: '#A78BFA' },
];

export const NAMES = PEOPLE.map((p) => p.name);
export const colorOf = (name) => PEOPLE.find((p) => p.name === name)?.color ?? '#C9C4E8';

export const SUBJECT_COLORS = [
  '#38BDF8', '#FF4FA3', '#FF8A1F', '#FFD60A', '#12C9A4', '#A78BFA', '#A3E635', '#FF6B6B',
];
export const SUBJECT_EMOJI = ['📚', '✏️', '🧠', '🧩', '🌱', '💬', '🎓', '🔬', '🎨', '🌍', '📐', '👩‍🏫'];

export const EVENT_KINDS = {
  entrega: { label: 'Entrega', emoji: '📦', color: '#FF4FA3' },
  examen: { label: 'Examen', emoji: '📝', color: '#FFD60A' },
  otro: { label: 'Otra fecha', emoji: '📌', color: '#38BDF8' },
};
