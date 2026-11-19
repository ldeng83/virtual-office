import test from 'node:test';
import assert from 'node:assert/strict';
import {
  avatarLook,
  checkInLabel,
  DEFAULT_LOOK,
  hostedProfile,
  islandWeather,
  keysAllowed,
  hourLabel,
  takesFocus,
  wheelZooms,
} from '../src/hosted.ts';

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
    hair: '#111',
    hairStyle: 'short',
    skin: DEFAULT_LOOK.skin,
    bottoms: DEFAULT_LOOK.bottoms,
    status: 'Focused',
    checked: true,
  });
  assert.equal(hostedProfile({ ...me, name: '  ' }, stored).name, 'You');
});

test('a hosted avatar wears the full look, and missing pieces fall back', () => {
  const full = avatarLook({
    hair: ' #222 ',
    hairStyle: 'long',
    shirt: '#abcdef',
    skin: '#fedcba',
    bottoms: '#112233',
  });
  assert.deepEqual(full, {
    color: '#abcdef',
    hair: '#222',
    hairStyle: 'long',
    skin: '#fedcba',
    bottoms: '#112233',
  });
  assert.deepEqual(avatarLook(null), DEFAULT_LOOK);
  assert.deepEqual(avatarLook(undefined), DEFAULT_LOOK);
  assert.deepEqual(avatarLook({}), DEFAULT_LOOK);
  const partial = avatarLook({ shirt: '', hair: '#abc', hairStyle: 'bob', skin: '   ' });
  assert.equal(partial.color, DEFAULT_LOOK.color);
  assert.equal(partial.hair, '#abc');
  assert.equal(partial.hairStyle, 'short');
  assert.equal(partial.skin, DEFAULT_LOOK.skin);
  const stored = { name: 'Le Deng', color: '#d9815f', status: 'Away', checked: true };
  const profile = hostedProfile({ id: 'u', name: 'Ada', checkedIn: false, look: null }, stored);
  assert.equal(profile.color, DEFAULT_LOOK.color);
  assert.equal(profile.hair, DEFAULT_LOOK.hair);
  assert.equal(profile.status, 'Away');
  assert.equal(profile.checked, false);
});

test('hosted weather owns the sky, and a manual shower only runs without it', () => {
  assert.deepEqual(islandWeather('rain', false), { raining: true, manual: false });
  assert.deepEqual(islandWeather('clear', true), { raining: false, manual: false });
  assert.deepEqual(islandWeather('fog', true), { raining: false, manual: false });
  assert.deepEqual(islandWeather(undefined, true), { raining: true, manual: true });
  assert.deepEqual(islandWeather(undefined, false), { raining: false, manual: true });
});

test('the check-in label asks the host when the office owns it', () => {
  assert.equal(checkInLabel(true, false), 'Check in');
  assert.equal(checkInLabel(true, true), 'Edit today’s update');
  assert.equal(checkInLabel(false, false), 'Check in to the island');
  assert.equal(checkInLabel(false, true), 'Check out');
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
