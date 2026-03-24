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
import { getAuth } from 'firebase/auth';
import { useSimBrief } from './useSimBrief';

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

    const aircraftCount = {};
    const airportCount = {};   // movements: dep+arr, ogni volo conta 2 volte (metrica Hubs)
    const flightCountByAirport = {}; // flights: quanti voli coinvolgono questo aeroporto (metrica Copilot legacy)
    const airlineCount = {};
    const routeCount = {};
    const monthlyCount = {};

    // Indice per aereo — raccoglie dati dettagliati per ogni tipo
    const aircraftIndex = {};

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

        if (f.aircraft) {
            aircraftCount[f.aircraft] = (aircraftCount[f.aircraft] || 0) + 1;

            // Costruisce l'indice per aereo
            if (!aircraftIndex[f.aircraft]) {
                aircraftIndex[f.aircraft] = {
                    count: 0, hours: 0, miles: 0,
                    lastFlight: null, routes: {},
                };
            }
            const idx = aircraftIndex[f.aircraft];
            idx.count++;
            idx.hours += f.flightTime || 0;
            idx.miles += f.miles || 0;
            // Il primo volo incontrato (sorted desc) è l'ultimo cronologicamente
            if (!idx.lastFlight) {
                idx.lastFlight = `${f.departure}→${f.arrival} il ${f.date}`;
            }
            if (f.departure && f.arrival) {
                const r = `${f.departure}→${f.arrival}`;
                idx.routes[r] = (idx.routes[r] || 0) + 1;
            }
        }

        // Movements: ogni volo vale +1 per departure E +1 per arrival (metrica usata in Hubs)
        if (f.departure) airportCount[f.departure] = (airportCount[f.departure] || 0) + 1;
        if (f.arrival) airportCount[f.arrival] = (airportCount[f.arrival] || 0) + 1;
        // Flights: un volo vale 1 indipendentemente da quanti aeroporti tocca (metrica Copilot legacy)
        const touchedAirports = new Set([f.departure, f.arrival].filter(Boolean));
        touchedAirports.forEach(icao => {
            flightCountByAirport[icao] = (flightCountByAirport[icao] || 0) + 1;
        });
        if (f.airline) airlineCount[f.airline] = (airlineCount[f.airline] || 0) + 1;
        if (f.departure && f.arrival) {
            const key = `${f.departure}→${f.arrival}`;
            routeCount[key] = (routeCount[key] || 0) + 1;
        }
        if (f.date) {
            const month = f.date.slice(0, 7);
            monthlyCount[month] = (monthlyCount[month] || 0) + 1;
        }
    });

    const top = (obj, n = 20) =>
        Object.entries(obj)
            .sort(([, a], [, b]) => b - a)
            .slice(0, n)
            .map(([k, v]) => `${k} (${v})`)
            .join(', ');

    const last = sorted[0];

    // Serializza l'indice aereo in una stringa compatta per il prompt
    const aircraftLogbook = Object.entries(aircraftIndex)
        .sort(([, a], [, b]) => b.count - a.count)
        .map(([type, d]) => {
            const topRoute = Object.entries(d.routes)
                .sort(([, a], [, b]) => b - a)[0]?.[0] || '—';
            return `${type}: ${d.count} voli, ` +
                `${d.hours.toFixed(1)}h, ` +
                `${Math.round(d.miles)} nm, ` +
                `ultimo: ${d.lastFlight || '—'}, ` +
                `rotta top: ${topRoute}`;
        })
        .join(' | ');

    return {
        totalFlights: flights.length,
        totalHours: totalHours.toFixed(1),
        totalMiles: Math.round(totalMiles).toLocaleString(),
        topAircraft: Object.entries(aircraftCount).sort(([, a], [, b]) => b - a)[0]?.[0] || '—',
        // topAirport usa movements (coerente con la pagina Hubs)
        topAirport: Object.entries(airportCount).sort(([, a], [, b]) => b - a)[0]?.[0] || '—',
        topAirline: Object.entries(airlineCount).sort(([, a], [, b]) => b - a)[0]?.[0] || '—',
        topRoute: Object.entries(routeCount).sort(([, a], [, b]) => b - a)[0]?.[0] || '—',
        flightsLastMonth,
        avgHours: (totalHours / flights.length).toFixed(1),
        longestFlight: longestFlight
            ? `${longestFlight.departure}→${longestFlight.arrival} (${Math.round(longestFlight.miles || 0)} nm)`
            : '—',
        topAircraftList: top(aircraftCount),
        // Classifica aeroporti per MOVEMENTS (dep+arr sommati) — coerente con pagina Hubs
        // Formato: "LFPG (47), LIRF (38), ..." dove il numero è il totale movimenti
        topAirportList: top(airportCount),
        // Classifica aeroporti per VOLI DISTINTI — utile quando l'utente chiede
        // "quanti voli ho fatto passando per X" senza contare dep e arr separatamente
        topAirportListByFlights: top(flightCountByAirport),
        topRouteList: top(routeCount),
        monthlyDistribution: Object.entries(monthlyCount)
            .sort(([a], [b]) => a.localeCompare(b))
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
        aircraftLogbook,
        uniqueAirports: Object.keys(airportCount).length,
        // Logbook completo compresso — ground truth per analisi illimitate.
        // Formato CSV: date,departure,arrival,aircraft,airline,flightTime_h,distance_nm
        compressedLogbook: sorted.map(f =>
            [
                f.date || '',
                f.departure || '',
                f.arrival || '',
                f.aircraft || '',
                f.airline || '',
                (f.flightTime || 0).toFixed(1),
                Math.round(f.miles || 0),
            ].join(',')
        ).join('\n'),
    };
};

