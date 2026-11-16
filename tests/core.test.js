import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_TEMPLATES, MARGIN_NOTE, createInitialState, createProject, progress,
  sortedProjects, toggleItem, updateCompletion, validateState,
} from '../core.js';

const projectAt = (name, done, total, createdAt, completedAt = null) => ({
  id: name, name, type: 'edit', createdAt, updatedAt: createdAt, completedAt,
  items: Array.from({ length: total }, (_, index) => ({ id: `${name}-${index}`, text: `Step ${index + 1}`, done: index < done })),
});

test('the supplied workflows and margin note are present, in their exact order', () => {
  const state = createInitialState();
  assert.deepEqual(Object.keys(state.templates), ['edit', 'edit-publish', 'publish']);
  assert.deepEqual(Object.values(state.templates).map(items => items.length), [11, 16, 6]);
  assert.equal(state.templates.edit[9], 'Send print and screen versions to publisher');
  assert.equal(state.templates.edit[10], 'Write description and send to publisher');
  assert.equal(state.templates['edit-publish'][9], 'Write description');
  assert.deepEqual(state.templates['edit-publish'].slice(10), state.templates.publish);
  assert.equal(state.notes.length, 1);
  assert.equal(state.notes[0].text, MARGIN_NOTE);
  assert.equal(MARGIN_NOTE, '- Inner (gutter): 0.85"\n- Outer: 0.50"\n- Top: 0.55"\n- Bottom: 0.55"');
});

test('incomplete projects sort by percentage, ties by newest creation, completed by newest completion', () => {
  const projects = [
    projectAt('finished-old', 6, 6, 500, 700),
    projectAt('half-old', 3, 6, 100),
    projectAt('empty-new', 0, 16, 600),
    projectAt('nearly', 10, 11, 50),
    projectAt('finished-new', 11, 11, 10, 900),
    projectAt('half-new', 8, 16, 300),
    projectAt('empty-old', 0, 6, 200),
  ];
  const original = projects.map(project => project.id);
  assert.deepEqual(sortedProjects(projects).map(project => project.id), ['nearly', 'half-new', 'half-old', 'empty-new', 'empty-old', 'finished-new', 'finished-old']);
  assert.deepEqual(sortedProjects(projects, 'finished').map(project => project.id), ['finished-new', 'finished-old']);
  assert.equal(sortedProjects(projects, 'unfinished').length, 5);
  assert.deepEqual(projects.map(project => project.id), original);
});

test('finishing moves a project below incomplete ones and reopening clears its completion time', () => {
  const a = projectAt('a', 1, 2, 20);
  const b = projectAt('b', 2, 2, 10, 40);
  const c = projectAt('c', 0, 2, 30);
  toggleItem(a, 'a-1', 100);
  assert.equal(a.completedAt, 100);
  assert.deepEqual(sortedProjects([a, b, c]).map(project => project.id), ['c', 'a', 'b']);
  toggleItem(a, 'a-1', 110);
  assert.equal(a.completedAt, null);
  assert.deepEqual(sortedProjects([a, b, c]).map(project => project.id), ['a', 'c', 'b']);
  toggleItem(b, 'b-0', 120);
  toggleItem(b, 'b-0', 130);
  assert.equal(b.completedAt, 130);
  assert.equal(sortedProjects([a, b, c])[2].id, 'b');
});

test('completion never changes the order of checklist items', () => {
  const state = createInitialState();
  const project = createProject('A book', 'edit-publish', state.templates, 100);
  const original = project.items.map(item => item.id);
  toggleItem(project, original[7], 200);
  toggleItem(project, original[2], 300);
  assert.deepEqual(project.items.map(item => item.id), original);
  assert.equal(progress(project).done, 2);
  assert.equal(progress(project).ratio, 2 / 16);
});

test('templates and individual projects are independent snapshots', () => {
  const state = createInitialState();
  const first = createProject('First', 'publish', state.templates);
  state.templates.publish[0] = 'A custom first step';
  state.templates.publish.push('A custom last step');
  const second = createProject('Second', 'publish', state.templates);
  assert.equal(first.items.length, 6);
  assert.equal(first.items[0].text, DEFAULT_TEMPLATES.publish[0]);
  assert.equal(second.items.length, 7);
  assert.equal(second.items[0].text, 'A custom first step');
  first.items[0].text = 'Only this project';
  assert.equal(state.templates.publish[0], 'A custom first step');
  assert.equal(createInitialState().templates.publish.length, 6);
});

test('editing checklist items updates completion without losing the original finish time', () => {
  const project = projectAt('edited', 2, 2, 20, 50);
  project.items[0].text = 'Reworded';
  updateCompletion(project, true, 70);
  assert.equal(project.completedAt, 50);
  project.items.push({ id: 'new-step', text: 'New step', done: false });
  updateCompletion(project, true, 80);
  assert.equal(project.completedAt, null);
  toggleItem(project, 'new-step', 90);
  assert.equal(project.completedAt, 90);
});

test('backup validation accepts valid round trips and rejects malformed or duplicate data', () => {
  const state = createInitialState();
  state.projects.push(createProject('Test', 'edit', state.templates));
  const restored = validateState(JSON.parse(JSON.stringify(state)));
  assert.deepEqual(restored, state);
  restored.templates.edit[0] = 'Changed';
  assert.notEqual(restored.templates.edit[0], state.templates.edit[0]);
  for (const broken of [
    { ...state, version: 99 },
    { ...state, templates: { ...state.templates, edit: [] } },
    { ...state, projects: [...state.projects, state.projects[0]] },
    { ...state, notes: [{ ...state.notes[0], text: '' }] },
    { ...state, projects: [{ ...state.projects[0], type: '__proto__' }] },
    { ...state, projects: [{ ...state.projects[0], items: [] }] },
    { ...state, projects: [{ ...state.projects[0], items: [{ id: 'x', text: 'x', done: 'true' }] }] },
  ]) assert.throws(() => validateState(broken));
});
