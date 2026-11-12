import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Moon, Sun, Sunrise, Sunset, CloudSun, Volume2, VolumeX, Waves } from 'lucide-react';
import * as THREE from 'three';
import { IslandLife } from './island-life';
import { Ocean } from './ocean';
import { SeaLife } from './sea-life';

import { daylightAtHour, localHour, normalizeAtmosphere, periods, type Atmosphere } from './daylight';
export type { Atmosphere } from './daylight';
const periodIcons = { dawn: Sunrise, morning: CloudSun, midday: Sun, golden: Sunset, dusk: Sunset, night: Moon };
export function useIslandTime(settings: Atmosphere) {
    const [now, setNow] = useState(() => new Date());
    useEffect(() => {
        const refresh = () => setNow(new Date());
        const interval = window.setInterval(refresh, 1000);
        document.addEventListener('visibilitychange', refresh);
        window.addEventListener('focus', refresh);
        return () => { clearInterval(interval); document.removeEventListener('visibilitychange', refresh); window.removeEventListener('focus', refresh); };
    }, []);
    const sample = settings.mode === 'auto' ? daylightAtHour(localHour(now)) : { period: settings.mood, from: settings.mood, to: settings.mood, progress: 0 };
    return { ...sample, now, name: periods[sample.period].name, Icon: periodIcons[sample.period], time: now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }), timezone: Intl.DateTimeFormat().resolvedOptions().timeZone.replaceAll('_', ' ') };
}
export type IslandTime = ReturnType<typeof useIslandTime>;
export function readAtmosphere(): Atmosphere {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    try { return normalizeAtmosphere(JSON.parse(localStorage.getItem('atoll-atmosphere') || '{}'), reduced); }
    catch { return normalizeAtmosphere(null, reduced); }
}

export function AtmosphereScene({ settings, time }: { settings: Atmosphere; time: IslandTime }) {
    const target = useMemo(() => {
        const a = periods[time.from], b = periods[time.to], t = time.progress;
        const color = (key: 'sky' | 'light' | 'ambientColor') => new THREE.Color(a[key]).lerp(new THREE.Color(b[key]), t);
        return { sky: color('sky'), light: color('light'), ambientColor: color('ambientColor'), ambient: THREE.MathUtils.lerp(a.ambient, b.ambient, t), sun: THREE.MathUtils.lerp(a.sun, b.sun, t), lamps: THREE.MathUtils.lerp(a.lamps, b.lamps, t), darkness: THREE.MathUtils.lerp(a.darkness, b.darkness, t), position: new THREE.Vector3(...a.position).lerp(new THREE.Vector3(...b.position), t) };
    }, [time.from, time.to, time.progress]);
    const fire = useRef<THREE.PointLight>(null), lamps = useRef<THREE.Group>(null), stars = useRef<THREE.Group>(null);
    const ambient = useRef<THREE.AmbientLight>(null), sun = useRef<THREE.DirectionalLight>(null), studio = useRef<THREE.PointLight>(null);
    const current = useRef({ ...target, sky: target.sky.clone(), light: target.light.clone(), ambientColor: target.ambientColor.clone(), position: target.position.clone() });
    useFrame(({ clock, scene }, dt) => {
        const c = current.current;
        const alpha = settings.motion ? 1 - Math.exp(-Math.min(dt, 0.1) * 2) : 1;
        for (const key of ['sky', 'light', 'ambientColor'] as const) c[key].lerp(target[key], alpha);
        for (const key of ['ambient', 'sun', 'lamps', 'darkness'] as const) c[key] = THREE.MathUtils.lerp(c[key], target[key], alpha);
        c.position.lerp(target.position, alpha);
        (scene.background as THREE.Color)?.copy(c.sky);
        (scene.fog as THREE.Fog)?.color.copy(c.sky);
        if (ambient.current) { ambient.current.color.copy(c.ambientColor); ambient.current.intensity = c.ambient; }
        if (sun.current) { sun.current.color.copy(c.light); sun.current.intensity = c.sun; sun.current.position.copy(c.position); }
        if (fire.current) fire.current.intensity = (2 + c.darkness * 5) * (settings.motion ? 1 + Math.sin(clock.elapsedTime * 5) * 0.08 + Math.sin(clock.elapsedTime * 8.3) * 0.05 : 1);
        if (studio.current) studio.current.intensity = c.lamps * 12;
        lamps.current?.children.forEach(lamp => { (lamp as THREE.Mesh<THREE.SphereGeometry, THREE.MeshStandardMaterial>).material.emissiveIntensity = c.lamps * 3; });
        stars.current?.children.forEach(star => { (star as THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>).material.opacity = Math.max(0, (c.darkness - 0.6) / 0.4); });
    });
    return <>
        <IslandLife motion={settings.motion} darkness={target.darkness}/>
        <color attach="background" args={[current.current.sky]}/><fog attach="fog" args={[current.current.sky, 55, 110]}/>
        <ambientLight ref={ambient}/>
        <directionalLight ref={sun} castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-20} shadow-camera-right={20} shadow-camera-top={20} shadow-camera-bottom={-20} shadow-normalBias={0.04}/>
        <Ocean motion={settings.motion} time={time}/><SeaLife motion={settings.motion}/>
        <pointLight ref={fire} position={[5, 1.1, 4]} color="#ffab59" distance={7} decay={2}/>
        <group ref={lamps}>{[-8, -6, -4, -2, 0].map(x => <mesh key={x} position={[x, 2.38, 2.3]}><sphereGeometry args={[0.07, 8, 6]}/><meshStandardMaterial color="#ffe0a0" emissive="#ffca79"/></mesh>)}</group>
        <pointLight ref={studio} position={[-4, 2.2, 0]} color="#ffd19a" distance={11} decay={2}/>
        <group ref={stars}>{Array.from({ length: 65 }, (_, i) => <mesh key={i} position={[Math.sin(i * 127.1) * 48, 15 + (Math.sin(i * 43.7) + 1) * 16, Math.cos(i * 93.3) * 48]}><sphereGeometry args={[0.035 + (i % 3) * 0.015, 4, 4]}/><meshBasicMaterial color="#dae5ee" transparent depthWrite={false}/></mesh>)}</group>
    </>;
}

