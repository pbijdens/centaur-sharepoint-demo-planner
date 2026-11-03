// Beheer van stamgegevens via het hoofdmenu (FR-71 t/m FR-74).

import * as React from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Field,
  Input,
  makeStyles,
  Switch,
  tokens
} from '@fluentui/react-components';
import { AddRegular, ArrowLeftRegular, DeleteRegular, EditRegular, SaveRegular } from '@fluentui/react-icons';
import { useDiensten } from '../AppContext';
import { Begeleider, DemoType, Standaardantwoord } from '../model';
import { Fout, Laden, useBevestig, useBezig, useGedeeldeStijl } from './algemeen';
import { TekstEditor } from './TekstEditorUitgesteld';
import { schoonInvoer, VeiligeHtml } from './VeiligeHtml';

const useStijl = makeStyles({
  titel: { fontSize: tokens.fontSizeBase500, fontWeight: tokens.fontWeightSemibold },
  lijst: { display: 'flex', flexDirection: 'column', gap: '6px' },
  rij: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 8px 8px 12px',
    border: '1px solid ' + tokens.colorNeutralStroke2,
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorNeutralBackground1
  },
  inactief: { color: tokens.colorNeutralForeground4, textDecoration: 'line-through' },
  sub: { fontSize: tokens.fontSizeBase200, color: tokens.colorNeutralForeground3 },
  voorbeeld: { maxHeight: '3.6em', overflow: 'hidden', fontSize: tokens.fontSizeBase200, color: tokens.colorNeutralForeground3 }
});

function Kop(props: { titel: string; terug: () => void; nieuw?: () => void }): JSX.Element {
  const s = useStijl();
  const g = useGedeeldeStijl();
  return (
    <div className={g.kop}>
      <Button appearance="subtle" icon={<ArrowLeftRegular />} onClick={props.terug} aria-label="Terug" />
      <div className={g.groei + ' ' + s.titel}>{props.titel}</div>
      {props.nieuw && (
        <Button appearance="primary" icon={<AddRegular />} onClick={props.nieuw}>
          Toevoegen
        </Button>
      )}
    </div>
  );
}

/** Laadt een lijst en biedt herladen; gedeeld door de beheerschermen. */
function useLijst<T>(laadFn: () => Promise<T[]>): [T[] | undefined, unknown, () => Promise<void>] {
  const [items, setItems] = React.useState<T[] | undefined>();
  const [fout, setFout] = React.useState<unknown>();
  const laad = React.useCallback(async () => {
    try {
      setItems(await laadFn());
    } catch (e) {
      setFout(e);
    }
  }, []);
  React.useEffect(() => {
    laad().catch(() => undefined);
  }, [laad]);
  return [items, fout, laad];
}

