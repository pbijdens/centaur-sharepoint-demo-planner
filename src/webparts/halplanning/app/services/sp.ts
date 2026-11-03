import { WebPartContext } from '@microsoft/sp-webpart-base';
import { spfi, SPFI, SPFx } from '@pnp/sp';
import '@pnp/sp/webs';
import '@pnp/sp/lists';
import '@pnp/sp/items';
import '@pnp/sp/fields';
import '@pnp/sp/security';

/** PnPjs-instantie voor de site waarin de app draait (B7): teamsite in Teams of de SharePoint-site zelf. */
export function maakSp(context: WebPartContext): SPFI {
  return spfi().using(SPFx(context));
}

/** Haalt de HTTP-status uit een fout van PnPjs of Graph. */
export function foutStatus(e: unknown): number | undefined {
  const f = e as { status?: number; statusCode?: number; response?: { status?: number } };
  return f?.status ?? f?.statusCode ?? f?.response?.status;
}

/** Leesbare foutmelding in het Nederlands. */
export function foutTekst(e: unknown): string {
  const status = foutStatus(e);
  if (status === 412) return 'Dit item is intussen door iemand anders gewijzigd. Vernieuw en probeer het opnieuw.';
  if (status === 403 || status === 401) return 'Je hebt geen toegang voor deze actie. Controleer je rechten (zie docs/rechten-toekennen.md).';
  if (status === 404) return 'Het item bestaat niet (meer).';
  const bericht = (e as { message?: string })?.message;
  return bericht ? 'Er ging iets mis: ' + bericht : 'Er ging iets mis.';
}
