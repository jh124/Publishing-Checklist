import {
  STORAGE_KEY, TYPES, createInitialState, createProject, progress, sortedProjects,
  toggleItem, updateCompletion, validateState, uid,
} from './core.js?v=2';

const icons = {
  plus: '<path d="M12 5v14M5 12h14"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  chevron: '<path d="m7 10 5 5 5-5"/>',
  more: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
  pen: '<path d="m15 4 5 5M4 20l5-1L20 8a2 2 0 0 0-5-5L4 14l-1 6Z"/><path d="m5 14 5 5"/>',
  book: '<path d="M4 4h13a3 3 0 0 1 3 3v14H6a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3M7 4v13M3 17h17M10 8h6M10 11h4"/>',
  send: '<path d="m21 3-7 18-4-8-8-4 19-6ZM10 13 21 3"/>',
  projects: '<rect x="4" y="3" width="16" height="19" rx="3"/><path d="m8 9 1.5 1.5L12 8M14 9h3m-9 7 1.5 1.5L12 15m2 1h3"/>',
  notes: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9l-6-6Z"/><path d="M14 3v6h6M8 13h8M8 17h6"/>',
  copy: '<rect x="8" y="8" width="12" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  trash: '<path d="M3 6h18M9 6V3h6v3m-10 0 1 15h12l1-15M10 10v7m4-7v7"/>',
  settings: '<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3" fill="currentColor" stroke="none"/><circle cx="15" cy="17" r="3" fill="currentColor" stroke="none"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
  spark: '<path d="m12 2 2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5L12 2Z"/>',
};
const icon = (name, className = '') => `<svg viewBox="0 0 24 24" aria-hidden="true" class="${className}">${icons[name] ?? icons.book}</svg>`;
const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const main = document.getElementById('main');
const editor = document.getElementById('editor-dialog');
const editorContent = document.getElementById('editor-content');
const confirmDialog = document.getElementById('confirm-dialog');
let state;
let damagedStorage = false;
let saved = true;
let filter = 'all';
let search = '';
let page = location.hash === '#notes' ? 'notes' : 'projects';
const expanded = new Set();
let toastTimer;
let currentEditor = null;
let confirmResolve = null;

try {
  const raw = localStorage.getItem(STORAGE_KEY);
  state = raw ? validateState(JSON.parse(raw)) : createInitialState();
  if (!raw) localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
} catch (error) {
  state = createInitialState();
  saved = false;
  try { damagedStorage = !!localStorage.getItem(STORAGE_KEY); } catch {}
  showStorageWarning(damagedStorage
    ? 'Your saved data could not be read. The original is preserved. Export a backup to recover it, or restore a valid backup before continuing.'
    : 'This browser could not save your workspace. Your changes will last for this visit. Export a backup before closing the app.');
}

function showStorageWarning(message) {
  const warning = document.getElementById('storage-warning');
  warning.textContent = message;
  warning.hidden = false;
}

function persist() {
  if (damagedStorage) { saved = false; updateSaveLabel(); return; }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    saved = true;
    document.getElementById('storage-warning').hidden = true;
  } catch {
    saved = false;
    showStorageWarning('Your latest changes could not be saved on this device. They are still available in this visit. Export a backup before closing the app.');
  }
  updateSaveLabel();
}

function updateSaveLabel() {
  const label = document.getElementById('saved-indicator');
  label.innerHTML = `<i style="${saved ? '' : 'background:#b68453'}"></i>${saved ? 'Saved on this device' : 'Changes are not saved'}`;
}

function toast(message) {
  clearTimeout(toastTimer);
  const element = document.getElementById('toast');
  element.textContent = message;
  element.hidden = false;
  toastTimer = setTimeout(() => { element.hidden = true; }, 3200);
}

function counts() {
  const finished = state.projects.filter(project => progress(project).finished).length;
  return { all: state.projects.length, finished, unfinished: state.projects.length - finished };
}

function render() {
  closeMenus();
  document.getElementById('nav-projects').innerHTML = `${icon('projects')}Projects`;
  document.getElementById('nav-notes').innerHTML = `${icon('notes')}Prompts / Notes`;
  for (const name of ['projects', 'notes']) {
    const link = document.getElementById(`nav-${name}`);
    if (page === name) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current');
  }
  document.title = `${page === 'projects' ? 'Projects' : 'Prompts / Notes'} · Publishing Checklist`;
  main.innerHTML = page === 'projects' ? renderProjects() : renderNotes();
  const count = page === 'projects' ? state.projects.length : state.notes.length;
  document.getElementById('footer-count').textContent = `${count} ${page === 'projects' ? `project${count === 1 ? '' : 's'}` : `note${count === 1 ? '' : 's'}`} in your workspace`;
  updateSaveLabel();
}

