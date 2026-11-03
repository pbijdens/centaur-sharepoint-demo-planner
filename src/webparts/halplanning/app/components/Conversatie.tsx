// Conversatie van een aanvraag: berichten, verplaatsen en antwoorden (FR-30 t/m FR-36, FR-41).

import * as React from 'react';
import {
  Badge,
  Button,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Dropdown,
  Field,
  Input,
  Link,
  makeStyles,
  Menu,
  MenuItem,
  MenuList,
  MenuPopover,
  MenuTrigger,
  Option,
  tokens
} from '@fluentui/react-components';
import {
  AttachRegular,
  ArrowReplyAllRegular,
  MailRegular,
  MoreVerticalRegular,
  OpenRegular,
  SendRegular,
  TextBulletListSquareRegular
} from '@fluentui/react-icons';
import { useDiensten } from '../AppContext';
import { datumTijd } from '../logic/datum';
import { allenBeantwoorden, antwoordOnderwerp, splitsCitaat } from '../logic/mail';
import { Aanvraag, Bericht, OPEN_STATUSSEN, Standaardantwoord } from '../model';
import { useBezig, useGedeeldeStijl, useMelding } from './algemeen';
import { TekstEditor, TekstEditorApi } from './TekstEditorUitgesteld';
import { schoonInvoer, VeiligeHtml } from './VeiligeHtml';

const useStijl = makeStyles({
  lijst: { display: 'flex', flexDirection: 'column', gap: '10px' },
  bericht: {
    border: '1px solid ' + tokens.colorNeutralStroke2,
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorNeutralBackground1,
    padding: '10px 12px'
  },
  uitgaand: { backgroundColor: tokens.colorNeutralBackground2, marginLeft: '16px' },
  kop: { display: 'flex', alignItems: 'flex-start', gap: '8px', marginBottom: '8px' },
  afzender: { flexGrow: 1, minWidth: 0 },
  naam: { fontWeight: tokens.fontWeightSemibold, overflowWrap: 'anywhere' },
  meta: { fontSize: tokens.fontSizeBase200, color: tokens.colorNeutralForeground3, overflowWrap: 'anywhere' },
  voet: { display: 'flex', gap: '12px', alignItems: 'center', marginTop: '8px', flexWrap: 'wrap', fontSize: tokens.fontSizeBase200 },
  citaat: { marginTop: '8px', paddingLeft: '8px', borderLeft: '3px solid ' + tokens.colorNeutralStroke2 },
  antwoord: { marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '10px' },
  handtekening: {
    padding: '8px 12px',
    border: '1px dashed ' + tokens.colorNeutralStroke2,
    borderRadius: tokens.borderRadiusMedium,
    color: tokens.colorNeutralForeground3,
    fontSize: tokens.fontSizeBase200
  }
});

function BerichtKaart(props: {
  bericht: Bericht;
  onVerplaats: (b: Bericht) => void;
  onOpenOutlook: (b: Bericht) => void;
}): JSX.Element {
  const s = useStijl();
  const b = props.bericht;
  const [citaatOpen, setCitaatOpen] = React.useState(false);
  const delen = React.useMemo(() => splitsCitaat(b.body), [b.body]);
  const uitgaand = b.richting === 'Uitgaand';

  return (
    <div className={s.bericht + (uitgaand ? ' ' + s.uitgaand : '')}>
      <div className={s.kop}>
        <div className={s.afzender}>
          <div className={s.naam}>
            {uitgaand ? 'Verzonden' + (b.verstuurdDoor ? ' door ' + b.verstuurdDoor : '') : b.vanNaam || b.vanAdres}
          </div>
          <div className={s.meta}>
            {uitgaand ? 'Aan: ' + b.aan : b.vanNaam && b.vanNaam !== b.vanAdres ? b.vanAdres : ''}
            {b.ontvangenOp ? ' · ' + datumTijd(b.ontvangenOp) : ''}
          </div>
          {b.onderwerp && <div className={s.meta}>{b.onderwerp}</div>}
        </div>
        {b.heeftBijlagen && <AttachRegular aria-label="Heeft bijlagen" title="Heeft bijlagen" />}
        {uitgaand && <Badge appearance="tint" size="small">Verzonden</Badge>}
        {!uitgaand && (
          <Menu>
            <MenuTrigger disableButtonEnhancement>
              <Button size="small" appearance="subtle" icon={<MoreVerticalRegular />} aria-label="Acties voor bericht" />
            </MenuTrigger>
            <MenuPopover>
              <MenuList>
                <MenuItem onClick={() => props.onVerplaats(b)}>Verplaatsen naar…</MenuItem>
              </MenuList>
            </MenuPopover>
          </Menu>
        )}
      </div>
      <VeiligeHtml html={delen.hoofd} />
      {delen.citaat && (
        <>
          <Link as="button" onClick={() => setCitaatOpen(!citaatOpen)}>
            {citaatOpen ? 'Geciteerde tekst verbergen' : 'Geciteerde tekst tonen'}
          </Link>
          {citaatOpen && (
            <div className={s.citaat}>
              <VeiligeHtml html={delen.citaat} />
            </div>
          )}
        </>
      )}
      <div className={s.voet}>
        {(b.internetMessageId || b.outlookLink) && (
          <Link as="button" onClick={() => props.onOpenOutlook(b)}>
            <OpenRegular /> Openen in Outlook
          </Link>
        )}
        {b.heeftBijlagen && <span>Bijlagen zijn te openen in Outlook.</span>}
      </div>
    </div>
  );
}

