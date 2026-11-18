import test from 'node:test';
import assert from 'node:assert/strict';
import { hostedProfile, keysAllowed, hourLabel, takesFocus, wheelZooms } from '../src/hosted.ts';

test('a hosted profile takes name, colour and check-in from the host, and keeps your status', () => {
  const me = {
      id: 'u1',
      name: 'Ada Lovelace',
      checkedIn: true,
      look: { hair: '#111', hairStyle: 'short', shirt: '#abcdef' },
    },
    stored = { name: 'Le Deng', color: '#d9815f', status: 'Focused', checked: false };
  assert.deepEqual(hostedProfile(me, stored), {
    name: 'Ada Lovelace',
    color: '#abcdef',
    status: 'Focused',
    checked: true,
  });
  assert.equal(hostedProfile({ ...me, name: '  ' }, stored).name, 'You');
});

const el = (tagName, extra = {}) => ({ tagName, isContentEditable: false, ...extra });
const rootOf = (...inside) => ({ contains: node => inside.includes(node) });

test('keys count on the page body and inside the island', () => {
  const body = el('BODY'),
    canvas = el('CANVAS'),
    root = rootOf(canvas);
  assert.equal(keysAllowed(body, root, body), true);
  assert.equal(keysAllowed(canvas, root, body), true);
});

test('keys pressed elsewhere on the host page are ignored', () => {
  const body = el('BODY'),
    outside = el('BUTTON'),
    root = rootOf();
  assert.equal(keysAllowed(outside, root, body), false);
  assert.equal(keysAllowed(null, root, body), false);
  assert.equal(keysAllowed(outside, null, body), false);
});

test('typing is never steering, even inside the island', () => {
  const body = el('BODY');
  for (const field of [el('INPUT'), el('TEXTAREA'), el('SELECT'), el('DIV', { isContentEditable: true })])
    assert.equal(keysAllowed(field, rootOf(field), body), false, field.tagName);
});

test('the office hour reads as a clock time', () => {
  assert.equal(hourLabel(12.5), '12:30 PM');
  assert.equal(hourLabel(0), '12:00 AM');
  assert.equal(hourLabel(9.25), '9:15 AM');
  assert.equal(hourLabel(23.999), '11:59 PM');
});

test('inside a host page, keys need focus in the island: the page keeps its own keyboard scrolling', () => {
  const body = el('BODY'),
    canvas = el('CANVAS');
  assert.equal(keysAllowed(body, rootOf(canvas), body, true), false);
  assert.equal(keysAllowed(canvas, rootOf(canvas), body, true), true);
});

test('the wheel over the island zooms it, on its own or inside a host page', () => {
  assert.equal(wheelZooms({ ctrlKey: false, metaKey: false }, false), true);
  assert.equal(wheelZooms({ ctrlKey: false, metaKey: false }, true), true);
  assert.equal(wheelZooms({ ctrlKey: true, metaKey: false }, true), true);
});

test('on load the island takes the keyboard, unless the visitor is already somewhere else on the page', () => {
  const body = el('BODY');
  assert.equal(takesFocus(body, body), true);
  assert.equal(takesFocus(null, body), true);
  assert.equal(takesFocus(el('INPUT'), body), false);
  assert.equal(takesFocus(el('BUTTON'), body), false);
});