// ---------------------------------------------------------------------------
// Hook principale
// ---------------------------------------------------------------------------
export function useCopilot(flights) {
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [onAction, setOnAction] = useState(null);

    const { data: simbrief } = useSimBrief();

    const stats = useMemo(() => {
        const base = aggregateStats(flights);
        if (!base) return null;

        // Aggiunge il prossimo volo pianificato da SimBrief se disponibile
        if (simbrief) {
            const formatZulu = (val) => {
                if (!val) return null;
                const d = !isNaN(Number(val)) && String(val).length >= 10
                    ? new Date(Number(val) * 1000)
                    : new Date(val);
                if (isNaN(d.getTime())) return null;
                return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}z`;
            };

            base.nextFlight = [
                `${simbrief.origin?.icao} → ${simbrief.destination?.icao}`,
                simbrief.aircraft ? `aereo: ${simbrief.aircraft}` : '',
                simbrief.airlineName ? `compagnia: ${simbrief.airlineName}` : '',
                simbrief.callsign ? `callsign: ${simbrief.callsign}` : '',
                simbrief.departureTime ? `partenza: ${formatZulu(simbrief.departureTime)}` : '',
                simbrief.arrivalTime ? `arrivo stimato: ${formatZulu(simbrief.arrivalTime)}` : '',
                simbrief.distance ? `distanza: ${simbrief.distance} nm` : '',
                simbrief.cruiseAltitude ? `livello di crociera: FL${Math.round(simbrief.cruiseAltitude / 100)}` : '',
                simbrief.fuel ? `carburante: ${simbrief.fuel} kg` : '',
            ].filter(Boolean).join(', ');
        } else {
            base.nextFlight = 'nessun piano di volo SimBrief disponibile';
        }

        return base;
    }, [flights, simbrief]);

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
                // Recupera il token Firebase dell'utente autenticato
                const auth = getAuth();
                const token = await auth.currentUser?.getIdToken();
                if (!token) throw new Error('Utente non autenticato.');

                const res = await fetch(FUNCTION_URL, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`,
                    },
                    body: JSON.stringify({ message: userMessage, stats, history }),
                });

                if (!res.ok) throw new Error(`HTTP ${res.status}`);

                const reader = res.body.getReader();
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
                        } catch (_) { }
                    }
                }
            } catch (err) {
                setError('Errore di connessione. Riprova.');
                console.error('[useCopilot]', err);
                // Rimuove il messaggio assistente vuoto in caso di errore
                setMessages((prev) => prev.slice(0, -1));
            } finally {
                setLoading(false);
                // Dopo la risposta completa, controlla se il modello ha segnalato
                // un'azione di apertura checklist tramite il tag speciale
                setMessages((prev) => {
                    const last = prev[prev.length - 1];
                    if (!last || last.role !== 'assistant') return prev;
                    const match = last.content.match(/\[OPEN_CHECKLIST:([^\]]+)\]/);
                    if (match) {
                        setOnAction({ type: 'open_checklist', aircraft: match[1].trim() });
                        // Rimuove il tag dalla risposta visibile
                        const updated = [...prev];
                        updated[updated.length - 1] = {
                            ...last,
                            content: last.content.replace(/\[OPEN_CHECKLIST:[^\]]+\]/, '').trim(),
                        };
                        return updated;
                    }
                    return prev;
                });
            }
        },
        [flights, loading, messages, stats]
    );

    const clear = useCallback(() => { setMessages([]); setOnAction(null); }, []);

    return { send, messages, loading, error, clear, hasData: !!stats, onAction };
}
