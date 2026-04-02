// api/discord-proxy.js
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const webhookUrl = process.env.DISCORD_WEBHOOK_URL || process.env.VITE_DISCORD_WEBHOOK_URL;
  if (!webhookUrl) {
    return res.status(500).json({ error: 'Discord Webhook URL non configurato nel server (VITE_DISCORD_WEBHOOK_URL mancante)' });
  }

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(response.status).json({ error: errorText });
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Discord proxy error:', error);
    return res.status(500).json({ 
      error: 'Errore interno del proxy Discord', 
      details: error.message,
      environment: process.env.NODE_ENV
    });
  }
}
