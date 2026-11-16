export const STORAGE_KEY = 'publishing-checklist:v1';
export const SCHEMA_VERSION = 1;

export const TYPES = Object.freeze({
  edit: { label: 'Edit', description: 'From scan to a carefully prepared edition.', icon: 'pen' },
  'edit-publish': { label: 'Edit/publish', description: 'The complete journey, from scan to shelf.', icon: 'book' },
  publish: { label: 'Publish', description: 'Bring a finished manuscript to your readers.', icon: 'send' },
});

const editorial = [
  'Have Chat, Claude, and Gemini each create an independent transcription',
  'Have Chat make a majority text of the three transcriptions',
  'Have chat format the screen version',
  'Have chat modernize spelling',
  'Have Claude audit the spelling modernization',
  'Have chat fix any mistakes Claude caught',
  'Human check a couple pages against the scan and simply read several pages',
  'Have chat make print version',
  'Visually check print version for correct gutters and blank pages',
];
const publishing = [
  'Upload print version to Lulu and get dimensions for cover',
  'Make cover',
  'Upload cover and publish print version',
  'Have chat make epub using cover',
  'Add Lulu widget to website',
  'Publish both ebooks to website',
];

export const DEFAULT_TEMPLATES = Object.freeze({
  edit: Object.freeze([...editorial, 'Send print and screen versions to publisher', 'Write description and send to publisher']),
  'edit-publish': Object.freeze([...editorial, 'Write description', ...publishing]),
  publish: Object.freeze([...publishing]),
});

export const MARGIN_NOTE = '- Inner (gutter): 0.85"\n- Outer: 0.50"\n- Top: 0.55"\n- Bottom: 0.55"';

export function uid() {
  return globalThis.crypto?.randomUUID?.() ?? `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function createInitialState() {
  return {
    version: SCHEMA_VERSION,
    templates: structuredClone(DEFAULT_TEMPLATES),
    projects: [],
    notes: [{ id: uid(), title: 'Print margins', text: MARGIN_NOTE, createdAt: Date.now(), updatedAt: Date.now() }],
  };
}

export function progress(project) {
  const total = project.items.length;
  const done = project.items.reduce((count, item) => count + Number(item.done), 0);
  return { total, done, ratio: total ? done / total : 0, finished: total > 0 && done === total };
}

export function compareProjects(a, b) {
  const ap = progress(a);
  const bp = progress(b);
  if (ap.finished !== bp.finished) return ap.finished ? 1 : -1;
  if (ap.finished) return (b.completedAt ?? b.createdAt) - (a.completedAt ?? a.createdAt) || b.createdAt - a.createdAt;
  return bp.ratio - ap.ratio || b.createdAt - a.createdAt;
}

export function sortedProjects(projects, filter = 'all') {
  return projects.filter(project => filter === 'all' || (filter === 'finished' ? progress(project).finished : !progress(project).finished)).sort(compareProjects);
}

export function createProject(name, type, templates, createdAt = Date.now()) {
  if (!Object.hasOwn(TYPES, type)) throw new Error('Choose a valid project type.');
  if (!name.trim()) throw new Error('Give your project a name.');
  if (!templates[type]?.length) throw new Error('The template needs at least one step.');
  return {
    id: uid(), name: name.trim(), type, createdAt, updatedAt: createdAt, completedAt: null,
    items: templates[type].map(text => ({ id: uid(), text, done: false })),
  };
}

export function updateCompletion(project, wasFinished, now = Date.now()) {
  const finished = progress(project).finished;
  if (finished && !wasFinished) project.completedAt = now;
  if (!finished) project.completedAt = null;
  project.updatedAt = now;
  return project;
}

export function toggleItem(project, itemId, now = Date.now()) {
  const item = project.items.find(item => item.id === itemId);
  if (!item) return project;
  const wasFinished = progress(project).finished;
  item.done = !item.done;
  return updateCompletion(project, wasFinished, now);
}

// Validate backups and stored state before accepting them; do not replace good data on errors.
export function validateState(value) {
  const fail = () => { throw new Error('This file is not a valid Publishing Checklist backup.'); };
  const object = item => item && typeof item === 'object' && !Array.isArray(item);
  const string = (item, max) => typeof item === 'string' && item.trim().length > 0 && item.length <= max;
  const timestamp = item => Number.isFinite(item) && item >= 0 && item <= 8640000000000000;
  const uniqueIds = list => list.every(item => object(item) && string(item.id, 150)) && new Set(list.map(item => item.id)).size === list.length;
  if (!object(value) || value.version !== SCHEMA_VERSION || !object(value.templates)) fail();
  for (const type of Object.keys(TYPES)) {
    if (!Array.isArray(value.templates[type]) || !value.templates[type].length || value.templates[type].length > 500 || !value.templates[type].every(text => string(text, 5000))) fail();
  }
  if (!Array.isArray(value.projects) || value.projects.length > 10000 || !uniqueIds(value.projects)) fail();
  if (!Array.isArray(value.notes) || value.notes.length > 10000 || !uniqueIds(value.notes)) fail();
  for (const project of value.projects) {
    if (!object(project) || !string(project.name, 200) || !Object.hasOwn(TYPES, project.type) || !timestamp(project.createdAt) || !timestamp(project.updatedAt)) fail();
    if (project.completedAt !== null && !timestamp(project.completedAt)) fail();
    if (!Array.isArray(project.items) || !project.items.length || project.items.length > 500 || !uniqueIds(project.items)) fail();
    if (!project.items.every(item => object(item) && string(item.text, 5000) && typeof item.done === 'boolean')) fail();
  }
  for (const note of value.notes) {
    if (!object(note) || !string(note.title, 200) || !string(note.text, 100000) || !timestamp(note.createdAt) || !timestamp(note.updatedAt)) fail();
  }
  return structuredClone(value);
}
