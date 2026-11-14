// Logboek van foutmeldingen (NFR-09): wat er bij een getoonde fout wordt vastgelegd, hoe lang en hoe vaak.

/** Foutmeldingen ouder dan dit aantal dagen worden verwijderd zodra er een nieuwe bijkomt. */
export const FOUT_BEWAARDAGEN = 28;

export function bewaarGrens(nu: Date): Date {
  return new Date(nu.getTime() - FOUT_BEWAARDAGEN * 24 * 60 * 60 * 1000);
}

export interface FoutDetails {
  status?: number;
  /** Adres van het mislukte verzoek, als de fout dat meegeeft. */
  verzoek: string;
  /** Technische beschrijving: soort fout, bericht, code, request-id en stack. */
  details: string;
}

/** Haalt de technische details uit een fout van PnPjs, Microsoft Graph of JavaScript. */
export function foutDetails(e: unknown): FoutDetails {
  if (typeof e === 'string') return { verzoek: '', details: e };
  const f = (e || {}) as {
    name?: string;
    message?: string;
    status?: number;
    statusCode?: number;
    code?: string;
    requestId?: string;
    body?: unknown;
    stack?: string;
    response?: { status?: number; url?: string };
  };
  const status = f.status ?? f.statusCode ?? (f.response && f.response.status);
  const regels: string[] = [];
  if (f.name) regels.push('Soort: ' + f.name);
  if (status !== undefined) regels.push('HTTP-status: ' + status);
  if (f.code) regels.push('Code: ' + f.code);
  if (f.requestId) regels.push('Request-id: ' + f.requestId);
  if (f.message) regels.push('Bericht: ' + f.message);
  if (f.body !== undefined && f.body !== null) {
    const body = typeof f.body === 'string' ? f.body : JSON.stringify(f.body);
    if (body && body !== '{}' && (!f.message || f.message.indexOf(body) < 0)) regels.push('Antwoord: ' + body);
  }
  if (f.stack) regels.push('', f.stack);
  if (regels.length === 0) {
    try {
      regels.push(JSON.stringify(e));
    } catch {
      regels.push(String(e));
    }
  }
  return {
    status: typeof status === 'number' ? status : undefined,
    verzoek: (f.response && f.response.url) || '',
    details: regels.join('\n')
  };
}

/**
 * Voorkomt een stortvloed aan regels: dezelfde melding hooguit eens per `herhaalMs`, en in totaal hooguit
 * `maxPerMinuut` regels per minuut.
 */
export class FoutBegrenzer {
  private readonly laatst: Record<string, number> = {};
  private recent: number[] = [];

  constructor(private readonly herhaalMs: number = 10000, private readonly maxPerMinuut: number = 20) {}

  mag(sleutel: string, nu: number): boolean {
    const vorige = this.laatst[sleutel];
    if (vorige !== undefined && nu - vorige < this.herhaalMs) return false;
    this.recent = this.recent.filter(t => nu - t < 60000);
    if (this.recent.length >= this.maxPerMinuut) return false;
    this.laatst[sleutel] = nu;
    this.recent.push(nu);
    return true;
  }
}
