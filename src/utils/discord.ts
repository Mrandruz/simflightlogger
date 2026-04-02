// src/utils/discord.ts

interface DiscordMessage {
  content?: string;
  embeds?: Array<{
    title?: string;
    description?: string;
    color?: number;
    fields?: Array<{ name: string; value: string; inline?: boolean }>;
    footer?: { text: string };
    timestamp?: string;
  }>;
}

/**
 * Invia una notifica al server Discord via proxy
 */
export async function sendDiscordNotification(message: DiscordMessage) {
  try {
    const response = await fetch('/api/discord-proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message),
    });

    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
      } catch {
        errorData = { error: response.statusText };
      }
      const msg = errorData.error || response.statusText || 'Unknown Discord Error';
      const details = errorData.details ? ` (${errorData.details})` : '';
      return { error: `${msg}${details}` };
    }

    // Discord Webhook restituisce spesso 204 No Content se l'invio ha successo.
    // In tal caso, non cerchiamo di parsare il JSON per evitare errori.
    if (response.status === 204) {
      return { success: true };
    }

    return await response.json();
  } catch (error) {
    console.error('Error sending Discord notification:', error);
    return { error: 'Failed to send notification' };
  }
}

/**
 * Helper per creare un embed di allerta operativa
 */
export function sendOperationalAlert(title: string, description: string, fields: any[] = []) {
  return sendDiscordNotification({
    embeds: [{
      title: `⚠️ ${title}`,
      description,
      color: 0xffa500, // Orange
      fields,
      timestamp: new Date().toISOString(),
      footer: { text: "ARIA OPS · Velar Airlines" }
    }]
  });
}
