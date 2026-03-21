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
  "You are Skydeck Copilot, a personal flight analysis assistant.",
  "ALWAYS reply in English, concisely and accurately.",
  "Use only real data provided — never invent figures.",
  "",
  "SPECIAL ACTION — OPEN CHECKLIST:",
  "If the user asks to open, view or access the checklist for an aircraft,",
  "reply with a short sentence and append at the end:",
  "[OPEN_CHECKLIST:Exact Aircraft Name]",
  "Example: 'Opening the Boeing 777 checklist for you. [OPEN_CHECKLIST:Boeing 777]'",
  `Available checklists: ${AVAILABLE_CHECKLISTS.join(", ")}.`,
  "If the requested aircraft is not in the list, inform the user without using the tag.",
  "",
  "User flight data:",
  `- Total flights: ${s.totalFlights}`,
  `- Total hours: ${s.totalHours}h`,
  `- Total distance: ${s.totalMiles} nm`,
  `- Most used aircraft: ${s.topAircraft || s.topAircraftList || "—"}`,
  `- Hub airport: ${s.topAirport || "—"}`,
  `- Most used airline: ${s.topAirline}`,
  `- Favourite route: ${s.topRoute || s.topRouteList || "—"}`,
  `- Flights last month: ${s.flightsLastMonth ?? "—"}`,
  `- Average hours/flight: ${s.avgHours || "—"}h`,
  `- Longest flight: ${s.longestFlight}`,
  `- Unique airports visited: ${s.uniqueAirports || "—"}`,
  `- Top 5 aircraft: ${s.topAircraftList}`,
  `- Top 5 airports: ${s.topAirportList || "—"}`,
  `- Top 10 routes: ${s.topRouteList}`,
  `- Monthly trend: ${s.monthlyDistribution}`,
  `- Last flight: ${s.lastFlight}`,
  `- Next planned flight (SimBrief): ${s.nextFlight || "not available"}`,
  s.lastFlightDetail ? `- Last flight detail: ${s.lastFlightDetail}` : "",
  "",
  "Detailed logbook per aircraft (flights, hours, nm, last flight, top route):",
  s.aircraftLogbook || "no data",
  "",
  s.flightList ? "Full flight list (date|route|airline|aircraft|distance|time|alliance):\n" + s.flightList : "",
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