function renderProjects() {
  const count = counts();
  const done = state.projects.reduce((sum, project) => sum + progress(project).done, 0);
  const projects = sortedProjects(state.projects, filter);
  let finishedDividerShown = false;
  const projectHTML = projects.map(project => {
    let divider = '';
    if (filter === 'all' && progress(project).finished && count.unfinished && !finishedDividerShown) {
      divider = '<div class="finished-divider">FINISHED PROJECTS</div>';
      finishedDividerShown = true;
    }
    return divider + renderProject(project);
  }).join('');
  return `
    <section class="page-heading" aria-labelledby="page-title">
      <div><p class="eyebrow">YOUR PUBLISHING WORKSPACE</p><h1 id="page-title">Projects</h1><p class="page-description">From the first transcription to the final page.</p></div>
      <button class="button" data-action="new-project">${icon('plus')}Add project</button>
    </section>
    <div class="stats" aria-label="Workspace summary">
      <div class="stat"><strong>${String(count.unfinished).padStart(2, '0')}</strong><span>in progress</span></div>
      <div class="stat"><strong>${String(count.finished).padStart(2, '0')}</strong><span>finished</span></div>
      <div class="stat"><strong>${String(done).padStart(2, '0')}</strong><span>steps completed</span></div>
    </div>
    <div class="toolbar">
      <div class="filters" role="group" aria-label="Filter projects">${['all', 'unfinished', 'finished'].map(value => `<button class="filter ${filter === value ? 'active' : ''}" data-filter="${value}" aria-pressed="${filter === value}">${value === 'all' ? 'All' : value === 'unfinished' ? 'Unfinished' : 'Finished'} <span>${count[value]}</span></button>`).join('')}</div>
      <div class="menu-wrap"><button class="button subtle" data-toggle-menu="template-menu" aria-expanded="false" aria-controls="template-menu">${icon('settings')}Templates${icon('chevron')}</button>
        <div id="template-menu" class="dropdown" hidden><p class="menu-caption">EDIT A TEMPLATE</p>${Object.entries(TYPES).map(([type, info]) => `<button data-action="edit-template" data-type="${type}">${info.label}<span>${state.templates[type].length} steps</span></button>`).join('')}<p class="menu-help">Template changes apply to new projects.</p></div>
      </div>
    </div>
    <section class="project-list" aria-label="Projects">${projects.length ? projectHTML : renderEmptyProjects(count.all === 0)}</section>
    ${!count.all ? renderTemplateCards() : ''}`;
}

function renderProject(project) {
  const status = progress(project);
  const percent = Math.round(status.ratio * 100);
  const open = expanded.has(project.id);
  const next = project.items.find(item => !item.done);
  const name = escape(project.name);
  const id = escape(project.id);
  const circumference = 2 * Math.PI * 17;
  return `<article class="project-card project-type-${project.type} ${open ? 'expanded' : ''} ${status.finished ? 'finished' : ''}" data-project="${id}">
    <button class="project-summary" id="project-summary-${id}" data-action="expand-project" data-id="${id}" aria-expanded="${open}" aria-controls="project-details-${id}">
      <span class="project-symbol">${icon(status.finished ? 'check' : TYPES[project.type].icon)}</span>
      <span class="project-info"><span class="project-title-row"><span class="project-title">${name}</span><span class="badge">${TYPES[project.type].label}</span></span><span class="project-next">${status.finished ? `<em>All done.</em> Finished ${formatDate(project.completedAt ?? project.updatedAt)}` : `<em>Up next</em>${escape(next.text)}`}</span></span>
      <span class="project-status"><span class="project-progress-label"><strong>${status.done} of ${status.total}</strong>steps complete</span><span class="ring" role="img" aria-label="${percent}% complete, ${status.done} of ${status.total} steps"><svg viewBox="0 0 42 42" aria-hidden="true"><circle class="track" cx="21" cy="21" r="17"/><circle class="fill" cx="21" cy="21" r="17" stroke-dasharray="${circumference}" stroke-dashoffset="${circumference * (1 - status.ratio)}"/></svg><span class="ring-number">${status.finished ? icon('check') : `${percent}%`}</span></span>${icon('chevron', 'summary-chevron')}</span>
    </button>
    <div id="project-details-${id}" class="project-details" ${open ? '' : 'hidden'}>
      <div class="details-toolbar"><p>THE CHECKLIST <span>· ${status.done}/${status.total}</span></p><div class="menu-wrap"><button class="button secondary" data-toggle-menu="edit-menu-${id}" aria-expanded="false" aria-controls="edit-menu-${id}">${icon('pen')}Edit${icon('chevron')}</button><div class="dropdown" id="edit-menu-${id}" hidden><button data-action="edit-project" data-id="${id}">Edit just this checklist</button><button data-action="edit-template" data-type="${project.type}">Edit ${TYPES[project.type].label} template</button></div></div></div>
      <ol class="checklist">${project.items.map((item, index) => `<li><label><input type="checkbox" id="step-${id}-${escape(item.id)}" data-item="${escape(item.id)}" data-project-id="${id}" ${item.done ? 'checked' : ''}><span>${escape(item.text)}</span><span class="checklist-step-number" aria-hidden="true">${String(index + 1).padStart(2, '0')}</span></label></li>`).join('')}</ol>
    </div>
  </article>`;
}

