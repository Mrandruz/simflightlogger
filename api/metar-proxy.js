// api/metar-proxy.js
// Vercel Serverless Function — proxy per aviationweather.gov
// Risolve il blocco CORS in produzione

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { ids } = req.query;
  if (!ids) {
    return res.status(400).json({ error: 'Parametro ids mancante' });
  }

  try {
    const url = `https://aviationweather.gov/api/data/metar?ids=${encodeURIComponent(ids)}&format=json`;
    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' },
    });

    if (!response.ok) {
      return res.status(response.status).json({ error: 'Errore da aviationweather.gov' });
    }

    const data = await response.json();

    // CORS header per sicurezza
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).json(data);
  } catch (error) {
    console.error('METAR proxy error:', error);
    return res.status(500).json({ error: 'Errore interno del proxy METAR' });
  }
}
