const fs = require('fs');
let ariaCode = fs.readFileSync('src/components/ARIAAssistant.tsx', 'utf8');

const regexToReplace = /    const prompt = `Sei ARIA, il sistema operativo di Velar Airlines\.[\s\S]+?Rispondi SOLO con JSON valido, nessun testo extra, nessun markdown:`/;

const replacementPromptString = `    const activeRoutesList = opsPlan?.hubs?.map((hub) =>
      hub.routes.map((route) => {
        const flights = route.flight.split(/[\\/-]/).map((f) => f.trim()).filter((f) => f.startsWith('VLR') || !isNaN(Number(f)));
        const baseRoute = route.flight.split(' ')[0];
        const capacity = opsPlan.fleet.find((f) => f.type.includes(route.aircraft))?.capacity || 'N/A';
        return flights.map((f) => {
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

La flotta Velar ha \${opsPlan?.fleet?.reduce((acc, f) => acc + f.count, 0) || 25} aeromobili su \${opsPlan?.hubs?.length || 3} hub.

Rotte attive oggi (con relative capacità aeromobile):
\${activeRoutesList}

Rispondi SOLO con JSON valido, nessun testo extra, nessun markdown:\``;

ariaCode = ariaCode.replace(regexToReplace, replacementPromptString);

fs.writeFileSync('src/components/ARIAAssistant.tsx', ariaCode, 'utf8');
console.log('ARIAAssistant.tsx updated');
