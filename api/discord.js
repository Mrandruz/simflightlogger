// api/discord.js
// Gestore notifiche Discord per Vercel Production
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { channel, payload } = req.body;
  
  // Mappatura canali -> Webhook URL (usando variabili d'ambiente Vercel)
  let webhookUrl = process.env.VITE_DISCORD_WEBHOOK_URL; // fallback
  
  if (channel === 'ops') webhookUrl = process.env.VITE_DISCORD_WEBHOOK_OPS || webhookUrl;
  if (channel === 'fleet') webhookUrl = process.env.VITE_DISCORD_WEBHOOK_FLEET || webhookUrl;
  if (channel === 'daily') webhookUrl = process.env.VITE_DISCORD_WEBHOOK_DAILY || webhookUrl;

  if (!webhookUrl || !payload) {
    return res.status(400).json({ error: 'Missing webhook URL or payload' });
  }

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(response.status).json({ error: errorText });
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Discord API Error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
