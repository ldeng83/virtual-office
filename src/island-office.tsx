import { seatMessage, useFun } from './use-fun';
import { useDive } from './use-dive';
import { SPECIES } from './dive';
import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import {
  Check,
  ChevronDown,
  Compass,
  HelpCircle,
  MapPin,
  Maximize2,
  Minus,
  Plus,
  Settings2,
  Waves,
  Armchair,
  Navigation,
  Hand,
  Bot,
} from 'lucide-react';
import { locations, type Point } from './world';
import type { Trail } from './highlands';
import { readAtmosphere, useOcean, useIslandTime, type Atmosphere } from './atmosphere';
import { type News } from './campus';
import { FullMap, MiniMap } from './island-map';
import { cameraView, type ViewMode } from './camera-view';
import { World, SceneBoundary, MIN_ZOOM, MAX_ZOOM } from './scene';
import { initials, readProfile, type Profile } from './profile';
import { useCoworkers } from './use-coworkers';
import { demoCoworkers } from './people';
import { homeSeats, hostedCoworkers } from './hosted-people';
import { hostedProfile, islandKey, takesFocus, wheelZooms } from './hosted';
import type { IslandHost } from './host';
import { Sidebar, type SidebarTab } from './sidebar';
import { Dialog, type DialogKind } from './dialogs';
import { readAutopilot, type AutopilotSettings } from './autopilot';
import { useAutopilot } from './use-autopilot';