function renderEmptyProjects(isFirst) {
  return `<div class="empty-state">
    <div class="empty-illustration" aria-hidden="true"><span class="book-one"></span><span class="book-two">${icon('check')}</span>${icon('spark', 'spark')}</div>
    <h2>${isFirst ? 'Every book begins with a first step.' : filter === 'finished' ? 'Good books take a little time.' : 'A clear desk, a fresh chapter.'}</h2>
    <p>${isFirst ? 'Add a project, choose a workflow, and take it one step at a time.' : filter === 'finished' ? 'Your completed projects will find their home here.' : 'No unfinished projects here. Ready for your next book?'}</p>
    <button class="button" data-action="new-project">${icon('plus')}${isFirst ? 'Create your first project' : 'Add a project'}</button>
  </div>`;
}

function renderTemplateCards() {
  return `<section class="template-section"><div class="section-heading"><h2>A workflow for every kind of project</h2><span>Ready to use. Yours to edit.</span></div><div class="template-grid">${Object.entries(TYPES).map(([type, info]) => `<button class="template-card" data-action="new-project" data-type="${type}"><span class="template-top">${icon(info.icon)}<span>${state.templates[type].length} steps</span></span><strong>${info.label}</strong><p>${info.description}</p></button>`).join('')}</div></section>`;
}

function renderNotes() {
  return `<section class="page-heading notes-heading" aria-labelledby="page-title"><div><p class="eyebrow">WORDS WORTH KEEPING</p><h1 id="page-title">Prompts / Notes</h1><p class="page-description">Your useful prompts, small details, and good ideas.</p></div><button class="button" data-action="new-note">${icon('plus')}Add new</button></section>
    <div class="note-toolbar"><p>Keep the details close at hand.</p><label class="search-field">${icon('search')}<input type="search" id="note-search" placeholder="Search your notes" aria-label="Search notes" value="${escape(search)}"></label></div>
    <section class="note-grid" id="note-grid" aria-label="Prompts and notes">${renderNoteCards()}</section>`;
}

function renderNoteCards() {
  const query = search.trim().toLocaleLowerCase();
  const notes = state.notes.filter(note => `${note.title}\n${note.text}`.toLocaleLowerCase().includes(query));
  return notes.map(note => `<article class="note-card"><div class="note-heading"><h2>${escape(note.title)}</h2><div class="menu-wrap"><button class="icon-button" data-toggle-menu="note-menu-${escape(note.id)}" aria-label="Options for ${escape(note.title)}" aria-expanded="false" aria-controls="note-menu-${escape(note.id)}">${icon('more')}</button><div id="note-menu-${escape(note.id)}" class="dropdown" hidden><button data-action="edit-note" data-id="${escape(note.id)}">Edit note</button><button class="danger-text" data-action="delete-note" data-id="${escape(note.id)}">Delete note</button></div></div></div><pre>${escape(note.text)}</pre><div class="note-card-footer"><time datetime="${new Date(note.updatedAt).toISOString()}">Updated ${formatDate(note.updatedAt)}</time><button class="copy-button" data-action="copy-note" data-id="${escape(note.id)}" aria-label="Copy ${escape(note.title)}">${icon('copy')}Copy text</button></div></article>`).join('') + (query && notes.length === 0 ? '<div class="empty-state"><h2>No matching notes.</h2><p>Try a different word or add something new.</p></div>' : '') + `<button class="add-note-card" data-action="new-note">${icon('plus')}A place for your next idea</button>`;
}

