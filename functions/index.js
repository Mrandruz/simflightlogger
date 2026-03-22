const https = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
const Anthropic = require("@anthropic-ai/sdk");

// ── Inizializza Firebase Admin (per Auth + Firestore rate limiting) ──
admin.initializeApp();

const ANTHROPIC_KEY = defineSecret("ANTHROPIC_API_KEY");
const ELEVENLABS_KEY = defineSecret("ELEVENLABS_API_KEY");

// ── Configurazione ───────────────────────────────────────────────────
const ADAM_VOICE_ID = "pNInz6obpgDQGcFmaJgB";

// CORS: sostituisci con il tuo dominio reale in produzione
// Esempio: "https://skydeck.app" oppure "https://mia-app.web.app"
const ALLOWED_ORIGINS = [
  "https://simflightlogger.vercel.app",
];

// Rate limit: max richieste per finestra temporale
const RATE_LIMIT_COPILOT = { max: 15, windowMs: 60 * 60 * 1000 };  // 15/ora
const RATE_LIMIT_TTS     = { max: 30, windowMs: 60 * 60 * 1000 };  // 30/ora

// ── Helper: CORS controllato ─────────────────────────────────────────
function setCorsHeaders(req, res) {
  const origin = req.headers.origin;
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

// ── Helper: Verifica token Firebase Auth ─────────────────────────────
async function verifyAuthToken(req, res) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    res.status(401).json({ error: "Autenticazione richiesta." });
    return null;
  }

  try {
    const decoded = await admin.auth().verifyIdToken(token);
    return decoded; // contiene decoded.uid
  } catch {
    res.status(401).json({ error: "Token non valido o scaduto." });
    return null;
  }
}

// ── Helper: Rate Limiting per utente su Firestore ────────────────────
async function checkRateLimit(userId, functionName, config) {
  const { max, windowMs } = config;
  const now = Date.now();
  const ref = admin.firestore()
    .collection("users").doc(userId)
    .collection("rateLimits").doc(functionName);

  return admin.firestore().runTransaction(async (t) => {
    const doc = await t.get(ref);
    const data = doc.exists ? doc.data() : { count: 0, windowStart: now };

    // Reset se la finestra temporale è scaduta
    if (now - data.windowStart > windowMs) {
      t.set(ref, { count: 1, windowStart: now });
      return { allowed: true, remaining: max - 1 };
    }

    if (data.count >= max) {
      const resetIn = Math.ceil((data.windowStart + windowMs - now) / 60000);
      return { allowed: false, resetInMinutes: resetIn };
    }

    t.set(ref, { count: data.count + 1, windowStart: data.windowStart }, { merge: true });
    return { allowed: true, remaining: max - data.count - 1 };
  });
}

// ── Helper: Validazione e sanitizzazione input ───────────────────────
function validateMessage(message) {
  if (!message || typeof message !== "string") {
    return { valid: false, error: "Messaggio mancante o non valido." };
  }

  const trimmed = message.trim();

  if (trimmed.length < 2) {
    return { valid: false, error: "Messaggio troppo corto." };
  }

  // Tronca a 3000 caratteri per evitare abusi sui token
  const sanitized = trimmed.slice(0, 3000);

  // Rilevamento prompt injection di base
  const injectionPatterns = [
    /ignore\s+(previous|all|prior)\s+instruction/i,
    /ignora\s+(le\s+)?(istruzioni|prompt|sistema)/i,
    /you\s+are\s+now\s+/i,
    /sei\s+ora\s+/i,
    /pretend\s+you\s+are/i,
    /act\s+as\s+if\s+you\s+have\s+no\s+restriction/i,
    /<script[\s\S]*?>/i,
    /javascript:/i,
  ];

  if (injectionPatterns.some((p) => p.test(sanitized))) {
    return { valid: false, error: "Input non valido." };
  }

  return { valid: true, sanitized };
}

// ── Prompt builder ───────────────────────────────────────────────────
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
  s.flightList
    ? "Full flight list (date|route|airline|aircraft|distance|time|alliance):\n" + s.flightList
    : "",
].join("\n").trim();


