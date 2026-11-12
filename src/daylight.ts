export const periods = {
    dawn: { name: 'Dawn', detail: '5–7 am · A soft pink beginning', anchor: 6, sky: '#d8bac0', water: '#bcbecb', ripple: '#edd9dd', light: '#ffd1b2', ambientColor: '#e9dbea', ambient: 1, sun: 1.5, position: [-18, 6, 10], lamps: 0.4, darkness: 0.25 },
    morning: { name: 'Morning', detail: '7–11 am · Fresh skies and warm light', anchor: 9, sky: '#beddda', water: '#a7cdcd', ripple: '#d0e9df', light: '#fff1ce', ambientColor: '#ffffff', ambient: 1.3, sun: 2.3, position: [-14, 14, 10], lamps: 0, darkness: 0 },
    midday: { name: 'Midday', detail: '11 am–3 pm · Clear water, bright skies', anchor: 13, sky: '#b8d9d8', water: '#9fcdd0', ripple: '#d0e9df', light: '#fff6df', ambientColor: '#ffffff', ambient: 1.4, sun: 2.4, position: [-3, 24, 6], lamps: 0, darkness: 0 },
    golden: { name: 'Golden hour', detail: '3–6 pm · Warm light and long shadows', anchor: 16.5, sky: '#dab5aa', water: '#bdabb5', ripple: '#f2d4bb', light: '#ffbb7b', ambientColor: '#fff0e3', ambient: 1.05, sun: 2.7, position: [18, 9, 8], lamps: 0.15, darkness: 0.1 },
    dusk: { name: 'Dusk', detail: '6–8 pm · Lavender skies, lights coming on', anchor: 19, sky: '#8a879f', water: '#817f9f', ripple: '#c8bfd9', light: '#e6b3cc', ambientColor: '#c9c6e6', ambient: 0.85, sun: 1.35, position: [18, 5, 4], lamps: 0.8, darkness: 0.65 },
    night: { name: 'Night', detail: '8 pm–5 am · Moonlight and a warm glow', anchor: 24.5, sky: '#243748', water: '#263f52', ripple: '#87adb8', light: '#aecbff', ambientColor: '#bdcde9', ambient: 0.75, sun: 1.1, position: [-8, 15, -10], lamps: 1, darkness: 1 },
} as const;
export type Period = keyof typeof periods;
export type Atmosphere = { mode: 'auto' | 'manual'; mood: Period; motion: boolean; volume: number };
export function periodAtHour(hour: number): Period {
    const h = ((hour % 24) + 24) % 24;
    return h < 5 ? 'night' : h < 7 ? 'dawn' : h < 11 ? 'morning' : h < 15 ? 'midday' : h < 18 ? 'golden' : h < 20 ? 'dusk' : 'night';
}
export function localHour(date: Date): number {
    return date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600;
}
// Interpolate between the centers of periods, including night across midnight.
export function daylightAtHour(hour: number) {
    let h = ((hour % 24) + 24) % 24;
    if (h < 6) h += 24;
    const anchors: [Period, number][] = [...Object.entries(periods).map(([key, value]) => [key as Period, value.anchor] as [Period, number]), ['dawn', 30]];
    const index = anchors.findIndex(([, anchor], i) => i < anchors.length - 1 && h >= anchor && h < anchors[i + 1][1]);
    const [from, start] = anchors[index];
    const [to, end] = anchors[index + 1];
    return { period: periodAtHour(hour), from, to, progress: (h - start) / (end - start) };
}
export function normalizeAtmosphere(value: unknown, reducedMotion = false): Atmosphere {
    const defaults: Atmosphere = { mode: 'auto', mood: 'midday', motion: !reducedMotion, volume: 35 };
    if (!value || typeof value !== 'object') return defaults;
    const data = value as Record<string, unknown>;
    const legacy = data.mood === 'day' ? 'midday' : data.mood === 'sunset' ? 'golden' : data.mood;
    return {
        mode: data.mode === 'manual' ? 'manual' : 'auto',
        mood: typeof legacy === 'string' && Object.hasOwn(periods, legacy) ? legacy as Period : defaults.mood,
        motion: typeof data.motion === 'boolean' ? data.motion : defaults.motion,
        volume: typeof data.volume === 'number' && Number.isFinite(data.volume) ? Math.max(0, Math.min(100, data.volume)) : defaults.volume,
    };
}