function BewerkDialoog(props: { titel: string; open: boolean; geldig: boolean; bezig: boolean; onBewaar: () => void; onSluit: () => void; children: React.ReactNode; breed?: boolean }): JSX.Element {
  const g = useGedeeldeStijl();
  return (
    <Dialog open={props.open} onOpenChange={(_, v) => !v.open && props.onSluit()}>
      <DialogSurface style={props.breed ? { maxWidth: 760 } : undefined}>
        <DialogBody>
          <DialogTitle>{props.titel}</DialogTitle>
          <DialogContent>
            <div className={g.formulier}>{props.children}</div>
          </DialogContent>
          <DialogActions>
            <Button onClick={props.onSluit} disabled={props.bezig}>
              Annuleren
            </Button>
            <Button appearance="primary" icon={<SaveRegular />} disabled={!props.geldig || props.bezig} onClick={props.onBewaar}>
              Opslaan
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}

// ---- Begeleiders (FR-72) ----

export function BeheerBegeleiders(props: { terug: () => void }): JSX.Element {
  const d = useDiensten();
  const s = useStijl();
  const g = useGedeeldeStijl();
  const [items, fout, laad] = useLijst(() => d.repo.begeleiders());
  const [bewerk, setBewerk] = React.useState<(Omit<Begeleider, 'id'> & { id?: number }) | undefined>();
  const [bezig, voerUit] = useBezig();
  const [bevestigDialoog, bevestig] = useBevestig();

  const bewaar = async (): Promise<void> => {
    if (!bewerk) return;
    const ok = await voerUit(async () => {
      await d.repo.bewaarBegeleider({ ...bewerk, naam: bewerk.naam.trim() });
      return true;
    }, 'Begeleider opgeslagen');
    if (ok) {
      setBewerk(undefined);
      await laad();
    }
  };

  const verwijder = async (b: Begeleider): Promise<void> => {
    const ok = await bevestig({
      titel: 'Begeleider verwijderen?',
      tekst: 'Is ' + b.naam + ' eerder ingezet, zet de begeleider dan liever op inactief: dan blijft de historie (en de Excel-export) kloppen.',
      knop: 'Toch verwijderen',
      gevaarlijk: true
    });
    if (!ok) return;
    await voerUit(() => d.repo.verwijderBegeleider(b.id), 'Begeleider verwijderd');
    await laad();
  };

  return (
    <div className={g.scherm}>
      {bevestigDialoog}
      <Kop titel="Begeleiders" terug={props.terug} nieuw={() => setBewerk({ naam: '', telefoon: '', email: '', actief: true })} />
      {fout ? <Fout fout={fout} /> : undefined}
      {!items && !fout && <Laden />}
      <div className={s.lijst}>
        {items && items.length === 0 && <div className={g.leeg}>Nog geen begeleiders.</div>}
        {(items || []).map(b => (
          <div key={b.id} className={s.rij}>
            <div className={g.groei}>
              <div className={b.actief ? undefined : s.inactief}>{b.naam}</div>
              <div className={s.sub}>{[b.telefoon, b.email, b.actief ? '' : 'inactief'].filter(x => !!x).join(' · ')}</div>
            </div>
            <Button appearance="subtle" icon={<EditRegular />} aria-label="Wijzigen" onClick={() => setBewerk({ ...b })} />
            <Button appearance="subtle" icon={<DeleteRegular />} aria-label="Verwijderen" onClick={() => verwijder(b)} />
          </div>
        ))}
      </div>
      <BewerkDialoog
        titel={bewerk && bewerk.id ? 'Begeleider wijzigen' : 'Begeleider toevoegen'}
        open={!!bewerk}
        geldig={!!bewerk && !!bewerk.naam.trim()}
        bezig={bezig}
        onBewaar={bewaar}
        onSluit={() => setBewerk(undefined)}
      >
        {bewerk && (
          <>
            <Field label="Naam" required>
              <Input value={bewerk.naam} onChange={(_, v) => setBewerk({ ...bewerk, naam: v.value })} />
            </Field>
            <Field label="Telefoon">
              <Input type="tel" value={bewerk.telefoon} onChange={(_, v) => setBewerk({ ...bewerk, telefoon: v.value })} />
            </Field>
            <Field label="E-mailadres">
              <Input type="email" value={bewerk.email} onChange={(_, v) => setBewerk({ ...bewerk, email: v.value })} />
            </Field>
            <Switch label="Actief" checked={bewerk.actief} onChange={(_, v) => setBewerk({ ...bewerk, actief: v.checked })} />
          </>
        )}
      </BewerkDialoog>
    </div>
  );
}

// ---- Soorten demo (FR-73) ----

export function BeheerDemoTypes(props: { terug: () => void }): JSX.Element {
  const d = useDiensten();
  const s = useStijl();
  const g = useGedeeldeStijl();
  const [items, fout, laad] = useLijst(() => d.repo.demoTypes());
  const [bewerk, setBewerk] = React.useState<(Omit<DemoType, 'id'> & { id?: number }) | undefined>();
  const [bezig, voerUit] = useBezig();
  const [bevestigDialoog, bevestig] = useBevestig();

  const volgende = (items || []).reduce((max, t) => Math.max(max, t.volgorde), 0) + 10;

  const bewaar = async (): Promise<void> => {
    if (!bewerk) return;
    const ok = await voerUit(async () => {
      await d.repo.bewaarDemoType({ ...bewerk, naam: bewerk.naam.trim() });
      return true;
    }, 'Soort demo opgeslagen');
    if (ok) {
      setBewerk(undefined);
      await laad();
    }
  };

  const verwijder = async (t: DemoType): Promise<void> => {
    const ok = await bevestig({
      titel: 'Soort demo verwijderen?',
      tekst: 'Demo’s van dit type tonen daarna "Onbekend". Zet het type liever op inactief als het al gebruikt is.',
      knop: 'Toch verwijderen',
      gevaarlijk: true
    });
    if (!ok) return;
    await voerUit(() => d.repo.verwijderDemoType(t.id), 'Soort demo verwijderd');
    await laad();
  };

  return (
    <div className={g.scherm}>
      {bevestigDialoog}
      <Kop titel="Soorten demo" terug={props.terug} nieuw={() => setBewerk({ naam: '', volgorde: volgende, actief: true })} />
      {fout ? <Fout fout={fout} /> : undefined}
      {!items && !fout && <Laden />}
      <div className={s.lijst}>
        {(items || []).map(t => (
          <div key={t.id} className={s.rij}>
            <div className={g.groei}>
              <div className={t.actief ? undefined : s.inactief}>{t.naam}</div>
              <div className={s.sub}>Volgorde {t.volgorde}{t.actief ? '' : ' · inactief'}</div>
            </div>
            <Button appearance="subtle" icon={<EditRegular />} aria-label="Wijzigen" onClick={() => setBewerk({ ...t })} />
            <Button appearance="subtle" icon={<DeleteRegular />} aria-label="Verwijderen" onClick={() => verwijder(t)} />
          </div>
        ))}
      </div>
      <BewerkDialoog
        titel={bewerk && bewerk.id ? 'Soort demo wijzigen' : 'Soort demo toevoegen'}
        open={!!bewerk}
        geldig={!!bewerk && !!bewerk.naam.trim()}
        bezig={bezig}
        onBewaar={bewaar}
        onSluit={() => setBewerk(undefined)}
      >
        {bewerk && (
          <>
            <Field label="Naam" required>
              <Input value={bewerk.naam} onChange={(_, v) => setBewerk({ ...bewerk, naam: v.value })} />
            </Field>
            <Field label="Volgorde" hint="Lager staat eerder in de keuzelijst.">
              <Input type="number" value={String(bewerk.volgorde)} onChange={(_, v) => setBewerk({ ...bewerk, volgorde: parseInt(v.value, 10) || 0 })} />
            </Field>
            <Switch label="Actief" checked={bewerk.actief} onChange={(_, v) => setBewerk({ ...bewerk, actief: v.checked })} />
          </>
        )}
      </BewerkDialoog>
    </div>
  );
}

// ---- Standaardantwoorden (FR-71) ----

export function BeheerStandaardantwoorden(props: { terug: () => void }): JSX.Element {
  const d = useDiensten();
  const s = useStijl();
  const g = useGedeeldeStijl();
  const [items, fout, laad] = useLijst(() => d.repo.standaardantwoorden());
  const [bewerk, setBewerk] = React.useState<(Omit<Standaardantwoord, 'id'> & { id?: number }) | undefined>();
  const [bezig, voerUit] = useBezig();
  const [bevestigDialoog, bevestig] = useBevestig();

  const volgende = (items || []).reduce((max, t) => Math.max(max, t.volgorde), 0) + 10;

  const bewaar = async (): Promise<void> => {
    if (!bewerk) return;
    const ok = await voerUit(async () => {
      await d.repo.bewaarStandaardantwoord({ ...bewerk, titel: bewerk.titel.trim(), tekst: schoonInvoer(bewerk.tekst) });
      return true;
    }, 'Standaardantwoord opgeslagen');
    if (ok) {
      setBewerk(undefined);
      await laad();
    }
  };

  const verwijder = async (t: Standaardantwoord): Promise<void> => {
    const ok = await bevestig({ titel: 'Standaardantwoord verwijderen?', tekst: '"' + t.titel + '" wordt verwijderd.', knop: 'Verwijderen', gevaarlijk: true });
    if (!ok) return;
    await voerUit(() => d.repo.verwijderStandaardantwoord(t.id), 'Standaardantwoord verwijderd');
    await laad();
  };

  return (
    <div className={g.scherm}>
      {bevestigDialoog}
      <Kop titel="Standaardantwoorden" terug={props.terug} nieuw={() => setBewerk({ titel: '', tekst: '', volgorde: volgende })} />
      {fout ? <Fout fout={fout} /> : undefined}
      {!items && !fout && <Laden />}
      <div className={s.lijst}>
        {items && items.length === 0 && <div className={g.leeg}>Nog geen standaardantwoorden.</div>}
        {(items || []).map(t => (
          <div key={t.id} className={s.rij}>
            <div className={g.groei}>
              <div>{t.titel}</div>
              <div className={s.voorbeeld}>
                <VeiligeHtml html={t.tekst} />
              </div>
            </div>
            <Button appearance="subtle" icon={<EditRegular />} aria-label="Wijzigen" onClick={() => setBewerk({ ...t })} />
            <Button appearance="subtle" icon={<DeleteRegular />} aria-label="Verwijderen" onClick={() => verwijder(t)} />
          </div>
        ))}
      </div>
      <BewerkDialoog
        titel={bewerk && bewerk.id ? 'Standaardantwoord wijzigen' : 'Standaardantwoord toevoegen'}
        open={!!bewerk}
        geldig={!!bewerk && !!bewerk.titel.trim()}
        bezig={bezig}
        onBewaar={bewaar}
        onSluit={() => setBewerk(undefined)}
        breed
      >
        {bewerk && (
          <>
            <Field label="Titel" required>
              <Input value={bewerk.titel} onChange={(_, v) => setBewerk({ ...bewerk, titel: v.value })} />
            </Field>
            <Field label="Volgorde">
              <Input type="number" value={String(bewerk.volgorde)} onChange={(_, v) => setBewerk({ ...bewerk, volgorde: parseInt(v.value, 10) || 0 })} />
            </Field>
            <Field label="Tekst">
              <TekstEditor html={bewerk.tekst} onChange={html => setBewerk(b => (b ? { ...b, tekst: html } : b))} />
            </Field>
          </>
        )}
      </BewerkDialoog>
    </div>
  );
}

// ---- Handtekening (FR-74) ----

export function HandtekeningScherm(props: { terug: () => void }): JSX.Element {
  const d = useDiensten();
  const g = useGedeeldeStijl();
  const [html, setHtml] = React.useState(d.instellingen.handtekening);
  const [bezig, voerUit] = useBezig();

  const bewaar = async (): Promise<void> => {
    await voerUit(async () => {
      await d.repo.zetInstelling('Handtekening', schoonInvoer(html));
      await d.herlaadInstellingen();
    }, 'Handtekening opgeslagen');
  };

  return (
    <div className={g.scherm}>
      <Kop titel="Handtekening" terug={props.terug} />
      <div className={g.formulier}>
        <p className={g.gedempt}>Deze handtekening wordt automatisch onder elke e-mail gezet die vanuit de app wordt verstuurd.</p>
        <TekstEditor html={d.instellingen.handtekening} onChange={setHtml} />
        <div>
          <Button appearance="primary" icon={<SaveRegular />} disabled={bezig || html === d.instellingen.handtekening} onClick={bewaar}>
            Opslaan
          </Button>
        </div>
      </div>
    </div>
  );
}
