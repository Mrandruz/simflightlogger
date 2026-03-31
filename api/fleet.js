import fs from 'fs';
import path from 'path';

// api/fleet.js
// Fornisce lo stato iniziale della flotta per l'inizializzazione di Cloud Firestore
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const dbPath = path.resolve(process.cwd(), 'data/fleet-state.json');
  
  if (fs.existsSync(dbPath)) {
    try {
      const data = fs.readFileSync(dbPath, 'utf8');
      res.setHeader('Content-Type', 'application/json');
      return res.status(200).end(data);
    } catch (e) {
      return res.status(500).json({ error: 'Errore durante la lettura del file' });
    }
  } else {
    return res.status(404).json({ error: 'Configurazione flotta non trovata' });
  }
}
