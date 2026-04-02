// api/cron-daily-report.js
// Proxy per chiamare la funzione Cloud di Firebase (per bypassare colli di bottiglia e caching)

export default async function handler(req, res) {
  const FIREBASE_FUNCTION_URL = "https://europe-west1-simflightlogger.cloudfunctions.net/dailyNetworkReport";
  
  try {
    const response = await fetch(FIREBASE_FUNCTION_URL);
    const data = await response.json();
    return res.status(200).json(data);
  } catch (error) {
    console.error('[Proxy Error]', error);
    return res.status(500).json({ error: "Errore durante il trigger della Firebase Function" });
  }
}