function VerplaatsDialoog(props: { bericht?: Bericht; huidigeId: number; onSluit: (doel?: number) => void }): JSX.Element {
  const d = useDiensten();
  const [opties, setOpties] = React.useState<Aanvraag[]>([]);
  const [keuze, setKeuze] = React.useState<string>('nieuw');
  const [bezig, voerUit] = useBezig();

  React.useEffect(() => {
    if (!props.bericht) return;
    setKeuze('nieuw');
    d.repo
      .aanvragen(OPEN_STATUSSEN)
      .then(r => setOpties(r.filter(a => a.id !== props.huidigeId)))
      .catch(() => setOpties([]));
  }, [props.bericht]);

  const verplaats = async (): Promise<void> => {
    if (!props.bericht) return;
    const doel = await voerUit(() => d.acties.verplaatsBericht(props.bericht as Bericht, keuze === 'nieuw' ? 'nieuw' : +keuze), 'Bericht verplaatst');
    if (doel !== undefined) props.onSluit(doel);
  };

  const label = (a: Aanvraag): string => (a.titel || a.naam || a.email) + (a.email ? ' (' + a.email + ')' : '');
  const gekozen = opties.filter(a => String(a.id) === keuze)[0];

  return (
    <Dialog open={!!props.bericht} onOpenChange={(_, v) => !v.open && props.onSluit()}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>Bericht verplaatsen</DialogTitle>
          <DialogContent>
            <Field label="Naar aanvraag">
              <Dropdown
                value={keuze === 'nieuw' ? 'Nieuwe aanvraag' : gekozen ? label(gekozen) : ''}
                selectedOptions={[keuze]}
                onOptionSelect={(_, v) => setKeuze(v.optionValue || 'nieuw')}
              >
                <Option value="nieuw">Nieuwe aanvraag</Option>
                {opties.map(a => (
                  <Option key={a.id} value={String(a.id)} text={label(a)}>
                    {label(a)}
                  </Option>
                ))}
              </Dropdown>
            </Field>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => props.onSluit()}>Annuleren</Button>
            <Button appearance="primary" disabled={bezig} onClick={verplaats}>
              Verplaatsen
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}

function AntwoordPaneel(props: { aanvraag: Aanvraag; laatsteInkomend?: Bericht; onVerzonden: () => void; onSluit: () => void }): JSX.Element {
  const d = useDiensten();
  const s = useStijl();
  const g = useGedeeldeStijl();
  const editor = React.useRef<TekstEditorApi>(null);
  const [tekst, setTekst] = React.useState('');
  const [standaard, setStandaard] = React.useState<Standaardantwoord[]>([]);
  const [bezig, voerUit] = useBezig();

  const begin = React.useMemo(() => {
    if (props.laatsteInkomend) {
      const o = allenBeantwoorden(props.laatsteInkomend, d.instellingen.mailboxAdres);
      return { aan: o.aan.join('; '), cc: o.cc.join('; '), onderwerp: antwoordOnderwerp(props.laatsteInkomend.onderwerp) };
    }
    return { aan: props.aanvraag.email, cc: '', onderwerp: props.aanvraag.titel };
  }, [props.laatsteInkomend, props.aanvraag]);

  const [aan, setAan] = React.useState(begin.aan);
  const [cc, setCc] = React.useState(begin.cc);
  const [onderwerp, setOnderwerp] = React.useState(begin.onderwerp);

  React.useEffect(() => {
    d.repo.standaardantwoorden().then(setStandaard).catch(() => setStandaard([]));
  }, []);

  const verstuur = async (): Promise<void> => {
    const html = editor.current ? editor.current.html() : tekst;
    if (!html || html === '<p></p>') return;
    const ok = await voerUit(async () => {
      await d.acties.verstuur(props.aanvraag, props.laatsteInkomend, {
        aan,
        cc,
        onderwerp,
        tekstHtml: html,
        handtekening: schoonInvoer(d.instellingen.handtekening)
      });
      return true;
    }, 'Verzonden');
    if (ok) props.onVerzonden();
  };

  return (
    <div className={s.antwoord}>
      <Field label="Aan">
        <Input value={aan} onChange={(_, v) => setAan(v.value)} />
      </Field>
      <Field label="Cc">
        <Input value={cc} onChange={(_, v) => setCc(v.value)} />
      </Field>
      <Field label="Onderwerp">
        <Input value={onderwerp} onChange={(_, v) => setOnderwerp(v.value)} disabled={!!props.laatsteInkomend} />
      </Field>
      <div className={g.rij}>
        <Menu>
          <MenuTrigger disableButtonEnhancement>
            <Button icon={<TextBulletListSquareRegular />} disabled={standaard.length === 0}>
              Standaardantwoord invoegen
            </Button>
          </MenuTrigger>
          <MenuPopover>
            <MenuList>
              {standaard.map(st => (
                <MenuItem key={st.id} onClick={() => editor.current && editor.current.voegIn(schoonInvoer(st.tekst))}>
                  {st.titel}
                </MenuItem>
              ))}
            </MenuList>
          </MenuPopover>
        </Menu>
      </div>
      <TekstEditor ref={editor} html="" onChange={setTekst} />
      {d.instellingen.handtekening && (
        <div className={s.handtekening} aria-label="Handtekening (wordt automatisch toegevoegd)">
          <VeiligeHtml html={d.instellingen.handtekening} />
        </div>
      )}
      <div className={g.knoppen}>
        <Button appearance="primary" icon={<SendRegular />} disabled={bezig || !tekst || tekst === '<p></p>'} onClick={verstuur}>
          {bezig ? 'Versturen…' : 'Versturen'}
        </Button>
        <Button onClick={props.onSluit} disabled={bezig}>
          Annuleren
        </Button>
      </div>
    </div>
  );
}