// A looping filtered noise bed with slow gain modulation: no external audio assets.
function createOcean() {
    const context = new AudioContext();
    const buffer = context.createBuffer(1, context.sampleRate * 8, context.sampleRate);
    const data = buffer.getChannelData(0);
    let previous = 0;
    for (let i = 0; i < data.length; i++) {
        previous = (previous + Math.random() * 0.04 - 0.02) / 1.02;
        data[i] = previous * 7;
    }
    const source = context.createBufferSource(); source.buffer = buffer; source.loop = true;
    const filter = context.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 850;
    const swell = context.createGain(); swell.gain.value = 0.55;
    const lfo = context.createOscillator(); lfo.frequency.value = 0.11;
    const depth = context.createGain(); depth.gain.value = 0.22;
    const master = context.createGain(); master.gain.value = 0;
    lfo.connect(depth).connect(swell.gain);
    source.connect(filter).connect(swell).connect(master).connect(context.destination);
    source.start(); lfo.start();
    return { context, master };
}
export function useOcean(volume: number) {
    const engine = useRef<ReturnType<typeof createOcean> | null>(null);
    const [playing, setPlaying] = useState(false);
    const [error, setError] = useState('');
    const pending = useRef(false);
    useEffect(() => {
        if (engine.current) engine.current.master.gain.setTargetAtTime(playing ? volume / 100 * 0.5 : 0, engine.current.context.currentTime, 0.3);
    }, [volume, playing]);
    useEffect(() => {
        const visibility = () => {
            const audio = engine.current;
            if (!audio) return;
            if (document.hidden) void audio.context.suspend();
            else if (playing) void audio.context.resume().catch(() => { setPlaying(false); setError('Select Play to resume island sounds.'); });
        };
        document.addEventListener('visibilitychange', visibility);
        return () => document.removeEventListener('visibilitychange', visibility);
    }, [playing]);
    useEffect(() => () => { void engine.current?.context.close(); }, []);
    const toggle = async () => {
        if (pending.current) return;
        if (playing) { setPlaying(false); return; }
        pending.current = true;
        try {
            engine.current ??= createOcean();
            await engine.current.context.resume();
            setError(''); setPlaying(true);
        } catch { setError('Island sounds are unavailable in this browser.'); }
        finally { pending.current = false; }
    };
    return { playing, error, toggle };
}

export function AtmosphereControls({ settings, update, sound, time }: { time: IslandTime; settings: Atmosphere; update: (patch: Partial<Atmosphere>) => void; sound: ReturnType<typeof useOcean> }) {
    return <>
        <p>Settle into a different kind of island time.</p>
        <label className="atmosphere-toggle time-toggle"><span><strong>Follow real time</strong><small>Your local time · {time.time}</small></span><input type="checkbox" role="switch" checked={settings.mode === 'auto'} onChange={e => update({ mode: e.target.checked ? 'auto' : 'manual', mood: time.period })}/></label>
        <p className="timezone-note">{time.timezone} · {settings.mode === 'auto' ? 'Light changes gradually throughout your day.' : 'Choose a period to stay a little longer.'}</p>
        <span className="form-label">{settings.mode === 'auto' ? 'Your day on the island' : 'Choose a period'}</span>
        <div className="mood-options" role="group" aria-label="Time of day">{Object.entries(periods).map(([key, mood]) => { const Icon = periodIcons[key as Atmosphere['mood']]; return <button key={key} className={`mood-option mood-${key}`} aria-pressed={time.period === key} onClick={() => update({ mode: 'manual', mood: key as Atmosphere['mood'] })}><Icon size={21}/><span><strong>{mood.name}</strong><small>{mood.detail}</small></span>{time.period === key && <CheckMark/>}</button>; })}</div>
        <label className="atmosphere-toggle"><span><strong>Gentle motion</strong><small>Waves, palms, clouds, fireflies, and sea life</small></span><input type="checkbox" role="switch" checked={settings.motion} onChange={e => update({ motion: e.target.checked })}/></label>
        <div className="sound-card"><div className="sound-heading"><Waves size={22}/><span><strong>Ocean breeze</strong><small>A soft wash of waves, just for you</small></span><button className="sound-toggle" aria-label={sound.playing ? 'Mute island sounds' : 'Play island sounds'} aria-pressed={sound.playing} onClick={sound.toggle}>{sound.playing ? <Volume2 size={19}/> : <VolumeX size={19}/>}</button></div><label className="volume-label" htmlFor="ocean-volume">Volume <span>{settings.volume}%</span></label><input id="ocean-volume" aria-label="Ocean volume" type="range" min="0" max="100" value={settings.volume} onChange={e => update({ volume: Number(e.target.value) })}/><p className="sound-note">{sound.playing ? 'Playing · pauses while the island is in the background' : 'Sound is off. Press play whenever you’re ready.'}</p>{sound.error && <p role="status" className="sound-note">{sound.error}</p>}</div>
        <p className="settings-note">Your atmosphere is saved on this device. Sound starts only when you choose.</p>
    </>;
}
function CheckMark() { return <span className="mood-check" aria-hidden="true">✓</span>; }
