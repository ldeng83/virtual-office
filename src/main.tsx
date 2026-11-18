import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app';
import { IslandOffice } from './island-office';
import type { HostPerson } from './host';
import './style.css';
import './standalone.css';

// `?hosted` shows the island the way a host app embeds it: inside a page with its own controls,
// with a few made-up teammates. Handy for checking the seam without the host app.
const TEAM: HostPerson[] = ['Ada Lovelace', 'Grace Hopper', 'Alan Turing', 'Katherine Johnson'].map((name, i) => ({
  id: `host-${i}`,
  name,
  role: 'Teammate',
  present: i < 3,
  tasks: i ? [`Task for ${name.split(' ')[0]}`] : [],
  look: {
    hair: ['#2f2a28', '#8a5a2b', '#d8c9a3', '#111111'][i],
    hairStyle: i % 2 ? 'short' : 'long',
    shirt: ['#7193b5', '#d9815f', '#7b9c79', '#a88bb9'][i],
    skin: ['#e8bc98', '#c68e63', '#f1d2b6', '#8d5a3b'][i],
    bottoms: '#3b4a6b',
  },
}));
function HostedDemo() {
  const [checkedIn, setCheckedIn] = useState(false),
    [everyone, setEveryone] = useState(false),
    [log, setLog] = useState('');
  return (
    <div style={{ padding: 16, fontFamily: 'Georgia, serif' }}>
      <h1 style={{ margin: '0 0 8px' }}>Host page</h1>
      <p>
        <input aria-label="Host note" placeholder="Type here: the avatar must not move" />{' '}
        <button onClick={() => setEveryone(v => !v)}>{everyone ? 'Send Katherine home' : 'Katherine checks in'}</button>{' '}
        <span data-testid="host-log">{log}</span>
      </p>
      <div style={{ height: '70vh', border: '1px solid #999' }}>
        <IslandOffice
          host={{
            me: {
              id: 'me',
              name: 'Host Viewer',
              checkedIn,
              look: { hair: '#333', hairStyle: 'short', shirt: '#d4ae55' },
            },
            people: TEAM.map(p => (everyone ? { ...p, present: true } : p)),
            hour: 12.5,
            weather: 'clear',
            onCheckIn: () => {
              setCheckedIn(v => !v);
              setLog('check-in asked');
            },
            onPerson: id => setLog(`person ${id}`),
          }}
        />
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  new URLSearchParams(location.search).has('hosted') ? <HostedDemo /> : <App />,
);