// ════════════════════════════════════════════════════════════════════
// ENDPOINT: askCopilot
// ════════════════════════════════════════════════════════════════════
exports.askCopilot = https.onRequest(
  {
    secrets: [ANTHROPIC_KEY],
    cors: false, // gestiamo CORS manualmente
    region: "europe-west1",
    timeoutSeconds: 60,
  },
  async (req, res) => {
    setCorsHeaders(req, res);

    if (req.method === "OPTIONS") return res.status(204).send("");
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

    // ── 1. Autenticazione ──────────────────────────────────────────
    const user = await verifyAuthToken(req, res);
    if (!user) return; // verifyAuthToken ha già risposto con 401

    // ── 2. Rate Limiting ───────────────────────────────────────────
    const rateCheck = await checkRateLimit(user.uid, "askCopilot", RATE_LIMIT_COPILOT);
    if (!rateCheck.allowed) {
      return res.status(429).json({
        error: `Limite raggiunto. Riprova tra ${rateCheck.resetInMinutes} minuti.`,
      });
    }

    // ── 3. Validazione input ───────────────────────────────────────
    const { message, stats, history = [] } = req.body;

    if (!stats || typeof stats !== "object") {
      return res.status(400).json({ error: "Stats mancanti o non valide." });
    }

    const validation = validateMessage(message);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    // ── 4. Chiamata Claude ─────────────────────────────────────────
    try {
      const client = new Anthropic({ apiKey: ANTHROPIC_KEY.value() });

      // Limita la history alle ultime 6 coppie per contenere i token
      const safeHistory = Array.isArray(history)
        ? history.slice(-6).filter(
            (m) => m && typeof m.role === "string" && typeof m.content === "string"
          )
        : [];

      const messages = [
        ...safeHistory,
        { role: "user", content: validation.sanitized },
      ];

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("X-RateLimit-Remaining", rateCheck.remaining);

      const stream = await client.messages.stream({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        system: buildPrompt(stats),
        messages,
      });

      for await (const chunk of stream) {
        if (
          chunk.type === "content_block_delta" &&
          chunk.delta?.type === "text_delta"
        ) {
          res.write(`data: ${JSON.stringify({ text: chunk.delta.text })}\n\n`);
        }
      }

      res.write("data: [DONE]\n\n");
      res.end();
    } catch (err) {
      console.error("Copilot error:", err);
      res.status(500).json({ error: "Errore interno del server." });
    }
  },
);


// ════════════════════════════════════════════════════════════════════
// ENDPOINT: textToSpeech
// ════════════════════════════════════════════════════════════════════
exports.textToSpeech = https.onRequest(
  {
    secrets: [ELEVENLABS_KEY],
    cors: false,
    region: "europe-west1",
    timeoutSeconds: 60,
  },
  async (req, res) => {
    setCorsHeaders(req, res);

    if (req.method === "OPTIONS") return res.status(204).send("");
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

    // ── 1. Autenticazione ──────────────────────────────────────────
    const user = await verifyAuthToken(req, res);
    if (!user) return;

    // ── 2. Rate Limiting ───────────────────────────────────────────
    const rateCheck = await checkRateLimit(user.uid, "textToSpeech", RATE_LIMIT_TTS);
    if (!rateCheck.allowed) {
      return res.status(429).json({
        error: `Limite raggiunto. Riprova tra ${rateCheck.resetInMinutes} minuti.`,
      });
    }

    // ── 3. Validazione input ───────────────────────────────────────
    const { text } = req.body;
    if (!text || typeof text !== "string" || text.trim().length < 1) {
      return res.status(400).json({ error: "Testo mancante o non valido." });
    }

    const truncated = text.trim().slice(0, 5000);

    // ── 4. Chiamata ElevenLabs ─────────────────────────────────────
    try {
      const response = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${ADAM_VOICE_ID}`,
        {
          method: "POST",
          headers: {
            "xi-api-key": ELEVENLABS_KEY.value(),
            "Content-Type": "application/json",
            "Accept": "audio/mpeg",
          },
          body: JSON.stringify({
            text: truncated,
            model_id: "eleven_multilingual_v2",
            voice_settings: {
              stability: 0.5,
              similarity_boost: 0.75,
              style: 0.2,
              use_speaker_boost: true,
            },
          }),
        },
      );

      if (!response.ok) {
        const err = await response.text();
        console.error("ElevenLabs error:", err);
        return res.status(502).json({ error: "Errore del servizio TTS." });
      }

      const audioBuffer = await response.arrayBuffer();
      res.setHeader("Content-Type", "audio/mpeg");
      res.setHeader("Content-Length", audioBuffer.byteLength);
      res.send(Buffer.from(audioBuffer));
    } catch (err) {
      console.error("TTS error:", err);
      res.status(500).json({ error: "Errore interno del server." });
    }
  },
);
