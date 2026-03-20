const https = require("firebase-functions/v2/https");
const {defineSecret} = require("firebase-functions/params");
const Anthropic = require("@anthropic-ai/sdk");

const ANTHROPIC_KEY = defineSecret("ANTHROPIC_API_KEY");

const AVAILABLE_CHECKLISTS = [
  "Airbus A350", "Airbus A330", "Airbus A320",
  "Airbus A319", "Airbus A321", "Airbus A380",
  "Boeing 777", "Boeing 787",
];

const buildPrompt = (s) => [
  "Sei Skydeck Copilot, assistente di analisi volo personale.",
  "Rispondi SEMPRE in italiano, in modo conciso.",
  "Usa solo dati reali, non inventare cifre.",
  "",
  "AZIONE SPECIALE — APERTURA CHECKLIST:",
  "Se l'utente chiede di aprire, vedere o accedere alla checklist di un aereo,",
  "rispondi con una frase breve e aggiungi in fondo il tag:",
  "[OPEN_CHECKLIST:Nome Esatto Aereo]",
  "Esempio: 'Apro subito la checklist del Boeing 777 per te. [OPEN_CHECKLIST:Boeing 777]'",
  `Checklist disponibili: ${AVAILABLE_CHECKLISTS.join(", ")}.`,
  "Se l'aereo richiesto non è in lista, comunicalo senza usare il tag.",
  "",
  "Dati volo utente:",
  `- Voli totali: ${s.totalFlights}`,
  `- Ore totali: ${s.totalHours}h`,
  `- Distanza totale: ${s.totalMiles} nm`,
  `- Aereo piu usato: ${s.topAircraft}`,
  `- Aeroporto hub: ${s.topAirport}`,
  `- Compagnia piu usata: ${s.topAirline}`,
  `- Rotta preferita: ${s.topRoute}`,
  `- Voli ultimo mese: ${s.flightsLastMonth}`,
  `- Media ore/volo: ${s.avgHours}h`,
  `- Volo piu lungo: ${s.longestFlight}`,
  `- Top 5 aerei: ${s.topAircraftList}`,
  `- Top 5 aeroporti: ${s.topAirportList}`,
  `- Top 5 rotte: ${s.topRouteList}`,
  `- Trend mensile: ${s.monthlyDistribution}`,
  `- Ultimo volo: ${s.lastFlight}`,
  `- Prossimo volo pianificato (SimBrief): ${s.nextFlight || "non disponibile"}`,
  s.lastFlightDetail ? `- Dettaglio ultimo volo: ${s.lastFlightDetail}` : "",
  "",
  "Logbook dettagliato per aereo (voli, ore, nm, ultimo volo, rotta top):",
  s.aircraftLogbook || "nessun dato",
].join("\n").trim();

exports.askCopilot = https.onRequest(
  {
    secrets: [ANTHROPIC_KEY],
    cors: false,
    region: "europe-west1",
    timeoutSeconds: 60,
  },
  async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
      return res.status(204).send("");
    }

    if (req.method !== "POST") {
      return res.status(405).json({error: "Method not allowed"});
    }

    const {message, stats, history = []} = req.body;

    if (!message || !stats) {
      return res.status(400).json({error: "Missing message or stats"});
    }

    try {
      const client = new Anthropic({apiKey: ANTHROPIC_KEY.value()});

      const messages = [
        ...history.slice(-6),
        {role: "user", content: message},
      ];

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      const stream = await client.messages.stream({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        system: buildPrompt(stats),
        messages,
      });

      for await (const chunk of stream) {
        const isDelta = chunk.type === "content_block_delta";
        const isText = chunk.delta && chunk.delta.type === "text_delta";
        if (isDelta && isText) {
          const payload = JSON.stringify({text: chunk.delta.text});
          res.write(`data: ${payload}\n\n`);
        }
      }

      res.write("data: [DONE]\n\n");
      res.end();
    } catch (err) {
      console.error("Copilot error:", err);
      res.status(500).json({error: err.message});
    }
  },
);
