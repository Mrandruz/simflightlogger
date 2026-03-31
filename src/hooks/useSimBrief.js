import { useState, useEffect } from 'react';
import { fetchSimBriefData, parseSimBriefData } from '../services/simbriefService';

const CACHE_KEY = 'simBriefCache';
const CACHE_TTL = 5 * 60 * 1000;
// Stesso default hardcoded di SimBriefBriefing
const DEFAULT_IDENTIFIER = { type: 'username', value: 'mrandruz' };

export function useSimBrief() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        let cancelled = false;

        const load = async () => {
            // Legge identifier, cade sul default se mancante o vuoto
            let identifier = DEFAULT_IDENTIFIER;
            try {
                const saved = localStorage.getItem('simBriefIdentifier');
                if (saved) {
                    const parsed = JSON.parse(saved);
                    if (parsed?.value?.trim()) identifier = parsed;
                }
            } catch (_) { }

            console.log('[useSimBrief] using identifier:', identifier);

            // Controlla cache fresca
            try {
                const cached = localStorage.getItem(CACHE_KEY);
                if (cached) {
                    const { ts, id, payload } = JSON.parse(cached);
                    if (id === identifier.value && Date.now() - ts < CACHE_TTL && payload) {
                        console.log('[useSimBrief] serving from cache');
                        if (!cancelled) { setData(payload); setLoading(false); }
                        return;
                    }
                }
            } catch (_) { }

            // Fetch
            try {
                const opts = identifier.type === 'userid'
                    ? { userid: identifier.value.trim() }
                    : { username: identifier.value.trim() };

                console.log('[useSimBrief] fetching with opts:', opts);
                const raw = await fetchSimBriefData(opts);
                const parsed = parseSimBriefData(raw);

                // Fallback: se SimBrief non restituisce airlineName (es. Velar Airlines / Nexa Network),
                // usa quello salvato da Schedule al momento del dispatch
                if (!parsed.airlineName) {
                    try {
                        const saved = localStorage.getItem('scheduleDispatchAirline');
                        if (saved) {
                            const { name } = JSON.parse(saved);
                            if (name) parsed.airlineName = name;
                        }
                    } catch (_) { }
                }

                console.log('[useSimBrief] parsed:', parsed);

                try {
                    localStorage.setItem(CACHE_KEY, JSON.stringify({
                        ts: Date.now(), id: identifier.value, payload: parsed,
                    }));
                } catch (_) { }

                if (!cancelled) { setData(parsed); setError(null); }
            } catch (err) {
                console.warn('[useSimBrief] fetch error:', err);
                if (!cancelled) setError(err.message);
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        load();
        return () => { cancelled = true; };
    }, []);

    return { data, loading, error };
}