function formatDate(timestamp) {
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(timestamp);
}

function closeMenus() {
  document.querySelectorAll('.dropdown').forEach(menu => { menu.hidden = true; });
  document.querySelectorAll('[data-toggle-menu], #data-menu-button').forEach(button => button.setAttribute('aria-expanded', 'false'));
}

function toggleMenu(button, id) {
  const menu = document.getElementById(id);
  const open = menu.hidden;
  closeMenus();
  menu.hidden = !open;
  button.setAttribute('aria-expanded', String(open));
}

function dialogHeader(eyebrow, title) {
  return `<div class="dialog-header"><div><p class="eyebrow">${eyebrow}</p><h2 id="editor-title">${escape(title)}</h2></div><button type="button" class="icon-button" data-close="editor-dialog" aria-label="Close">${icon('close')}</button></div>`;
}

function openEditor(context, html, focusSelector) {
  closeMenus();
  currentEditor = context;
  editorContent.innerHTML = html;
  editor.setAttribute('aria-labelledby', 'editor-title');
  if (!editor.open) editor.showModal();
  if (focusSelector) editorContent.querySelector(focusSelector)?.focus();
}

function newProject(type = 'edit-publish') {
  if (!Object.hasOwn(TYPES, type)) type = 'edit-publish';
  openEditor({ mode: 'new-project' }, `<form id="project-form">${dialogHeader('A NEW CHAPTER', 'Start a project')}<div class="form-field"><label class="field-label" for="project-name">Project name</label><input id="project-name" class="text-input" name="name" required maxlength="200" placeholder="The title of your next book" autocomplete="off"></div><fieldset class="type-options"><legend class="field-label">Choose your workflow</legend>${Object.entries(TYPES).map(([key, info]) => `<label class="type-option"><input type="radio" name="type" value="${key}" ${key === type ? 'checked' : ''}>${icon(info.icon)}<span class="type-option-copy"><strong>${info.label}</strong><small>${info.description}</small></span><span class="type-option-count">${state.templates[key].length} steps</span></label>`).join('')}</fieldset><p class="form-error" id="form-error" hidden></p><div class="dialog-actions"><button type="button" class="button secondary" data-close="editor-dialog">Cancel</button><button type="submit" class="button">Create project${icon('plus')}</button></div></form>`, '#project-name');
}

function newNote(note = null) {
  openEditor({ mode: note ? 'edit-note' : 'new-note', id: note?.id }, `<form id="note-form">${dialogHeader('YOUR WORDS, AT HAND', note ? 'Edit your note' : 'Add a prompt or note')}<div class="form-field"><label class="field-label" for="note-title">Title</label><input class="text-input" id="note-title" name="title" required maxlength="200" placeholder="Give it a useful name" value="${escape(note?.title ?? '')}" autocomplete="off"></div><div class="form-field"><label class="field-label" for="note-text">Prompt or note</label><textarea id="note-text" class="text-input" name="text" required maxlength="100000" placeholder="A prompt to reuse, a detail to remember…" rows="8">${escape(note?.text ?? '')}</textarea></div><p class="form-error" id="form-error" hidden></p><div class="dialog-actions"><button class="button secondary" type="button" data-close="editor-dialog">Cancel</button><button class="button" type="submit">${note ? 'Save changes' : 'Add note'}</button></div></form>`, '#note-title');
}

