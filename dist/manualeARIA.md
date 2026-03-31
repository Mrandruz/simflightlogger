# 📖 MANUALE LOGICHE OPERATIVE ARIA OPS v1.0
**Velar Airlines — "Motion, simplified."**

Questo documento definisce i protocolli algoritmici e le logiche di business che il sistema ARIA utilizza per la gestione della flotta, la convalida delle schedule e la progressione della crew.

---

## 1. Gestione Fisica della Flotta (Asset Management)
ARIA non considera la flotta come un'entità generica, ma traccia ogni singolo aeromobile tramite il proprio **Tail Number**.

* **Identificazione Unica**: Ogni aereo ha una registrazione univoca (es. I-VLRA per A319, I-VLRW per A350).
* **Contatore Ore Volo**: Il sistema incrementa il campo `hours` di ogni tail number al termine di ogni missione.
* **Cicli di Manutenzione**:
    * **Check A (500h)**: Soglia obbligatoria per il fermo tecnico.
    * **Stato "Maintenance_Soon"**: Attivato automaticamente quando mancano meno di 20 ore alla soglia (buffer di sicurezza).
    * **Stato "Grounded"**: Impedisce l'assegnazione dell'aereo a qualunque schedule finché il tecnico non resetta il contatore.

---

## 2. Validazione Temporale e Schedule (Temporal Integrity)
Il motore di pianificazione di ARIA garantisce la coerenza tra il calendario reale e l'offerta di volo.

* **Filtro Frequenza Settimanale**: ARIA confronta il giorno della settimana corrente (`new Date().getDay()`) con i vincoli della rotta.
* **Sincronizzazione Giorni**:
    * `Daily`: Disponibile 7 giorni su 7.
    * `1,3,5,7`: La rotta appare nella schedule solo di Lunedì, Mercoledì, Venerdì e Domenica.
* **Aderenza alla Base**: Il primo volo della schedule deve tassativamente partire dall'ultimo aeroporto di arrivo registrato nel logbook del pilota.

---

## 3. Algoritmo di Progressione e Reward (XP System)
Il sistema premia la professionalità e la costanza tramite un calcolo dinamico dei punti esperienza.

* **Calcolo Base**: `XP = (Miglia / 10) + (Minuti Volo * 50) + 250`.
* **Moltiplicatori Boutique**:
    * **Short-Haul Premium**: I voli sotto le 1500 miglia ricevono un bonus del **+50% XP** per incentivare le rotte regionali ad alta frequenza.
    * **Transcontinentale**: I voli tra 1500 e 3000 miglia ricevono un bonus del **+25% XP**.
    * **Streak Bonus**: Volare per 7 giorni consecutivi attiva un moltiplicatore **x2** su tutti gli XP della settimana.
* **Elite Bonus**: Al superamento dei 600.000 XP totali, ogni volo riceve un incremento permanente del **+50%**.

---

## 4. Monitoraggio Real-Time della Crew (Dispatcher Mode)
ARIA funge da supervisore per l'intero network, monitorando gli altri piloti della compagnia.

* **Stati Dinamici della Crew**: ARIA calcola lo stato di ogni collega basandosi sulla schedule ufficiale:
    * **Scheduled**: Oltre 30 minuti alla partenza.
    * **Boarding**: Negli ultimi 30 minuti prima del decollo.
    * **En Route**: Volo attualmente in volo.
    * **Arrived**: Volo completato.
* **Rilevamento Ritardi (Delayed)**: Se l'orario attuale supera l'orario di partenza previsto e il volo non è iniziato, ARIA segnala lo stato di allerta al Chief Captain.

---

## 5. Protocolli di Comunicazione ARIA
ARIA adotta due personalità distinte a seconda del destinatario.

* **ARIA OPS (Pilota)**: Tono tecnico, sintetico e orientato alla sicurezza. Fornisce dati METAR, slot di decollo e alert manutenzione.
* **ARIA CONCIERGE (Passeggero)**: Tono accogliente (stile Nusantara), empatico e orientato al comfort. Gestisce le coincidenze e le preferenze personali degli ospiti.

---
*Documento Riservato - Velar Airlines Systems Operations Control (SOC).*