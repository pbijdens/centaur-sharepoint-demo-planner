// E-mailhulpfuncties: adressen, allen beantwoorden (FR-32), geciteerde tekst (FR-30).

/** Haalt e-mailadressen uit een tekst als "a@x.nl; Jan <b@y.nl>, c@z.nl". */
export function parseAdressen(tekst: string): string[] {
  if (!tekst) return [];
  const uit: string[] = [];
  for (const deel of tekst.split(/[;,\n]/)) {
    const hoek = /<([^>]+)>/.exec(deel);
    const adres = (hoek ? hoek[1] : deel).trim();
    if (adres && adres.indexOf('@') > 0) uit.push(adres);
  }
  return uniekeAdressen(uit);
}

export function uniekeAdressen(adressen: string[]): string[] {
  const gezien: Record<string, boolean> = {};
  const uit: string[] = [];
  for (const a of adressen) {
    const k = a.trim().toLowerCase();
    if (k && !gezien[k]) {
      gezien[k] = true;
      uit.push(a.trim());
    }
  }
  return uit;
}

function zonder(adressen: string[], uitsluiten: string[]): string[] {
  const weg = uitsluiten.map(a => a.toLowerCase());
  return adressen.filter(a => weg.indexOf(a.toLowerCase()) < 0);
}

export interface Ontvangers {
  aan: string[];
  cc: string[];
}

/**
 * Ontvangers voor "allen beantwoorden": Aan = afzender + oorspronkelijke Aan, Cc = oorspronkelijke Cc,
 * steeds zonder de gedeelde mailbox zelf en zonder dubbelen.
 */
export function allenBeantwoorden(
  bericht: { vanAdres: string; aan: string; cc: string },
  mailboxAdres: string
): Ontvangers {
  const aan = zonder(uniekeAdressen([bericht.vanAdres].concat(parseAdressen(bericht.aan))), [mailboxAdres]);
  const cc = zonder(parseAdressen(bericht.cc), [mailboxAdres].concat(aan));
  return { aan, cc };
}

/** Markeringen waar geciteerde eerdere berichten beginnen (Outlook, Gmail, Apple Mail, generiek). */
const CITAAT_MARKERINGEN: RegExp[] = [
  /<div[^>]+id=["']?appendonsend/i,
  /<div[^>]+id=["']?divRplyFwdMsg/i,
  /<hr[^>]+id=["']?stopSpelling/i,
  /<div[^>]+class=["']?gmail_quote/i,
  /<blockquote[^>]+type=["']?cite/i,
  /<div[^>]+class=["']?(?:moz-cite-prefix|yahoo_quoted)/i,
  /<div[^>]+style=["'][^"']*border-top:\s*solid\s+#[0-9a-f]{3,6}\s+1\.0pt[^"']*["'][^>]*>\s*<p[^>]*class=["']?MsoNormal/i
];

export interface GesplitsteBody {
  hoofd: string;
  citaat: string;
}

/** Splitst HTML in het nieuwe deel en het geciteerde deel (vanaf de eerste herkende markering). */
export function splitsCitaat(html: string): GesplitsteBody {
  if (!html) return { hoofd: '', citaat: '' };
  let eerste = -1;
  for (const re of CITAAT_MARKERINGEN) {
    const m = re.exec(html);
    if (m && (eerste < 0 || m.index < eerste)) eerste = m.index;
  }
  // Als er vóór de markering vrijwel niets staat, is splitsen zinloos.
  if (eerste < 0 || naarTekst(html.slice(0, eerste)).trim().length === 0) return { hoofd: html, citaat: '' };
  return { hoofd: html.slice(0, eerste), citaat: html.slice(eerste) };
}

/** Voegt HTML in direct na de <body>-tag van een volledig HTML-document, of ervoor als die er niet is. */
export function voegInNaBody(document: string, invoeging: string): string {
  const m = /<body[^>]*>/i.exec(document || '');
  if (!m) return invoeging + (document || '');
  const pos = m.index + m[0].length;
  return document.slice(0, pos) + invoeging + document.slice(pos);
}

/** Ruwe HTML → platte tekst (voor voorbeeldregels, niet voor weergave van de body). */
export function naarTekst(html: string): string {
  return (html || '')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|tr|h\d)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n\s*\n+/g, '\n')
    .trim();
}

export function escapeHtml(s: string): string {
  return (s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Opbouw van de HTML die verstuurd wordt: tekst van de agent + handtekening. */
export function antwoordHtml(tekstHtml: string, handtekeningHtml: string): string {
  const handtekening = handtekeningHtml ? '<div class="halplanning-handtekening">' + handtekeningHtml + '</div>' : '';
  return '<div>' + tekstHtml + handtekening + '</div>';
}

/** "Re: " voor een onderwerp als dat er nog niet staat. */
export function antwoordOnderwerp(onderwerp: string): string {
  return /^\s*(re|antw|aw)\s*:/i.test(onderwerp || '') ? onderwerp : 'Re: ' + (onderwerp || '');
}
