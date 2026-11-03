// Weergave van e-mail-HTML na opschonen (NFR-06): geen scripts, geen stylesheets en standaard geen
// externe afbeeldingen (trackers). Links openen in een nieuw venster.

import * as React from 'react';
import DOMPurify from 'dompurify';
import { Link, makeStyles, tokens } from '@fluentui/react-components';

const useStijl = makeStyles({
  html: {
    overflowX: 'auto',
    overflowWrap: 'anywhere',
    maxWidth: '100%',
    lineHeight: '1.4',
    '& img': { maxWidth: '100%', height: 'auto' },
    '& table': { maxWidth: '100%' },
    '& p': { margin: '0 0 8px 0' },
    '& a': { color: tokens.colorBrandForegroundLink }
  },
  geblokkeerd: { fontSize: tokens.fontSizeBase200, color: tokens.colorNeutralForeground3, marginTop: '4px' }
});

interface Resultaat {
  html: string;
  geblokkeerd: number;
}

function schoon(html: string, afbeeldingenToestaan: boolean): Resultaat {
  let geblokkeerd = 0;
  const purify = DOMPurify();
  purify.addHook('afterSanitizeAttributes', node => {
    const el = node as Element;
    if (el.tagName === 'A') {
      el.setAttribute('target', '_blank');
      el.setAttribute('rel', 'noopener noreferrer');
    }
    if (el.tagName === 'IMG') {
      const src = el.getAttribute('src') || '';
      if (/^cid:/i.test(src)) {
        // Inline bijlagen zijn niet beschikbaar buiten Outlook.
        el.removeAttribute('src');
        el.setAttribute('alt', el.getAttribute('alt') || '[afbeelding]');
      } else if (!afbeeldingenToestaan && /^https?:/i.test(src)) {
        geblokkeerd++;
        el.removeAttribute('src');
        el.removeAttribute('srcset');
      }
    }
  });
  const uit = purify.sanitize(html || '', {
    FORBID_TAGS: ['style', 'script', 'link', 'meta', 'base', 'form', 'input', 'button', 'iframe', 'object', 'embed'],
    FORBID_ATTR: ['background']
  });
  return { html: uit, geblokkeerd };
}

export function VeiligeHtml(props: { html: string; className?: string }): JSX.Element {
  const s = useStijl();
  const [afbeeldingen, setAfbeeldingen] = React.useState(false);
  const r = React.useMemo(() => schoon(props.html, afbeeldingen), [props.html, afbeeldingen]);
  return (
    <>
      <div className={s.html + (props.className ? ' ' + props.className : '')} dangerouslySetInnerHTML={{ __html: r.html }} />
      {r.geblokkeerd > 0 && (
        <div className={s.geblokkeerd}>
          {r.geblokkeerd === 1 ? 'Eén externe afbeelding' : r.geblokkeerd + ' externe afbeeldingen'} niet geladen.{' '}
          <Link onClick={() => setAfbeeldingen(true)}>Toch tonen</Link>
        </div>
      )}
    </>
  );
}

/** Schoont HTML op die de agent zelf invoert (standaardantwoorden, handtekening). */
export function schoonInvoer(html: string): string {
  return DOMPurify.sanitize(html || '', { FORBID_TAGS: ['style', 'script', 'iframe', 'form'] });
}
