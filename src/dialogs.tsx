import { ArrowUpRight, Check, Compass, Sun, Users, X, Armchair, Navigation } from 'lucide-react';
import { AtmosphereControls, useOcean, type IslandTime, type Atmosphere } from './atmosphere';
import { colors, type Profile } from './profile';

export type DialogKind = 'help' | 'settings' | 'atmosphere';
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
              : 'Your little corner'}
        </h2>
        {modal === 'atmosphere' ? (
          <AtmosphereControls settings={atmosphere} update={updateAtmosphere} sound={sound} time={mood} />
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
