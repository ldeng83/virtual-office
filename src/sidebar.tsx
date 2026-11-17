import {
  ArrowUpRight,
  Check,
  Compass,
  DoorOpen,
  Users,
  Waves,
  Navigation,
  Leaf,
  Coffee,
  BriefcaseBusiness,
  LocateFixed,
  ListChecks,
  BookOpen,
  Presentation,
  Gamepad2,
  Fish,
  Flame,
} from 'lucide-react';
import { locations, type Point } from './world';
import { currentTask, type WorkState } from './people';
import { initials, type Profile } from './profile';
import type { CoworkerView, FeedItem } from './use-coworkers';

const icons = [
  Navigation,
  Compass,
  BriefcaseBusiness,
  Users,
  Coffee,
  BookOpen,
  Presentation,
  Leaf,
  Waves,
  Gamepad2,
  Flame,
  Fish,
];
export type SidebarTab = 'places' | 'people' | 'activity';
export function Sidebar({
  profile,
  update,
  setToast,
  tab,
  setTab,
  nearestId,
  travel,
  coworkers,
  work,
  feed,
  showDemo,
  unseen,
  findPerson,
  openFeedItem,
  autopilot,
}: SidebarProps) {
  return (
    <aside className="sidebar">
      <div className="intro">
        <span className="eyebrow">A LITTLE SPACE TOGETHER</span>
        <h1>
          Welcome to
          <br />
          your workday<span>.</span>
        </h1>
        <p>
          Your desk, your people.
          <br />A little closer, wherever you are.
        </p>
      </div>
      <div className="checkin-card">
        <div className="checkin-title">
          <span className={profile.checked ? 'online-dot' : 'offline-dot'} />
          <strong>{profile.checked ? 'You’re checked in' : 'Make yourself at home'}</strong>
        </div>
        <p>{profile.checked ? 'Enjoy your time on the island.' : 'Ready when you are. Settle in.'}</p>
        <button
          className={profile.checked ? 'checked-button' : 'primary-button'}
          onClick={() => {
            update({ checked: !profile.checked });
            setToast(profile.checked ? 'Checked out. See you soon!' : 'Checked in. Welcome to the island!');
          }}
        >
          {profile.checked ? <Check size={16} /> : <DoorOpen size={16} />}{' '}
          {profile.checked ? 'Check out' : 'Check in to the island'}
          {!profile.checked && <ArrowUpRight size={16} />}
        </button>
      </div>
      <div className="tabs">
        <button className={tab === 'places' ? 'active' : ''} onClick={() => setTab('places')}>
          <Compass size={16} /> Places
        </button>
        <button className={tab === 'people' ? 'active' : ''} onClick={() => setTab('people')}>
          <Users size={16} /> People <span>{(profile.checked ? 1 : 0) + coworkers.filter(c => c.target).length}</span>
        </button>
        <button className={tab === 'activity' ? 'active' : ''} onClick={() => setTab('activity')}>
          <ListChecks size={16} /> Activity {unseen > 0 && <span className="unseen">{unseen}</span>}
        </button>
      </div>
      {tab === 'activity' ? (
        <div className="feed" aria-live="polite">
          {showDemo && feed.length ? (
            feed.map(item => (
              <button key={item.id} className="feed-item" onClick={() => openFeedItem(item)}>
                <span className="feed-icon">{item.icon}</span>
                <span>
                  <strong>{item.who}</strong> {item.text}
                  <small>{item.at.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</small>
                </span>
              </button>
            ))
          ) : (
            <p className="feed-empty">Team updates will appear here as people work.</p>
          )}
        </div>
      ) : tab === 'places' ? (
        <nav className="places" aria-label="Island locations">
          {locations.map((l, i) => {
            const Icon = icons[i] ?? Compass;
            return (
              <button
                key={l.id}
                className={nearestId === l.id ? 'place selected' : 'place'}
                onClick={() => travel(l.point)}
              >
                <span className={`place-icon place-${i}`}>
                  <Icon size={19} />
                </span>
                <span>
                  <strong>{l.name}</strong>
                  <small>{l.detail}</small>
                </span>
                <ArrowUpRight className="place-arrow" size={16} />
              </button>
            );
          })}
        </nav>
      ) : (
        <div className="people">
          <div className="person">
            <span className="person-avatar" style={{ background: profile.color }}>
              {initials(profile.name)}
            </span>
            <div>
              <strong>
                {profile.name} <small>(you)</small>
              </strong>
              <p>{autopilot ? `🤖 Autopilot · ${autopilot}` : profile.checked ? profile.status : 'Not checked in'}</p>
            </div>
            <span className={profile.checked ? 'online-dot' : 'offline-dot'} />
          </div>
          {coworkers.map(({ person, target }) => (
            <div key={person.id} className="person">
              <span className="person-avatar" style={{ background: person.color }}>
                {initials(person.name)}
              </span>
              <div>
                <strong>
                  {person.name} <small className="demo-tag">demo</small>
                </strong>
                <p>{target ? `${target.activity.status} · ${target.activity.activity}` : 'Off the island'}</p>
                {target &&
                  (() => {
                    const task = currentTask(person, work[person.id]);
                    return (
                      <p className="person-task" title={`${Math.round(work[person.id].progress * 100)}% done`}>
                        {task.icon} {task.title}
                        <span className="mini-bar">
                          <span style={{ width: `${work[person.id].progress * 100}%` }} />
                        </span>
                      </p>
                    );
                  })()}
              </div>
              {target && (
                <button
                  className="icon-button find-person"
                  aria-label={`Find ${person.name}`}
                  title={`Find ${person.name}`}
                  onClick={() => findPerson(person.id)}
                >
                  <LocateFixed size={15} />
                </button>
              )}
              <span
                className={!target ? 'offline-dot' : target.activity.status === 'Available' ? 'online-dot' : 'busy-dot'}
              />
            </div>
          ))}
          <div className="empty-people">
            <Users size={25} />
            <strong>A space for the whole team</strong>
            <p>
              {showDemo
                ? 'Your teammates follow a demo daily routine for now. Live presence arrives with the shared server.'
                : 'This first prototype runs locally. Shared employee presence is the next milestone.'}
            </p>
          </div>
        </div>
      )}
      <div className="sidebar-footer">
        <div>
          <span className="tiny-island">✦</span>
          <strong>A little island. A better workday.</strong>
        </div>
        <p>Built for a team of 8.</p>
      </div>
    </aside>
  );
}
export type SidebarProps = {
  profile: Profile;
  update: (patch: Partial<Profile>) => void;
  setToast: (message: string) => void;
  tab: SidebarTab;
  setTab: (tab: SidebarTab) => void;
  nearestId: string;
  travel: (point: Point) => void;
  coworkers: CoworkerView[];
  // What autopilot is doing, while it drives you.
  autopilot: string | null;
  work: Record<string, WorkState>;
  feed: FeedItem[];
  showDemo: boolean;
  unseen: number;
  findPerson: (id: string) => void;
  openFeedItem: (item: FeedItem) => void;
};