function editChecklist(project = null, type = project?.type) {
  const template = !project;
  const items = template ? state.templates[type].map(text => ({ id: uid(), text, done: false })) : structuredClone(project.items);
  openEditor({ mode: template ? 'template' : 'project', id: project?.id, type, items }, `<form id="checklist-form">${dialogHeader(template ? 'MAKE IT YOURS' : 'THIS PROJECT ONLY', template ? `${TYPES[type].label} template` : 'Edit your checklist')}<p class="dialog-description">${template ? 'These steps will be used for new projects. Your existing projects keep their own checklists.' : 'Change this project’s name or steps. Your template and other projects stay as they are.'}</p>${template ? '' : `<div class="form-field"><label class="field-label" for="edit-project-name">Project name</label><input class="text-input" id="edit-project-name" name="name" required maxlength="200" value="${escape(project.name)}"></div>`}<div class="step-editor-heading"><span class="field-label">Checklist steps</span><span>In the order you set</span></div><div class="step-editor" id="step-editor">${items.map((item, index) => renderEditorRow(item, index)).join('')}</div><button type="button" class="button secondary add-step" data-action="add-step">${icon('plus')}Add step</button><p class="form-error" id="form-error" hidden></p><div class="dialog-actions ${template ? '' : 'editor-footer'}">${template ? '' : '<button class="delete-project" type="button" data-action="delete-project">Delete project</button>'}<div style="display:flex;gap:8px"><button type="button" class="button secondary" data-close="editor-dialog">Cancel</button><button class="button" type="submit">${template ? 'Save template' : 'Save changes'}</button></div></div></form>`, template ? '#step-editor textarea' : '#edit-project-name');
}

function renderEditorRow(item, index) {
  return `<div class="step-editor-row" data-step-id="${escape(item.id)}"><span class="step-index" aria-hidden="true">${String(index + 1).padStart(2, '0')}</span><textarea class="text-input" required maxlength="5000" aria-label="Step ${index + 1}" rows="2">${escape(item.text)}</textarea><button type="button" class="icon-button" data-action="remove-step" aria-label="Remove step ${index + 1}">${icon('trash')}</button></div>`;
}

function editorItems() {
  return [...document.querySelectorAll('#step-editor .step-editor-row')].map(row => {
    const previous = currentEditor.items.find(item => item.id === row.dataset.stepId);
    return { id: row.dataset.stepId, text: row.querySelector('textarea').value.trim(), done: previous?.done ?? false };
  });
}

function setFormError(message) {
  const element = document.getElementById('form-error');
  element.textContent = message;
  element.hidden = false;
}

function confirmAction(title, description, action = 'Delete', danger = true) {
  document.getElementById('confirm-title').textContent = title;
  document.getElementById('confirm-description').textContent = description;
  const submit = document.getElementById('confirm-submit');
  submit.textContent = action;
  submit.className = `button ${danger ? 'danger' : ''}`;
  confirmDialog.setAttribute('aria-labelledby', 'confirm-title');
  confirmDialog.setAttribute('aria-describedby', 'confirm-description');
  confirmDialog.showModal();
  confirmDialog.querySelector('[data-close]')?.focus();
  return new Promise(resolve => { confirmResolve = resolve; });
}

async function copyNote(note) {
  try {
    if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
    await navigator.clipboard.writeText(note.text);
    toast('Note copied to your clipboard.');
  } catch {
    const textarea = document.createElement('textarea');
    textarea.value = note.text;
    textarea.style.cssText = 'position:fixed;left:-9999px;top:0';
    document.body.append(textarea);
    textarea.select();
    let copied = false;
    try { copied = document.execCommand('copy'); } catch {}
    textarea.remove();
    toast(copied ? 'Note copied to your clipboard.' : 'Copy was blocked. Open the note to select and copy its text.');
  }
}

