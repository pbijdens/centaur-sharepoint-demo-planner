// Validatie van invoervelden (FR §4.5).

/** Normaliseert een IBAN: hoofdletters, zonder spaties. */
export function normaliseerIban(iban: string): string {
  return (iban || '').replace(/\s+/g, '').toUpperCase();
}

/** Controleert een IBAN met de mod-97-controle (ISO 13616). */
export function isGeldigeIban(iban: string): boolean {
  const s = normaliseerIban(iban);
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(s)) return false;
  const herschikt = s.slice(4) + s.slice(0, 4);
  let rest = 0;
  for (let i = 0; i < herschikt.length; i++) {
    const c = herschikt.charCodeAt(i);
    // Letters worden 10..35, cijfers blijven cijfers.
    const deel = c >= 65 ? String(c - 55) : herschikt[i];
    for (let j = 0; j < deel.length; j++) {
      rest = (rest * 10 + (deel.charCodeAt(j) - 48)) % 97;
    }
  }
  return rest === 1;
}

/** Groepeert per 4 tekens: "NL91 ABNA 0417 1643 00". */
export function formatteerIban(iban: string): string {
  return normaliseerIban(iban).replace(/(.{4})/g, '$1 ').trim();
}

export function isGeldigEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test((email || '').trim());
}