// The island, on its own or inside a host app. With a `host`, the people are the host's real
// teammates, you are who the host says you are, and checking in is the host's business.
export function IslandOffice({ host }: { host?: IslandHost }) {
  const hosted = !!host;
  const hostPeople = JSON.stringify(host?.people ?? null);
  // Seats stick: whoever is already on the island keeps their seat when someone else arrives.
  const seated = useRef<ReadonlyMap<string, string | null>>(new Map());
  const people = useMemo(() => {
    if (!host) return demoCoworkers;
    const next = hostedCoworkers(host.people, seated.current);
    seated.current = homeSeats(next);
    return next;
  }, [hostPeople]);
  const [viewMode, setViewMode] = useState<ViewMode>('follow');
  const freeLook = React.useCallback(() => setViewMode('free'), []);
  const [atmosphere, setAtmosphere] = useState(readAtmosphere);
  const sound = useOcean(atmosphere.volume);
  const mood = useIslandTime(atmosphere, host?.hour);
  const updateAtmosphere = (patch: Partial<Atmosphere>) => setAtmosphere(current => ({ ...current, ...patch }));
  useEffect(() => {
    try {
      localStorage.setItem('atoll-atmosphere', JSON.stringify(atmosphere));
    } catch {
      /* Storage may be disabled. */
    }
  }, [atmosphere]);
  const [stored, setProfile] = useState(readProfile),
    [tab, setTab] = useState<SidebarTab>('places'),
    [modal, setModal] = useState<DialogKind | null>(null),
    [seat, setSeat] = useState<string | null>(null),
    [go, setGo] = useState<{
      point: Point;
      seq: number;
    } | null>(null),
    [position, setPosition] = useState<Point>([0, 7]),
    [mapOpen, setMapOpen] = useState(false),
    [walkRequest, setWalkRequest] = useState<{ point: Point; seq: number } | null>(null),
    [hikeRequest, setHikeRequest] = useState<{ id: Trail['id']; seq: number } | null>(null),
    [reset, setReset] = useState(0),
    [toast, setToast] = useState(''),
    [loaded, setLoaded] = useState(false);
  const profile = host ? hostedProfile(host.me, stored) : stored;
  const [demoOn, setShowDemo] = useState(() => {
    try {
      return localStorage.getItem('atoll-demo-people') !== 'off';
    } catch {
      return true;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem('atoll-demo-people', demoOn ? 'on' : 'off');
    } catch {
      /* Storage may be disabled. */
    }
  }, [demoOn]);
  // A host's people are always shown: they are the point.
  const showDemo = hosted || demoOn;
  const {
    coworkers,
    work,
    shipped,
    feed,
    greeting,
    greet,
    say,
    nearby,
    pickSeat,
    findPerson,
    openFeedItem,
    postYou,
    occupiedSeats,
  } = useCoworkers({
    period: mood.period,
    seat,
    setSeat,
    notify: setToast,
    position,
    showDemo,
    onLook: freeLook,
    people,
  });
  const fun = useFun({
    seat,
    setSeat,
    position,
    notify: setToast,
    period: mood.period,
    motion: atmosphere.motion,
    nearby,
    say,
    travel: point => travel(point),
    openTelescope: () => setModal('telescope'),
    lookAt: point => {
      cameraView.look = point;
      freeLook();
    },
  });
  const raining = fun.raining || host?.weather === 'rain';
  const dive = useDive({ seat, setSeat, notify: setToast });
  const news: News = useMemo(
    () => ({
      time: mood.time,
      period: mood.name,
      items: showDemo ? feed.slice(0, 4).map(item => `${item.who} ${item.text}`) : [],
    }),
    [mood.time, mood.name, feed, showDemo],
  );
  // Sitting in a library booth switches you to Focused; standing up restores your status.
  const focusRestore = useRef<string | null>(null);
  useEffect(() => {
    const inBooth = !!seat?.startsWith('booth-');
    if (inBooth && focusRestore.current === null) {
      focusRestore.current = profile.status;
      if (profile.status !== 'Focused') {
        update({ status: 'Focused' });
        setToast('Focus mode on. You’re Focused while you’re in the library.');
      }
    } else if (!inBooth && focusRestore.current !== null) {
      const previous = focusRestore.current;
      focusRestore.current = null;
      if (profile.status === 'Focused' && previous !== 'Focused') update({ status: previous });
    }
  }, [seat]);
  // Autopilot: after a while with no input, your avatar carries on with its own day.
  const [autopilotSettings, setAutopilotSettings] = useState(readAutopilot);
  const updateAutopilot = (patch: Partial<AutopilotSettings>) => setAutopilotSettings(v => ({ ...v, ...patch }));
  useEffect(() => {
    try {
      localStorage.setItem('atoll-autopilot', JSON.stringify(autopilotSettings));
    } catch {
      /* Storage may be disabled. */
    }
  }, [autopilotSettings]);
  const autopilot = useAutopilot({
    settings: autopilotSettings,
    checked: profile.checked,
    // The status you chose (not the automatic Focused while sitting in a library booth).
    status: focusRestore.current ?? profile.status,
    seat,
    setSeat,
    period: mood.period,
    blocked: !!modal || mapOpen,
    occupied: occupiedSeats,
    onStart: () => setViewMode('follow'),
    post: postYou,
  });
  const [seenFeed, setSeenFeed] = useState(0);
  const unseen = showDemo ? feed.filter(item => item.id > seenFeed).length : 0;
  const panel = useRef<HTMLElement>(null);
  useEffect(() => {
    if (hosted && loaded && takesFocus(document.activeElement, document.body))
      panel.current?.focus({ preventScroll: true });
  }, [hosted, loaded]);
  // Mouse wheel / trackpad scroll zooms the island; the mini-map keeps its own scroll.
  useEffect(() => {
    const el = panel.current;
    if (!el) return;
    const wheel = (e: WheelEvent) => {
      if ((e.target as HTMLElement).closest('.full-map, .mini-map') || !wheelZooms(e, hosted)) return;
      e.preventDefault();
      const delta = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1);
      cameraView.zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, cameraView.zoom * Math.exp(-delta * 0.0015)));
    };
    el.addEventListener('wheel', wheel, { passive: false });
    return () => el.removeEventListener('wheel', wheel);
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem('atoll-profile', JSON.stringify(stored));
    } catch {
      /* Storage may be disabled. */
    }
  }, [stored]);
  useEffect(() => {
    if (tab === 'activity' && feed[0]) setSeenFeed(feed[0].id);
  }, [tab, feed]);
  useEffect(() => {
    if (!modal) return;
    const handle = (e: KeyboardEvent) => {
      if (!islandKey(e)) return;
      if (e.key === 'Escape') setModal(null);
      if (e.key === 'Tab') {
        const elements = Array.from(document.querySelectorAll<HTMLElement>('.modal button,.modal input,.modal select'));
        const first = elements[0],
          last = elements[elements.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    window.addEventListener('keydown', handle);
    return () => window.removeEventListener('keydown', handle);
  }, [modal]);
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(''), 3500);
      return () => clearTimeout(t);
    }
  }, [toast]);
  const mapPeople = coworkers.map(c => ({
    id: c.person.id,
    name: c.person.name,
    color: c.person.color,
    activity: c.target?.activity.activity,
  }));
  // M opens and closes the full map (not while typing or with a dialog open).
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== 'm' || e.metaKey || e.ctrlKey || e.altKey || !islandKey(e)) return;
      if ((e.target as HTMLElement).closest('input,textarea,select,[contenteditable=true],.modal')) return;
      setMapOpen(open => !open);
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, []);
  const travel = (point: Point) => {
      setViewMode('follow');
      setGo({ point, seq: Date.now() });
    },
    update = (p: Partial<Profile>) => setProfile(v => ({ ...v, ...p })),
    nearest = locations.reduce((a, b) =>
      Math.hypot(position[0] - a.point[0], position[1] - a.point[1]) <
      Math.hypot(position[0] - b.point[0], position[1] - b.point[1])
        ? a
        : b,
    );
  return (
    <div className="island-root" data-hosted={hosted}>
      <div className="app">
        <header className="header">
          <a
            className="brand"
            // Inside a host app the brand is a label, not a way out of the page.
            href={hosted ? undefined : '/'}
            aria-label="BIsland home"
            title="Boston Identity Island"
          >
            <span className="brand-icon">
              <Waves size={23} />
            </span>
            <span className="brand-name">
              <b>B</b>Island
            </span>
            <span className="brand-divider" />
            <span className="workspace-name">
              Our island office
              <ChevronDown size={13} />
            </span>
          </a>
          <div className="header-right">
            {!hosted && <span className="prototype">LOCAL PROTOTYPE</span>}
            <span className="weather">
              <mood.Icon size={17} /> {mood.name}
            </span>
            <button className="icon-button" aria-label="Help" onClick={() => setModal('help')}>
              <HelpCircle size={19} />
            </button>
            <button
              className="profile-button"
              aria-label="Edit profile"
              style={{ background: profile.color }}
              onClick={() => setModal('settings')}
            >
              {initials(profile.name)}
            </button>
          </div>
        </header>
        <main>
          <Sidebar
            onCheckIn={host?.onCheckIn}
            hosted={hosted}
            profile={profile}
            update={update}
            setToast={setToast}
            tab={tab}
            setTab={setTab}
            nearestId={nearest.id}
            travel={travel}
            coworkers={coworkers}
            work={work}
            feed={feed}
            showDemo={showDemo}
            unseen={unseen}
            autopilot={autopilot.active ? (autopilot.activity?.activity ?? 'Planning') : null}
            findPerson={findPerson}
            openFeedItem={openFeedItem}
          />
          <section
            ref={panel}
            // On a host page, clicking the island gives it the keyboard.
            tabIndex={hosted ? -1 : undefined}
            onPointerDown={
              hosted
                ? e =>
                    (e.target as HTMLElement).closest('button,a,input,select') ||
                    panel.current?.focus({ preventScroll: true })
                : undefined
            }
            data-view-mode={viewMode}
            data-mood={mood.period}
            className="island-panel"
            aria-label="Interactive 3D island"
          >
            <div className="scene-top">
              <div className="location-chip">
                <span className="online-dot" />
                {mood.name}
                <span className="chip-divider" />
                <time
                  dateTime={mood.now.toISOString()}
                  title={`${mood.timezone}${atmosphere.mode === 'manual' ? ' · Manual atmosphere' : ' · Following real time'}`}
                >
                  {mood.time}
                </time>
                {atmosphere.mode === 'manual' && <span className="manual-chip">Manual</span>}
              </div>
              <button className="scene-settings" aria-label="Island atmosphere" onClick={() => setModal('atmosphere')}>
                <Settings2 size={18} />
              </button>
            </div>
            <SceneBoundary>
              <Suspense fallback={<div className="loading">Finding your little corner of the world…</div>}>
                <Canvas
                  shadows
                  orthographic
                  gl={{ stencil: true }}
                  camera={{ position: [21, 25, 36], zoom: 30, near: 0.1, far: 1000 }}
                  dpr={[1, 1.7]}
                  onCreated={() => setLoaded(true)}
                >
                  <World
                    onPerson={id => {
                      if (host) return host.onPerson?.(id);
                      const view = coworkers.find(c => c.person.id === id);
                      if (view) greet(view);
                    }}
                    profile={profile}
                    go={go}
                    seat={seat}
                    setSeat={setSeat}
                    onPosition={setPosition}
                    reset={reset}
                    atmosphere={atmosphere}
                    time={mood}
                    viewMode={viewMode}
                    onExplore={() => setViewMode('follow')}
                    onFreeLook={freeLook}
                    coworkers={coworkers}
                    greeting={greeting}
                    onPickSeat={pickSeat}
                    occupied={occupiedSeats}
                    work={work}
                    shipped={shipped}
                    news={news}
                    radioOn={fun.radioOn}
                    onRadio={fun.toggleRadio}
                    onTelescope={fun.lookThroughTelescope}
                    shells={fun.shells}
                    onShell={fun.collectShell}
                    onPetCat={fun.petCat}
                    onPetDog={fun.petDog}
                    emote={fun.emote}
                    raining={raining}
                    rainbow={fun.rainbow}
                    onHike={trail =>
                      setToast(
                        `🥾 Hiking the ${trail.name} (${trail.level.toLowerCase()}). Press a movement key to stop.`,
                      )
                    }
                    walkRequest={walkRequest}
                    hikeRequest={hikeRequest}
                    onNoRoute={() => setToast('There’s no way to walk there. Try a path or a place nearby.')}
                    autopilot={autopilot.command}
                    autopilotOn={autopilot.active}
                    onAutopilotArrive={autopilot.arrive}
                  />
                </Canvas>
              </Suspense>
            </SceneBoundary>
            <MiniMap people={mapPeople} onOpen={() => setMapOpen(true)} />
            {mapOpen && (
              <FullMap
                people={mapPeople}
                trailsDone={Object.keys(fun.stats.trails)}
                onWalk={point => {
                  setViewMode('follow');
                  setWalkRequest({ point, seq: Date.now() });
                }}
                onJump={travel}
                onHike={id => setHikeRequest({ id, seq: Date.now() })}
                onFindPerson={findPerson}
                onClose={() => setMapOpen(false)}
              />
            )}
            <div className="view-modes" role="group" aria-label="Camera mode">
              <button aria-pressed={viewMode === 'follow'} onClick={() => setViewMode('follow')}>
                <Navigation size={14} /> {viewMode === 'free' ? 'Back to me' : 'Follow me'}
              </button>
              <button aria-pressed={viewMode === 'overview'} onClick={() => setViewMode('overview')}>
                <Compass size={14} /> Island overview
              </button>
            </div>
            {loaded && viewMode === 'overview' && position[1] > -56 && (
              <div className="island-caption">
                <span>YOUR EVERYDAY GETAWAY</span>
                <h2>Good work happens here.</h2>
                <p>Find your spot. Make a connection.</p>
              </div>
            )}
            <div className="map-controls">
              <button aria-label="Zoom in" onClick={() => (cameraView.zoom = Math.min(MAX_ZOOM, cameraView.zoom + 5))}>
                <Plus size={18} />
              </button>
              <button aria-label="Zoom out" onClick={() => (cameraView.zoom = Math.max(MIN_ZOOM, cameraView.zoom - 5))}>
                <Minus size={18} />
              </button>
              <div />
              <button
                aria-label="Reset view"
                onClick={() => {
                  setReset(v => v + 1);
                  cameraView.zoom = 30;
                  setViewMode(v => (v === 'free' ? 'follow' : v));
                }}
              >
                <Maximize2 size={17} />
              </button>
            </div>
            <div className="scene-bottom">
              <span className="current-location">
                <MapPin size={15} />
                {nearest.name}
              </span>
              <span className="movement-hint">
                <span>W A S D</span> to move <i /> Click to walk <i /> <span>Space</span> or <span>E</span> to use <i />{' '}
                Hold <span>Q</span> to show what you can use <i /> Drag to pan <i /> Right-drag to orbit <i /> Scroll to
                zoom
              </span>
            </div>
            {dive.hud.under && <div className="dive-tint" />}
            {dive.splash > 0 && <div key={dive.splash} className="dive-splash" />}
            {seat && dive.diving && (
              <div className="seat-message dive-hud">
                <span aria-hidden="true">🤿</span>
                <span
                  className="air-gauge"
                  role="meter"
                  aria-label="Air left"
                  aria-valuenow={Math.round(dive.hud.air * 100)}
                >
                  <i className={dive.hud.air < 1 / 6 ? 'low' : ''} style={{ width: `${dive.hud.air * 100}%` }} />
                </span>
                <b>
                  {Math.floor((dive.hud.air * 180) / 60)}:{String(Math.round(dive.hud.air * 180) % 60).padStart(2, '0')}
                </b>
                <span className="dive-hint">
                  {dive.hud.returning
                    ? 'Heading back to the ladder'
                    : dive.hud.free
                      ? 'W A S D to swim'
                      : dive.hud.under
                        ? 'Guided tour · W A S D to swim it yourself'
                        : 'Down the ladder…'}
                </span>
                <button className="dive-log-button" title="Your dive log" onClick={() => setModal('divelog')}>
                  📖 {dive.found}/{SPECIES.length}
                </button>
                <button onClick={dive.surface}>
                  {dive.hud.under && !dive.hud.returning ? 'Surface' : 'Climb out'}
                </button>
              </div>
            )}
            {seat && !dive.diving && (
              <div className="seat-message">
                <Armchair size={17} />
                <span>{seatMessage(seat).text}</span>
                <button onClick={() => setSeat(null)}>{seatMessage(seat).action}</button>
              </div>
            )}
            {fun.nudge && (
              <div className="nearby-prompt nudge">
                <span>🌴 You’ve been at your desk a while. The hammocks are free.</span>
                <button onClick={fun.takeBreak}>Take a break</button>
                <button className="quiet" onClick={fun.snooze}>
                  Not now
                </button>
              </div>
            )}
            {nearby && !greeting && !fun.nudge && (
              <div className="nearby-prompt">
                <span className="person-avatar" style={{ background: nearby.person.color }}>
                  {initials(nearby.person.name)}
                </span>
                <span>
                  <strong>{nearby.person.name}</strong> is nearby · {nearby.target?.activity.activity}
                </span>
                <button onClick={() => greet(nearby)}>
                  <Hand size={14} /> Say hi
                </button>
              </div>
            )}
            {(autopilot.active || autopilot.countdown !== null) && (
              <div className={autopilot.active ? 'autopilot-pill' : 'autopilot-pill counting'} role="status">
                <Bot size={16} />
                {autopilot.active ? (
                  <>
                    <span>
                      <strong>Autopilot</strong>
                      {autopilot.activity && <> · {autopilot.activity.activity}</>}
                      <small> · press any key to take over</small>
                    </span>
                    <button onClick={autopilot.takeOver}>Take over</button>
                  </>
                ) : (
                  <span>Autopilot in {autopilot.countdown}…</span>
                )}
              </div>
            )}
            {toast && (
              <div className="toast" role="status">
                <Check size={17} />
                {toast}
              </div>
            )}
          </section>
        </main>
        <footer className="bottom-bar">
          <div className="self">
            <span className="self-avatar" style={{ background: profile.color }}>
              {initials(profile.name)}
            </span>
            <div>
              <strong>{profile.name}</strong>
              <span>
                {autopilot.active ? '🤖 On autopilot' : profile.checked ? 'Checked in' : 'Exploring the island'}
              </span>
            </div>
            <span className="bottom-divider" />
            <label className="status-select">
              <span className={profile.status === 'Available' ? 'online-dot' : 'busy-dot'} />
              <select
                aria-label="Your availability"
                value={profile.status}
                onChange={e => update({ status: e.target.value })}
              >
                <option>Available</option>
                <option>Focused</option>
                <option>In a meeting</option>
                <option>Away</option>
              </select>
            </label>
            <button
              className="autopilot-toggle"
              aria-pressed={autopilotSettings.enabled && !autopilotSettings.paused}
              aria-label={autopilotSettings.paused ? 'Resume autopilot' : 'Pause autopilot'}
              title={
                !autopilotSettings.enabled
                  ? 'Autopilot when idle is off (turn it on in your profile)'
                  : autopilotSettings.paused
                    ? 'Autopilot paused: your avatar stays put when you’re idle'
                    : `Autopilot after ${autopilotSettings.delay / 1000}s idle. Click to pause.`
              }
              disabled={!autopilotSettings.enabled}
              onClick={() => updateAutopilot({ paused: !autopilotSettings.paused })}
            >
              <Bot size={15} />
            </button>
          </div>
          <div className="emotes" role="group" aria-label="Emotes">
            {(['wave', 'dance', 'highfive', 'cheer'] as const).map(kind => (
              <button
                key={kind}
                onClick={() => fun.doEmote(kind)}
                aria-label={kind === 'highfive' ? 'High five' : kind[0].toUpperCase() + kind.slice(1)}
                title={kind === 'highfive' ? 'High five' : kind[0].toUpperCase() + kind.slice(1)}
              >
                {fun.emoteIcons[kind]}
              </button>
            ))}
          </div>
          <div
            className="fun-stats"
            title="Today’s seashells, fish caught, trails completed, summits this week and your dive log"
          >
            <span>🐚 {5 - fun.shells.length}/5 today</span>
            <span>🐟 {fun.stats.fish}</span>
            <span>🥾 {fun.trailsDone}/3</span>
            <span>⛰️ {fun.summitsThisWeek}</span>
            <button title="Open your dive log" onClick={() => setModal('divelog')}>
              🤿 {dive.found}/{SPECIES.length}
            </button>
          </div>
          <button className="help-button" onClick={() => setModal('help')}>
            <HelpCircle size={16} /> How to explore
          </button>
        </footer>
        {modal && (
          <Dialog
            modal={modal}
            setModal={setModal}
            profile={profile}
            update={update}
            atmosphere={atmosphere}
            updateAtmosphere={updateAtmosphere}
            sound={sound}
            mood={mood}
            showDemo={showDemo}
            setShowDemo={setShowDemo}
            hosted={hosted}
            autopilot={autopilotSettings}
            updateAutopilot={updateAutopilot}
            diveLog={dive.log}
            onRain={fun.startRain}
            raining={raining}
          />
        )}
      </div>
    </div>
  );
}