function exportBackup() {
  let text = JSON.stringify({ ...state, exportedAt: new Date().toISOString() }, null, 2);
  if (damagedStorage) {
    try { text = localStorage.getItem(STORAGE_KEY) || text; } catch {}
  }
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `publishing-checklist-${new Date().toISOString().slice(0, 10)}${damagedStorage ? '-recovery' : ''}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  toast(damagedStorage ? 'Original data exported for recovery.' : 'Workspace backup exported.');
}

async function handleAction(button) {
  const id = button.dataset.id;
  const project = id ? state.projects.find(project => project.id === id) : null;
  const note = id ? state.notes.find(note => note.id === id) : null;
  switch (button.dataset.action) {
    case 'new-project': newProject(button.dataset.type); break;
    case 'expand-project': {
      if (!project) return;
      expanded.has(id) ? expanded.delete(id) : expanded.add(id);
      render();
      document.getElementById(`project-summary-${id}`)?.focus({ preventScroll: true });
      break;
    }
    case 'edit-project': if (project) editChecklist(project); break;
    case 'edit-template': editChecklist(null, button.dataset.type); break;
    case 'new-note': newNote(); break;
    case 'edit-note': if (note) newNote(note); break;
    case 'copy-note': if (note) await copyNote(note); break;
    case 'delete-note': {
      if (!note) return;
      closeMenus();
      if (await confirmAction('Delete this note?', `“${note.title}” will be removed from your workspace.`)) {
        state.notes = state.notes.filter(note => note.id !== id);
        persist(); render(); toast('Note deleted.');
      }
      break;
    }
    case 'add-step': {
      const rows = editorItems();
      if (rows.length >= 500) { setFormError('A checklist can have up to 500 steps.'); return; }
      const item = { id: uid(), text: '', done: false };
      currentEditor.items = [...rows, item];
      document.getElementById('step-editor').insertAdjacentHTML('beforeend', renderEditorRow(item, rows.length));
      document.querySelector('#step-editor .step-editor-row:last-child textarea')?.focus();
      break;
    }
    case 'remove-step': {
      const rows = editorItems();
      if (rows.length <= 1) { setFormError('Keep at least one step in the checklist.'); return; }
      const target = button.closest('.step-editor-row');
      currentEditor.items = rows.filter(item => item.id !== target.dataset.stepId);
      const index = [...target.parentNode.children].indexOf(target);
      target.remove();
      document.querySelectorAll('#step-editor .step-editor-row').forEach((row, rowIndex) => {
        row.querySelector('.step-index').textContent = String(rowIndex + 1).padStart(2, '0');
        row.querySelector('textarea').setAttribute('aria-label', `Step ${rowIndex + 1}`);
        row.querySelector('button').setAttribute('aria-label', `Remove step ${rowIndex + 1}`);
      });
      const remaining = document.querySelectorAll('#step-editor textarea');
      remaining[Math.min(index, remaining.length - 1)]?.focus();
      break;
    }
    case 'delete-project': {
      const project = state.projects.find(project => project.id === currentEditor.id);
      if (project && await confirmAction('Delete this project?', `“${project.name}” and its checklist progress will be removed.`)) {
        state.projects = state.projects.filter(item => item.id !== project.id);
        expanded.delete(project.id);
        editor.close(); persist(); render(); toast('Project deleted.');
      }
      break;
    }
    case 'export': closeMenus(); exportBackup(); break;
    case 'import': closeMenus(); document.getElementById('import-file').click(); break;
  }
}

document.getElementById('data-menu-button').innerHTML = icon('more');
document.querySelector('#confirm-dialog [data-close]').innerHTML = icon('close');

document.addEventListener('click', event => {
  const button = event.target.closest('button');
  if (button?.hasAttribute('data-close')) { document.getElementById(button.dataset.close).close(); return; }
  if (button?.dataset.toggleMenu) { toggleMenu(button, button.dataset.toggleMenu); return; }
  if (button?.id === 'data-menu-button') { toggleMenu(button, 'data-menu'); return; }
  if (button?.dataset.filter) {
    filter = button.dataset.filter;
    render();
    document.querySelector(`[data-filter="${filter}"]`)?.focus({ preventScroll: true });
    return;
  }
  if (button?.dataset.action) {
    void handleAction(button).catch(error => { console.error(error); toast('Something went wrong. Your workspace is still here.'); });
    return;
  }
  if (!event.target.closest('.menu-wrap')) closeMenus();
});

document.addEventListener('keydown', event => {
  if (event.key === 'Escape') closeMenus();
  if (event.key === 'ArrowDown' && event.target.closest('[data-toggle-menu], #data-menu-button')) {
    const button = event.target.closest('button');
    const menu = document.getElementById(button.dataset.toggleMenu || 'data-menu');
    if (menu.hidden) toggleMenu(button, menu.id);
    menu.querySelector('button')?.focus();
    event.preventDefault();
  }
});

main.addEventListener('change', event => {
  const checkbox = event.target.closest('input[data-item]');
  if (!checkbox) return;
  const project = state.projects.find(project => project.id === checkbox.dataset.projectId);
  if (!project) return;
  const wasFinished = progress(project).finished;
  toggleItem(project, checkbox.dataset.item);
  persist();
  render();
  document.getElementById(checkbox.id)?.focus({ preventScroll: true });
  if (!wasFinished && progress(project).finished) toast(`All done. “${project.name}” is finished!`);
});

main.addEventListener('input', event => {
  if (event.target.id === 'note-search') {
    search = event.target.value;
    document.getElementById('note-grid').innerHTML = renderNoteCards();
  }
});

editor.addEventListener('submit', event => {
  event.preventDefault();
  const form = event.target;
  if (!form.reportValidity()) return;
  const data = new FormData(form);
  if (currentEditor.mode === 'new-project') {
    try {
      const project = createProject(String(data.get('name')), String(data.get('type')), state.templates);
      state.projects.push(project);
      filter = 'all';
      expanded.add(project.id);
      persist(); editor.close(); render();
      requestAnimationFrame(() => document.getElementById(`project-summary-${project.id}`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }));
      toast('Your project is ready. One step at a time.');
    } catch (error) { setFormError(error.message); }
  } else if (currentEditor.mode === 'new-note' || currentEditor.mode === 'edit-note') {
    const title = String(data.get('title')).trim();
    const text = String(data.get('text')).trim();
    if (!title || !text) { setFormError('Add a title and some text for your note.'); return; }
    const note = state.notes.find(note => note.id === currentEditor.id);
    if (note) Object.assign(note, { title, text, updatedAt: Date.now() });
    else state.notes.unshift({ id: uid(), title, text, createdAt: Date.now(), updatedAt: Date.now() });
    search = '';
    persist(); editor.close(); render(); toast(note ? 'Note updated.' : 'Note added to your workspace.');
  } else {
    const items = editorItems();
    if (!items.length || items.some(item => !item.text)) { setFormError('Give every step some text, or remove the empty step.'); return; }
    if (currentEditor.mode === 'template') {
      state.templates[currentEditor.type] = items.map(item => item.text);
      persist(); editor.close(); render(); toast('Template saved for future projects.');
    } else {
      const project = state.projects.find(project => project.id === currentEditor.id);
      const name = String(data.get('name')).trim();
      if (!name) { setFormError('Give your project a name.'); return; }
      if (!project) { editor.close(); render(); return; }
      const wasFinished = progress(project).finished;
      project.items = items;
      project.name = name;
      updateCompletion(project, wasFinished);
      persist(); editor.close(); render(); toast('Checklist saved.');
    }
  }
});

document.getElementById('confirm-form').addEventListener('submit', event => {
  event.preventDefault();
  const resolve = confirmResolve;
  confirmResolve = null;
  confirmDialog.close();
  resolve?.(true);
});
confirmDialog.addEventListener('close', () => { confirmResolve?.(false); confirmResolve = null; });

document.getElementById('import-file').addEventListener('change', async event => {
  const file = event.target.files?.[0];
  event.target.value = '';
  if (!file) return;
  try {
    if (file.size > 20 * 1024 * 1024) throw new Error('Choose a backup smaller than 20 MB.');
    const restored = validateState(JSON.parse(await file.text()));
    if (!await confirmAction('Restore this workspace?', `This backup has ${restored.projects.length} projects and ${restored.notes.length} notes. It will replace your current workspace. Export a backup first if you want to keep the current version.`, 'Restore backup', false)) return;
    // Save the validated replacement before changing the visible workspace.
    localStorage.setItem(STORAGE_KEY, JSON.stringify(restored));
    state = restored;
    damagedStorage = false;
    saved = true;
    filter = 'all'; search = ''; expanded.clear();
    document.getElementById('storage-warning').hidden = true;
    render(); toast('Your workspace has been restored.');
  } catch (error) {
    toast(error instanceof SyntaxError ? 'This file is not a valid JSON backup.' : error.message || 'Could not restore this backup.');
  }
});

window.addEventListener('hashchange', () => {
  page = location.hash === '#notes' ? 'notes' : 'projects';
  render();
  window.scrollTo({ top: 0, behavior: 'instant' });
});

window.addEventListener('storage', event => {
  if (event.key !== STORAGE_KEY) return;
  // Keep an open draft intact; use the newer persisted state before it is saved.
  try {
    if (!event.newValue) { toast('Workspace storage changed in another tab. Reload to see it.'); return; }
    const next = validateState(JSON.parse(event.newValue));
    if (editor.open && currentEditor?.mode === 'project') {
      const oldProject = state.projects.find(item => item.id === currentEditor.id);
      const newProject = next.projects.find(item => item.id === currentEditor.id);
      if (JSON.stringify(oldProject) !== JSON.stringify(newProject)) {
        toast('This project changed in another tab. Close and reopen this editor for the latest version.');
        return;
      }
    }
    state = next; saved = true; damagedStorage = false; render();
  } catch { showStorageWarning('Another tab saved data that could not be read. Export a backup before continuing.'); }
});

render();
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' }).catch(() => {});
}
