const https = require("firebase-functions/v2/https");
const {defineSecret} = require("firebase-functions/params");
const Anthropic = require("@anthropic-ai/sdk");

const ANTHROPIC_KEY = defineSecret("ANTHROPIC_API_KEY");

const buildPrompt = (s) => [
  "Sei Skydeck Copilot, assistente di analisi volo personale.",
  "Rispondi SEMPRE in italiano, in modo conciso.",
  "Usa solo dati reali, non inventare cifre.",
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
  s.lastFlightDetail ? `- Dettaglio: ${s.lastFlightDetail}` : "",
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
