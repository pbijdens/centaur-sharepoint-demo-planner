// Opslaan met ETag-controle zonder onnodige conflicten (NFR-05). Een ETag verandert bij elke wijziging van een
// item, ook als alleen de flow (LaatsteBerichtOp, Onbeantwoord) of de synchronisatie (LaatsteSyncOp, event-id's)
// iets heeft bijgewerkt. Een conflict is er pas als iemand anders juist een veld heeft gewijzigd dat de
// gebruiker nu ook wijzigt.

/** Vergelijkt twee veldwaarden; leeg (undefined, null, '') telt als gelijk, datums op tijdstip. */
export function gelijkeWaarde(a: unknown, b: unknown): boolean {
  const leeg = (x: unknown): boolean => x === undefined || x === null || x === '';
  if (leeg(a) || leeg(b)) return leeg(a) && leeg(b);
  if (a instanceof Date || b instanceof Date) {
    const t = (x: unknown): number => (x instanceof Date ? x.getTime() : new Date(String(x)).getTime());
    return t(a) === t(b);
  }
  return a === b;
}

/** Alleen de velden uit `wijziging` die echt afwijken van de versie waarop de gebruiker begon. */
export function alleenGewijzigd<T extends object>(wijziging: Partial<T>, origineel: T): Partial<T> {
  const uit: Partial<T> = {};
  for (const k of Object.keys(wijziging) as (keyof T)[]) {
    if (!gelijkeWaarde(wijziging[k], origineel[k])) uit[k] = wijziging[k];
  }
  return uit;
}

/**
 * Velden uit `wijziging` die intussen door een ander zijn gewijzigd naar een andere waarde dan de gebruiker wil.
 * Leeg betekent: veilig opnieuw opslaan op de actuele versie.
 */
export function conflictVelden<T extends object>(wijziging: Partial<T>, origineel: T, actueel: T): (keyof T)[] {
  return (Object.keys(wijziging) as (keyof T)[]).filter(
    k => !gelijkeWaarde(actueel[k], origineel[k]) && !gelijkeWaarde(actueel[k], wijziging[k])
  );
}
