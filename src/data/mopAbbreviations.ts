// Kürzelliste für M.O.P Technisches Objektmanagement
// Mappt Komponentennamen auf ihre Abkürzungen

export const MOP_ABBREVIATIONS: Record<string, string> = {
  "Wärmenetz": "WN",
  "Waermenetz": "WN",
  "Technikzentrale": "TZ",
  "Stromnetz": "SN",
  "BHKW": "BHKW",
  "Wärmepumpe": "WP",
  "Waermepumpe": "WP",
  "Gaskessel": "GK",
  "Ölkessel": "ÖK",
  "Oelkessel": "ÖK",
  "Pelletanlage": "PA",
  "Solarthermie": "ST",
  "Photovoltaik": "PV",
  "Pholovoltaik": "PV",
  "Biomasse": "BM",
  "Ausdehnungsgefäß": "MAG",
  "Ausdehnungsgefaess": "MAG",
  "Außdehnungsgefäß": "MAG",
  "MAG": "MAG",
  "Pumpe": "P",
  "Pufferspeicher": "PS",
  "Wechselrichter": "WR",
  "Warmwasserstation": "WW",
  "Frischwasserstation": "FriWa",
  "Druckhaltestation": "DH",
  "Nachspeise": "NS",
  "Übergabestation": "ÜS",
  "Uebergabestation": "ÜS",
  "Verträge": "V",
  "Vertraege": "V",
  "Wartungsverträge": "WV",
  "Wartungsvertraege": "WV",
};

/**
 * Findet die beste Abkürzung für einen Komponentennamen.
 * Sucht zuerst exakt, dann case-insensitive, dann Teilstring-Match.
 */
export function findAbbreviation(componentName: string): string {
  // Exakter Match
  if (MOP_ABBREVIATIONS[componentName]) {
    return MOP_ABBREVIATIONS[componentName];
  }

  // Case-insensitive Match
  const lowerName = componentName.toLowerCase();
  for (const [key, value] of Object.entries(MOP_ABBREVIATIONS)) {
    if (key.toLowerCase() === lowerName) {
      return value;
    }
  }

  // Teilstring-Match (längster Key zuerst)
  const sortedKeys = Object.keys(MOP_ABBREVIATIONS).sort((a, b) => b.length - a.length);
  for (const key of sortedKeys) {
    if (lowerName.includes(key.toLowerCase())) {
      return MOP_ABBREVIATIONS[key];
    }
  }

  // Fallback: Erste 3 Buchstaben uppercase
  return componentName.substring(0, 3).toUpperCase();
}
