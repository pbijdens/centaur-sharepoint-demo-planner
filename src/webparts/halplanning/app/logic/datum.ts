// Datumhulpfuncties. De app gaat ervan uit dat de browser in de tijdzone Europe/Amsterdam staat;
// Graph krijgt lokale tijden met tijdzone "W. Europe Standard Time".

const nl = 'nl-NL';

function tweeCijfers(n: number): string {
  return n < 10 ? '0' + n : String(n);
}

/** "2026-11-02T14:30:00", lokale wandkloktijd zonder offset (formaat van Graph dateTimeTimeZone). */
export function naarGraphDatumTijd(d: Date): string {
  return (
    d.getFullYear() + '-' + tweeCijfers(d.getMonth() + 1) + '-' + tweeCijfers(d.getDate()) +
    'T' + tweeCijfers(d.getHours()) + ':' + tweeCijfers(d.getMinutes()) + ':00'
  );
}

/** Leest een Graph dateTime ("2026-11-02T14:30:00.0000000") als lokale wandkloktijd. */
export function vanGraphDatumTijd(s: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/.exec(s);
  if (!m) return new Date(s);
  return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], m[6] ? +m[6] : 0);
}

/** "2026-11-02" voor <input type="date">. */
export function naarInvoerDatum(d: Date): string {
  return d.getFullYear() + '-' + tweeCijfers(d.getMonth() + 1) + '-' + tweeCijfers(d.getDate());
}

/** "14:30" voor <input type="time">. */
export function naarInvoerTijd(d: Date): string {
  return tweeCijfers(d.getHours()) + ':' + tweeCijfers(d.getMinutes());
}

export function vanInvoer(datum: string, tijd: string): Date | undefined {
  const dm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(datum);
  const tm = /^(\d{1,2}):(\d{2})$/.exec(tijd || '00:00');
  if (!dm || !tm) return undefined;
  return new Date(+dm[1], +dm[2] - 1, +dm[3], +tm[1], +tm[2]);
}

export function begin(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function plusDagen(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, d.getHours(), d.getMinutes());
}

export function plusMinuten(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 60000);
}

export function zelfdeDag(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** "ma 2 nov 2026" */
export function datumKort(d: Date): string {
  return d.toLocaleDateString(nl, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

/** "maandag 2 november 2026" */
export function datumLang(d: Date): string {
  return d.toLocaleDateString(nl, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

/** "02-11-2026" */
export function datumNumeriek(d: Date): string {
  return tweeCijfers(d.getDate()) + '-' + tweeCijfers(d.getMonth() + 1) + '-' + d.getFullYear();
}

export function tijd(d: Date): string {
  return naarInvoerTijd(d);
}

/** Vandaag: "14:30"; dit jaar: "2 nov"; anders "2 nov 2025". */
export function tijdstipRelatief(d: Date, nu: Date = new Date()): string {
  if (zelfdeDag(d, nu)) return tijd(d);
  if (d.getFullYear() === nu.getFullYear()) return d.toLocaleDateString(nl, { day: 'numeric', month: 'short' });
  return d.toLocaleDateString(nl, { day: 'numeric', month: 'short', year: 'numeric' });
}

export function datumTijd(d: Date): string {
  return datumKort(d) + ' ' + tijd(d);
}

/** 90 → "1:30 uur", 60 → "1 uur", 45 → "45 min" */
export function duurTekst(minuten: number): string {
  if (minuten < 60) return minuten + ' min';
  const u = Math.floor(minuten / 60);
  const m = minuten % 60;
  return m === 0 ? u + ' uur' : u + ':' + tweeCijfers(m) + ' uur';
}
