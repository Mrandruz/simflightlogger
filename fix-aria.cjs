const fs = require('fs');
let ariaCode = fs.readFileSync('src/components/ARIAAssistant.tsx', 'utf8');

// 1. Fix Typo in system prompt
ariaCode = ariaCode.replace('"connectionPax": <numero realisti>', '"connectionPax": <numero realistico>');

// 2. Fix Static routes list in generateOverview
const originalPromptString = `    const prompt = \`Sei ARIA, il sistema operativo di Velar Airlines.
Genera un report operativo JSON per il Chief Officer \${pilotName || 'Comandante'} con dati realistici per OGGI.

La flotta Velar ha 25 aeromobili su 3 hub: LIRF (Global Hub), WIII (Asian Gateway), KBOS (Tech Corridor).

Rotte attive oggi (con relative capacità aeromobile):
- VLR101 LIRF→KBOS (A350-900, cap 369 pax)
- VLR102 KBOS→LIRF (A350-900, cap 369 pax)
- VLR201 LIRF→WIII (A350-900, cap 369 pax)
- VLR202 WIII→LIRF (A350-900, cap 369 pax)
- VLR111 LIRF→KJFK (A330neo, cap 287 pax)
- VLR211 LIRF→OMDB (A321LR, cap 182 pax)
- VLR311 LIML→LIRF (A320, cap 180 pax)
- VLR411 EGLL→LIRF (A320, cap 180 pax)
- VLR511 LFPG→LIRF (A320, cap 180 pax)
- VLR811 WIII→YSSY (A330neo, cap 287 pax)
- VLR831 WIII→RJTT (A321LR, cap 182 pax)
- VLR911 KBOS→KSFO (A321LR, cap 182 pax)
- VLR941 KBOS→EGLL (A330neo, cap 287 pax)

Rispondi SOLO con JSON valido, nessun testo extra, nessun markdown:\`;`;


const replacementPromptString = `    const activeRoutesList = opsPlan?.hubs?.map((hub: VelarHub) =>
      hub.routes.map((route: VelarRoute) => {
        const flights = route.flight.split(/[/-]/).map(f => f.trim()).filter(f => f.startsWith('VLR') || !isNaN(Number(f)));
        const baseRoute = route.flight.split(' ')[0];
        const capacity = opsPlan.fleet.find((f: VelarFleetItem) => f.type.includes(route.aircraft))?.capacity || 'N/A';
        return flights.map(f => {
          let fullFlight = f.startsWith('VLR') ? f : \`\${baseRoute}\${f}\`;
          if (route.flight.includes('-')) {
              const parts = route.flight.split('-');
              const start = parseInt(parts[0].replace(/[^0-9]/g, ''));
              const end = parseInt(parts[1].replace(/[^0-9]/g, ''));
              let lines = [];
              for (let i = start; i <= end; i++) {
                   lines.push(\`- VLR\${i} \${hub.icao}→\${route.dest} (\${route.aircraft}, cap \${capacity} pax)\`);
              }
              return lines.join('\\n');
          } else {
               let fn = fullFlight.replace(' ', '');
               return \`- \${fn} \${hub.icao}→\${route.dest} (\${route.aircraft}, cap \${capacity} pax)\`;
          }
        }).join('\\n');
      }).join('\\n')
    ).join('\\n') || 'Nessuna rotta attiva';

    const prompt = \`Sei ARIA, il sistema operativo di Velar Airlines.
Genera un report operativo JSON per il Chief Officer \${pilotName || 'Comandante'} con dati realistici per OGGI.

La flotta Velar ha \${opsPlan?.fleet?.reduce((acc: number, f: VelarFleetItem) => acc + f.count, 0) || 25} aeromobili su \${opsPlan?.hubs?.length || 3} hub.

Rotte attive oggi (con relative capacità aeromobile):
\${activeRoutesList}

Rispondi SOLO con JSON valido, nessun testo extra, nessun markdown:\`;`;

ariaCode = ariaCode.replace(originalPromptString, replacementPromptString);

fs.writeFileSync('src/components/ARIAAssistant.tsx', ariaCode, 'utf8');
console.log('ARIAAssistant.tsx updated');