export function Conversatie(props: {
  aanvraag: Aanvraag;
  berichten: Bericht[];
  herlaad: () => Promise<void>;
  onVerplaatst: (doelId: number) => void;
}): JSX.Element {
  const d = useDiensten();
  const g = useGedeeldeStijl();
  const s = useStijl();
  const melding = useMelding();
  const [antwoorden, setAntwoorden] = React.useState(false);
  const [verplaats, setVerplaats] = React.useState<Bericht | undefined>();
  const verrijkt = React.useRef<Record<number, boolean>>({});

  const inkomend = props.berichten.filter(b => b.richting === 'Inkomend');
  const laatsteInkomend = inkomend[inkomend.length - 1];

  // Naam van de afzender en Outlook-link aanvullen via Graph; de flow levert die niet altijd.
  React.useEffect(() => {
    const teVerrijken = props.berichten.filter(
      b => b.richting === 'Inkomend' && b.internetMessageId && !b.outlookLink && !verrijkt.current[b.id]
    );
    if (teVerrijken.length === 0) return;
    (async () => {
      let gewijzigd = false;
      for (const b of teVerrijken) {
        verrijkt.current[b.id] = true;
        try {
          const r = await d.acties.verrijkBericht(b);
          if (!r) continue;
          gewijzigd = true;
          // Een aanvraag die de flow met alleen het adres aanmaakte, krijgt alsnog de naam (FR-06).
          const a = props.aanvraag;
          if (r.vanNaam && r.vanNaam !== b.vanAdres && a.naam === b.vanAdres) {
            await d.repo.wijzigAanvraag(a.id, { naam: r.vanNaam, titel: a.titel === b.vanAdres ? r.vanNaam : a.titel });
          }
        } catch (e) {
          console.warn('Halplanning: bericht kon niet worden aangevuld.', e);
        }
      }
      if (gewijzigd) await props.herlaad();
    })().catch(() => undefined);
  }, [props.berichten]);

  const openOutlook = async (b: Bericht): Promise<void> => {
    // Venster direct openen (anders blokkeert de browser de pop-up), daarna de link invullen.
    let link = b.outlookLink;
    if (link) {
      window.open(link, '_blank', 'noopener');
      return;
    }
    const venster = window.open('', '_blank');
    try {
      const g2 = await d.graph.zoekBericht(b.internetMessageId);
      link = (g2 && g2.webLink) || '';
    } catch {
      link = '';
    }
    if (link && venster) venster.location.href = link;
    else {
      if (venster) venster.close();
      melding.fout('Het bericht is niet gevonden in de gedeelde mailbox.');
    }
  };

  return (
    <div>
      <div className={s.lijst}>
        {props.berichten.length === 0 && <div className={g.leeg}>Nog geen berichten bij deze aanvraag.</div>}
        {props.berichten.map(b => (
          <BerichtKaart key={b.id} bericht={b} onVerplaats={setVerplaats} onOpenOutlook={openOutlook} />
        ))}
      </div>

      {antwoorden ? (
        <AntwoordPaneel
          aanvraag={props.aanvraag}
          laatsteInkomend={laatsteInkomend}
          onSluit={() => setAntwoorden(false)}
          onVerzonden={() => {
            setAntwoorden(false);
            props.herlaad().catch(() => undefined);
          }}
        />
      ) : (
        <div className={g.knoppen} style={{ marginTop: 16 }}>
          <Button appearance="primary" icon={laatsteInkomend ? <ArrowReplyAllRegular /> : <MailRegular />} onClick={() => setAntwoorden(true)}>
            {laatsteInkomend ? 'Antwoorden' : 'E-mail versturen'}
          </Button>
        </div>
      )}

      <VerplaatsDialoog
        bericht={verplaats}
        huidigeId={props.aanvraag.id}
        onSluit={doel => {
          setVerplaats(undefined);
          if (doel !== undefined) props.onVerplaatst(doel);
        }}
      />
    </div>
  );
}
