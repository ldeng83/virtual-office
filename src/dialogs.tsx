import { useState } from 'react';
import { ArrowUpRight, Check, Compass, Sun, Users, X, Armchair, Navigation, Palmtree } from 'lucide-react';
import { AtmosphereControls, useOcean, type IslandTime, type Atmosphere } from './atmosphere';
import { colors, type Profile } from './profile';

export type DialogKind = 'help' | 'settings' | 'atmosphere' | 'telescope';
// Real constellations for the telescope, with star positions on a 100×70 chart.
const constellations: { name: string; fact: string; stars: [number, number][]; lines: [number, number][] }[] = [
  {
    name: 'Orion, the Hunter',
    fact: 'The three stars of Orion’s Belt are about 1,000 light-years away; Betelgeuse, his red shoulder, is a supergiant nearing the end of its life.',
    stars: [
      [30, 12],
      [66, 15],
      [42, 36],
      [50, 37],
      [58, 38],
      [34, 62],
      [70, 60],
    ],
    lines: [
      [0, 2],
      [1, 4],
      [2, 3],
      [3, 4],
      [2, 5],
      [4, 6],
    ],
  },
  {
    name: 'Cassiopeia, the Queen',
    fact: 'Cassiopeia’s bright W never sets for much of the northern hemisphere, so sailors have used it to find north for centuries.',
    stars: [
      [12, 30],
      [30, 48],
      [48, 28],
      [66, 46],
      [86, 24],
    ],
    lines: [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
    ],
  },
  {
    name: 'The Big Dipper',
    fact: 'Follow the two stars at the end of the Dipper’s bowl upward and they point to Polaris, the North Star.',
    stars: [
      [10, 22],
      [24, 26],
      [36, 32],
      [48, 36],
      [52, 56],
      [76, 58],
      [80, 38],
    ],
    lines: [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
      [4, 5],
      [5, 6],
      [6, 3],
    ],
  },
  {
    name: 'Cygnus, the Swan',
    fact: 'Cygnus flies along the Milky Way; its tail star, Deneb, is one of the most luminous stars we can see with the naked eye.',
    stars: [
      [50, 8],
      [50, 30],
      [50, 50],
      [50, 64],
      [20, 26],
      [80, 34],
    ],
    lines: [
      [0, 1],
      [1, 2],
      [2, 3],
      [4, 1],
      [1, 5],
    ],
  },
];
function StarChart() {
  const [index, setIndex] = useState(() => Math.floor(Math.random() * constellations.length));
  const c = constellations[index];
  return (
    <div className="star-chart">
      <svg viewBox="0 0 100 70" role="img" aria-label={c.name}>
        <rect width="100" height="70" rx="4" fill="#132238" />
        {Array.from({ length: 40 }, (_, i) => (
          <circle key={i} cx={(i * 37) % 100} cy={(i * 23) % 70} r={0.35} fill="#9fb6d6" opacity={0.6} />
        ))}
        {c.lines.map(([a, b]) => (
          <line
            key={`${a}-${b}`}
            x1={c.stars[a][0]}
            y1={c.stars[a][1]}
            x2={c.stars[b][0]}
            y2={c.stars[b][1]}
            stroke="#8fb3e6"
            strokeWidth="0.5"
            opacity="0.7"
          />
        ))}
        {c.stars.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={1.4} fill="#fff6d8" />
        ))}
      </svg>
      <strong>{c.name}</strong>
      <p>{c.fact}</p>
      <button className="checked-button" onClick={() => setIndex((index + 1) % constellations.length)}>
        Look at another constellation
      </button>
    </div>
  );
}
export function Dialog({
  modal,
  setModal,
  profile,
  update,
  atmosphere,
  updateAtmosphere,
  sound,
  mood,
  showDemo,
  setShowDemo,
  onRain,
  raining,
}: DialogProps) {
  return (
    <div className="modal-overlay" onClick={() => setModal(null)}>
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        onClick={e => e.stopPropagation()}
        onKeyDown={e => {
          if (e.key === 'Escape') setModal(null);
        }}
      >
        <button autoFocus className="modal-close icon-button" aria-label="Close dialog" onClick={() => setModal(null)}>
          <X size={20} />
        </button>
        <span className="eyebrow">MAKE YOURSELF AT HOME</span>
        <h2 id="modal-title">
          {modal === 'help'
            ? 'Your island field guide'
            : modal === 'atmosphere'
              ? 'A change of atmosphere'
              : modal === 'telescope'
                ? 'Tonight’s sky'
                : 'Your little corner'}
        </h2>
        {modal === 'telescope' ? (
          <StarChart />
        ) : modal === 'atmosphere' ? (
          <>
            <AtmosphereControls settings={atmosphere} update={updateAtmosphere} sound={sound} time={mood} />
            <button className="checked-button shower-button" disabled={raining} onClick={onRain}>
              {raining ? '🌧️ It’s raining now' : '🌧️ Bring a passing shower'}
            </button>
          </>
        ) : modal === 'help' ? (
          <>
            <p>There’s no wrong way to settle in.</p>
            <ul className="instructions">
              <li>
                <Navigation />
                <div>
                  <strong>Take a walk</strong>
                  <p>Click the ground or use WASD / arrow keys. Paths go around desks and trees.</p>
                </div>
              </li>
              <li>
                <Armchair />
                <div>
                  <strong>Find your seat</strong>
                  <p>Click a chair to sit. Start walking or choose “Stand up” to leave.</p>
                </div>
              </li>
              <li>
                <Compass />
                <div>
                  <strong>Look around</strong>
                  <p>
                    Drag to pan, right-drag to orbit, and scroll or use + / − to zoom. Panning frees the camera; walk or
                    choose Back to me to return. Follow me keeps you in view; Island overview shows every district. Use
                    the map or sidebar to travel.
                  </p>
                </div>
              </li>
              <li>
                <Sun />
                <div>
                  <strong>Set the mood</strong>
                  <p>Open the island settings to change the sky, pause gentle motion, or listen to ocean sounds.</p>
                </div>
              </li>
              <li>
                <Palmtree />
                <div>
                  <strong>Take a break</strong>
                  <p>
                    Play ping-pong or cornhole on the games lawn, swing in a hammock by the firepit, fish, kayak or go
                    scuba diving from the jetty, ride a jet ski, sail or go parasailing from the water sports dock,
                    climb the bluff on the north shore, play the piano, turn on the café radio, relax on the rooftop,
                    catch the quiz or a movie at the town hall, and look through the telescope at night. Pet Mochi the
                    cat, hunt for today’s five seashells, and use the emotes at the bottom.
                  </p>
                </div>
              </li>
              <li>
                <Users />
                <div>
                  <strong>A first little island</strong>
                  <p>
                    Check-in and preferences are saved in this browser. Multiplayer, chat, and voice will arrive in
                    later milestones.
                  </p>
                </div>
              </li>
            </ul>
          </>
        ) : (
          <>
            <p>A few things to make this place yours.</p>
            <label className="form-label">
              Your name
              <input
                maxLength={24}
                value={profile.name === 'You' ? '' : profile.name}
                placeholder="Your name"
                onChange={e => update({ name: e.target.value || 'You' })}
              />
            </label>
            <span className="form-label">Avatar color</span>
            <div className="color-options">
              {colors.map(c => (
                <button
                  key={c}
                  style={{ background: c }}
                  aria-label={`Choose avatar color ${c}`}
                  aria-pressed={profile.color === c}
                  onClick={() => update({ color: c })}
                >
                  {profile.color === c && <Check size={20} />}
                </button>
              ))}
            </div>
            <label className="atmosphere-toggle">
              <span>
                <strong>Demo coworkers</strong>
                <small>Show Maya and Theo until real teammates join</small>
              </span>
              <input type="checkbox" role="switch" checked={showDemo} onChange={e => setShowDemo(e.target.checked)} />
            </label>
            <p className="settings-note">Saved automatically on this device.</p>
          </>
        )}
        <button className="primary-button" onClick={() => setModal(null)}>
          {modal === 'help' ? 'Let’s explore' : 'Back to the island'}
          <ArrowUpRight size={16} />
        </button>
      </section>
    </div>
  );
}
export type DialogProps = {
  onRain: () => void;
  raining: boolean;
  modal: DialogKind;
  setModal: (modal: DialogKind | null) => void;
  profile: Profile;
  update: (patch: Partial<Profile>) => void;
  atmosphere: Atmosphere;
  updateAtmosphere: (patch: Partial<Atmosphere>) => void;
  sound: ReturnType<typeof useOcean>;
  mood: IslandTime;
  showDemo: boolean;
  setShowDemo: (on: boolean) => void;
};
