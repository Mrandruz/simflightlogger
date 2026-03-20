/**
 * useCopilot — hook per comunicare con la Cloud Function askCopilot.
 *
 * Aggrega le statistiche dai voli dell'utente e gestisce
 * lo streaming della risposta token per token.
 *
 * Uso:
 *   const { send, messages, loading, clear } = useCopilot(flights);
 */
import { useState, useCallback, useMemo } from 'react';

// URL della tua Cloud Function — sostituisci con il tuo progetto Firebase
const FUNCTION_URL =
    'https://europe-west1-simflightlogger.cloudfunctions.net/askCopilot';

// ---------------------------------------------------------------------------
// Aggregazione statistica — riduce i token inviati al modello
// ---------------------------------------------------------------------------
const aggregateStats = (flights) => {
    if (!flights || flights.length === 0) return null;

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Contatori
    const aircraftCount  = {};
    const airportCount   = {};
    const airlineCount   = {};
    const routeCount     = {};
    const monthlyCount   = {};

    let totalHours = 0;
    let totalMiles = 0;
    let flightsLastMonth = 0;
    let longestFlight = null;

    const sorted = [...flights].sort(
        (a, b) => new Date(b.date) - new Date(a.date)
    );

    sorted.forEach((f) => {
        totalHours += f.flightTime || 0;
        totalMiles += f.miles || 0;

        if (new Date(f.date) >= thirtyDaysAgo) flightsLastMonth++;
        if (!longestFlight || (f.miles || 0) > (longestFlight.miles || 0)) {
            longestFlight = f;
        }

        if (f.aircraft) aircraftCount[f.aircraft] = (aircraftCount[f.aircraft] || 0) + 1;
        if (f.departure) airportCount[f.departure] = (airportCount[f.departure] || 0) + 1;
        if (f.arrival)   airportCount[f.arrival]   = (airportCount[f.arrival]   || 0) + 1;
        if (f.airline)   airlineCount[f.airline]   = (airlineCount[f.airline]   || 0) + 1;
        if (f.departure && f.arrival) {
            const key = `${f.departure}→${f.arrival}`;
            routeCount[key] = (routeCount[key] || 0) + 1;
        }
        if (f.date) {
            const month = f.date.slice(0, 7); // YYYY-MM
            monthlyCount[month] = (monthlyCount[month] || 0) + 1;
        }
    });

    const top = (obj, n = 5) =>
        Object.entries(obj)
            .sort(([, a], [, b]) => b - a)
            .slice(0, n)
            .map(([k, v]) => `${k} (${v})`)
            .join(', ');

    const last = sorted[0];

    return {
        totalFlights:        flights.length,
        totalHours:          totalHours.toFixed(1),
        totalMiles:          Math.round(totalMiles).toLocaleString(),
        topAircraft:         Object.entries(aircraftCount).sort(([,a],[,b]) => b-a)[0]?.[0] || '—',
        topAirport:          Object.entries(airportCount).sort(([,a],[,b]) => b-a)[0]?.[0] || '—',
        topAirline:          Object.entries(airlineCount).sort(([,a],[,b]) => b-a)[0]?.[0] || '—',
        topRoute:            Object.entries(routeCount).sort(([,a],[,b]) => b-a)[0]?.[0] || '—',
        flightsLastMonth,
        avgHours:            (totalHours / flights.length).toFixed(1),
        longestFlight:       longestFlight
            ? `${longestFlight.departure}→${longestFlight.arrival} (${Math.round(longestFlight.miles || 0)} nm)`
            : '—',
        topAircraftList:     top(aircraftCount),
        topAirportList:      top(airportCount),
        topRouteList:        top(routeCount),
        monthlyDistribution: Object.entries(monthlyCount)
            .sort(([a],[b]) => a.localeCompare(b))
            .slice(-6)
            .map(([m, c]) => `${m}: ${c}`)
            .join(', '),
        lastFlight: last
            ? `${last.departure}→${last.arrival} il ${last.date} (${last.aircraft})`
            : '—',
        lastFlightDetail: last
            ? `Rotta: ${last.departure}→${last.arrival}, Aereo: ${last.aircraft}, ` +
              `Compagnia: ${last.airline || '—'}, Durata: ${last.flightTime || '—'}h, ` +
              `Distanza: ${last.miles || '—'} nm, Data: ${last.date}`
            : null,
    };
};

// ---------------------------------------------------------------------------
// Hook principale
// ---------------------------------------------------------------------------
export function useCopilot(flights) {
    const [messages, setMessages] = useState([]);
    const [loading, setLoading]   = useState(false);
    const [error, setError]       = useState(null);

    const stats = useMemo(() => aggregateStats(flights), [flights]);

    const send = useCallback(
        async (userMessage) => {
            if (!userMessage.trim() || loading) return;

            const userMsg = { role: 'user', content: userMessage };
            const assistantMsg = { role: 'assistant', content: '' };

            setMessages((prev) => [...prev, userMsg, assistantMsg]);
            setLoading(true);
            setError(null);

            // Cronologia per il contesto (esclude l'ultimo assistantMsg vuoto)
            const history = messages.map((m) => ({
                role: m.role,
                content: m.content,
            }));

            try {
                const res = await fetch(FUNCTION_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ message: userMessage, stats, history }),
                });

                if (!res.ok) throw new Error(`HTTP ${res.status}`);

                const reader  = res.body.getReader();
                const decoder = new TextDecoder();
                let buffer = '';

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    buffer += decoder.decode(value, { stream: true });
                    const lines = buffer.split('\n');
                    buffer = lines.pop();

                    for (const line of lines) {
                        if (!line.startsWith('data: ')) continue;
                        const data = line.slice(6).trim();
                        if (data === '[DONE]') break;

                        try {
                            const { text } = JSON.parse(data);
                            setMessages((prev) => {
                                const updated = [...prev];
                                updated[updated.length - 1] = {
                                    ...updated[updated.length - 1],
                                    content: updated[updated.length - 1].content + text,
                                };
                                return updated;
                            });
                        } catch (_) {}
                    }
                }
            } catch (err) {
                setError('Errore di connessione. Riprova.');
                console.error('[useCopilot]', err);
                // Rimuove il messaggio assistente vuoto in caso di errore
                setMessages((prev) => prev.slice(0, -1));
            } finally {
                setLoading(false);
            }
        },
        [flights, loading, messages, stats]
    );

    const clear = useCallback(() => setMessages([]), []);

    return { send, messages, loading, error, clear, hasData: !!stats };
}
