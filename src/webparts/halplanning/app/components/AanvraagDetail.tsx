// Detailweergave van een aanvraag (FR-30 e.v.).

import * as React from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  makeStyles,
  Menu,
  MenuDivider,
  MenuItem,
  MenuList,
  MenuPopover,
  MenuTrigger,
  MessageBar,
  MessageBarActions,
  MessageBarBody,
  Tab,
  TabList,
  tokens
} from '@fluentui/react-components';
import {
  ArrowLeftRegular,
  ChevronDownRegular,
  CheckmarkCircleRegular,
  DeleteRegular,
  DeleteDismissRegular,
  MailUnreadRegular,
  MergeRegular,
  MoreVerticalRegular,
  ArrowUndoRegular
} from '@fluentui/react-icons';
import { useDiensten } from '../AppContext';
import { Aanvraag, Begeleider, Bericht, Demo, DemoType, Inzet, Status, STATUSSEN } from '../model';
import { AanvraagKiezer } from './AanvraagKiezer';
import { Fout, Laden, StatusBadge, useBevestig, useBezig, useGedeeldeStijl } from './algemeen';
import { Conversatie } from './Conversatie';
import { Dagweergave } from './Dagweergave';
import { Demos } from './Demos';
import { KlantGegevens } from './KlantGegevens';
import { Geschiedenis, Notities } from './Notities';

type TabNaam = 'conversatie' | 'gegevens' | 'demos' | 'agenda' | 'notities' | 'geschiedenis';

const useStijl = makeStyles({
  titel: {
    fontSize: tokens.fontSizeBase500,
    fontWeight: tokens.fontWeightSemibold,
    overflowWrap: 'anywhere'
  },
  sub: { color: tokens.colorNeutralForeground3, fontSize: tokens.fontSizeBase200 },
  tabs: { overflowX: 'auto', marginBottom: '12px', borderBottom: '1px solid ' + tokens.colorNeutralStroke2 }
});

interface Gegevens {
  aanvraag: Aanvraag;
  berichten: Bericht[];
  demos: Demo[];
  inzet: Inzet[];
  begeleiders: Begeleider[];
  demoTypes: DemoType[];
}

/** Kiest de aanvraag waarin deze aanvraag opgaat en voert het samenvoegen uit (FR-44, UC-19). */
function SamenvoegDialoog(props: {
  open: boolean;
  bron: Aanvraag;
  aantalBerichten: number;
  aantalDemos: number;
  onVoortgang: (m: string) => void;
  onSluit: (doelId?: number) => void;
}): JSX.Element {
  const d = useDiensten();
  const [keuze, setKeuze] = React.useState<Aanvraag | undefined>();
  const [bezig, voerUit] = useBezig();

  const bronTitel = props.bron.titel || props.bron.naam || props.bron.email;

  const voegSamen = async (): Promise<void> => {
    if (!keuze) return;
    const ok = await voerUit(async () => {
      await d.acties.voegSamen(props.bron, keuze.id, props.onVoortgang);
      return true;
    }, 'Aanvragen samengevoegd');
    props.onVoortgang('');
    if (ok) props.onSluit(keuze.id);
  };

  return (
    <Dialog open={props.open} onOpenChange={(_, v) => !v.open && !bezig && props.onSluit()}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>Samenvoegen met andere aanvraag</DialogTitle>
          <DialogContent>
            <AanvraagKiezer
              actief={props.open}
              label="Aanvraag waarin deze aanvraag opgaat"
              zonderId={props.bron.id}
              keuze={keuze}
              onKeuze={setKeuze}
              disabled={bezig}
            />
            <p>
              “{bronTitel}” gaat op in de gekozen aanvraag. {props.aantalBerichten} bericht(en), {props.aantalDemos} demo(’s) met begeleiders en
              agenda-afspraken, notities en geschiedenis gaan mee. Lege klantgegevens worden aangevuld; afwijkende gegevens komen in een
              notitie. De status van de gekozen aanvraag blijft gelijk. Daarna wordt “{bronTitel}” verwijderd.
            </p>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => props.onSluit()} disabled={bezig}>
              Annuleren
            </Button>
            <Button appearance="primary" icon={<MergeRegular />} disabled={!keuze || bezig} onClick={voegSamen}>
              {bezig ? 'Bezig…' : 'Samenvoegen'}
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}

export function AanvraagDetail(props: { id: number; terug: () => void; open: (id: number) => void }): JSX.Element {
  const d = useDiensten();
  const s = useStijl();
  const g = useGedeeldeStijl();
  const [gegevens, setGegevens] = React.useState<Gegevens | undefined>();
  const [fout, setFout] = React.useState<unknown>();
  const [tab, setTab] = React.useState<TabNaam>('conversatie');
  const [planStart, setPlanStart] = React.useState<Date | undefined>();
  const [voorstel, setVoorstel] = React.useState<{ status: Status; reden: string } | undefined>();
  const [bezig, voerUit] = useBezig();
  const [bevestigDialoog, bevestig] = useBevestig();
  const [voortgang, setVoortgang] = React.useState('');
  const [samenvoegen, setSamenvoegen] = React.useState(false);

  const laad = React.useCallback(async () => {
    try {
      const [aanvraag, berichten, demos, begeleiders, demoTypes] = await Promise.all([
        d.repo.aanvraag(props.id),
        d.repo.berichten(props.id),
        d.repo.demos(props.id),
        d.repo.begeleiders(),
        d.repo.demoTypes()
      ]);
      const inzet = demos.length ? await d.repo.inzetVoorDemos(demos.map(x => x.id)) : [];
      setGegevens({ aanvraag, berichten, demos, inzet, begeleiders, demoTypes });
      setFout(undefined);
    } catch (e) {
      setFout(e);
    }
  }, [props.id]);

  React.useEffect(() => {
    setGegevens(undefined);
    setTab('conversatie');
    setVoorstel(undefined);
    laad().catch(() => undefined);
  }, [laad]);

  if (fout) {
    return (
      <div className={g.scherm}>
        <Button icon={<ArrowLeftRegular />} onClick={props.terug}>
          Terug
        </Button>
        <Fout fout={fout} />
      </div>
    );
  }
  if (!gegevens) return <Laden />;

  const a = gegevens.aanvraag;

  const wijzigStatus = async (naar: Status): Promise<void> => {
    if (naar === 'Verwijderd') {
      const ok = await bevestig({
        titel: 'Aanvraag verwijderen?',
        tekst: 'De aanvraag gaat naar "Verwijderd" en de agenda-afspraken van alle demo’s worden verwijderd. Je kunt de aanvraag later terugzetten en de afspraken opnieuw aanmaken.',
        knop: 'Verwijderen',
        gevaarlijk: true
      });
      if (!ok) return;
    }
    await voerUit(() => d.acties.wijzigStatus(a, naar), 'Status gewijzigd naar ' + naar);
    setVoorstel(undefined);
    await laad();
  };

  const markeer = async (verwerkt: boolean): Promise<void> => {
    await voerUit(() => d.acties.markeerVerwerkt(a, verwerkt), verwerkt ? 'Gemarkeerd als verwerkt' : 'Gemarkeerd als onbeantwoord');
    await laad();
  };

  const verwijderDefinitief = async (): Promise<void> => {
    const ok = await bevestig({
      titel: 'Definitief verwijderen?',
      tekst: (
        <>
          <p>Dit verwijdert de aanvraag met alles wat erbij hoort:</p>
          <ul>
            <li>{gegevens.berichten.length} bericht(en) (de e-mails in de mailbox blijven bestaan)</li>
            <li>{gegevens.demos.length} demo(’s) met begeleiders en agenda-afspraken</li>
            <li>notities en geschiedenis</li>
          </ul>
          <p>Dit kan niet ongedaan worden gemaakt in de app. Een sitebeheerder kan items nog uit de prullenbak van de site halen.</p>
        </>
      ),
      knop: 'Definitief verwijderen',
      gevaarlijk: true
    });
    if (!ok) return;
    const gelukt = await voerUit(async () => {
      await d.acties.verwijderDefinitief(a, setVoortgang);
      return true;
    }, 'Aanvraag definitief verwijderd');
    setVoortgang('');
    if (gelukt) props.terug();
  };

  return (
    <div className={g.scherm}>
      {bevestigDialoog}
      <div className={g.kop}>
        <Button appearance="subtle" icon={<ArrowLeftRegular />} onClick={props.terug} aria-label="Terug naar overzicht" />
        <div className={g.groei}>
          <div className={s.titel}>{a.titel || a.naam || a.email}</div>
          <div className={s.sub}>{[a.naam !== a.titel ? a.naam : '', a.organisatie, a.email].filter(x => !!x).join(' · ')}</div>
        </div>
        <Menu>
          <MenuTrigger disableButtonEnhancement>
            <Button appearance="subtle" iconPosition="after" icon={<ChevronDownRegular />} disabled={bezig} aria-label="Status wijzigen">
              <StatusBadge status={a.status} />
            </Button>
          </MenuTrigger>
          <MenuPopover>
            <MenuList>
              {STATUSSEN.filter(st => st !== a.status).map(st => (
                <MenuItem key={st} onClick={() => wijzigStatus(st)}>
                  {st}
                </MenuItem>
              ))}
            </MenuList>
          </MenuPopover>
        </Menu>
        <Menu>
          <MenuTrigger disableButtonEnhancement>
            <Button appearance="subtle" icon={<MoreVerticalRegular />} aria-label="Meer acties" disabled={bezig} />
          </MenuTrigger>
          <MenuPopover>
            <MenuList>
              {a.onbeantwoord ? (
                <MenuItem icon={<CheckmarkCircleRegular />} onClick={() => markeer(true)}>
                  Markeren als verwerkt
                </MenuItem>
              ) : (
                <MenuItem icon={<MailUnreadRegular />} onClick={() => markeer(false)}>
                  Markeren als onbeantwoord
                </MenuItem>
              )}
              <MenuItem icon={<MergeRegular />} onClick={() => setSamenvoegen(true)}>
                Samenvoegen met…
              </MenuItem>
              <MenuDivider />
              {a.status === 'Verwijderd' ? (
                <MenuItem icon={<ArrowUndoRegular />} onClick={() => wijzigStatus('Nieuw')}>
                  Terugzetten
                </MenuItem>
              ) : (
                <MenuItem icon={<DeleteRegular />} onClick={() => wijzigStatus('Verwijderd')}>
                  Verwijderen
                </MenuItem>
              )}
              <MenuItem icon={<DeleteDismissRegular />} onClick={verwijderDefinitief}>
                Definitief verwijderen
              </MenuItem>
            </MenuList>
          </MenuPopover>
        </Menu>
      </div>

      <SamenvoegDialoog
        open={samenvoegen}
        bron={a}
        aantalBerichten={gegevens.berichten.length}
        aantalDemos={gegevens.demos.length}
        onVoortgang={setVoortgang}
        onSluit={doelId => {
          setSamenvoegen(false);
          if (doelId !== undefined) props.open(doelId);
        }}
      />

      {voortgang && (
        <MessageBar intent="info">
          <MessageBarBody>{voortgang}</MessageBarBody>
        </MessageBar>
      )}

      {a.onbeantwoord && (
        <MessageBar intent="info" style={{ marginBottom: 8 }}>
          <MessageBarBody>Deze aanvraag is nog niet beantwoord.</MessageBarBody>
          <MessageBarActions>
            <Button size="small" onClick={() => markeer(true)} disabled={bezig}>
              Markeren als verwerkt
            </Button>
          </MessageBarActions>
        </MessageBar>
      )}

      {voorstel && (
        <MessageBar intent="success" style={{ marginBottom: 8 }}>
          <MessageBarBody>
            {voorstel.reden} Status wijzigen naar “{voorstel.status}”?
          </MessageBarBody>
          <MessageBarActions>
            <Button size="small" appearance="primary" onClick={() => wijzigStatus(voorstel.status)} disabled={bezig}>
              Ja, wijzigen
            </Button>
            <Button size="small" onClick={() => setVoorstel(undefined)}>
              Nee
            </Button>
          </MessageBarActions>
        </MessageBar>
      )}

      <div className={s.tabs}>
        <TabList selectedValue={tab} onTabSelect={(_, v) => setTab(v.value as TabNaam)} size="small">
          <Tab value="conversatie">Conversatie ({gegevens.berichten.length})</Tab>
          <Tab value="gegevens">Gegevens</Tab>
          <Tab value="demos">Demo’s ({gegevens.demos.length})</Tab>
          <Tab value="agenda">Agenda</Tab>
          <Tab value="notities">Notities</Tab>
          <Tab value="geschiedenis">Geschiedenis</Tab>
        </TabList>
      </div>

      {tab === 'conversatie' && <Conversatie aanvraag={a} berichten={gegevens.berichten} herlaad={laad} onVerplaatst={() => laad()} />}
      {tab === 'gegevens' && <KlantGegevens aanvraag={a} herlaad={laad} />}
      {tab === 'demos' && (
        <Demos
          aanvraag={a}
          demos={gegevens.demos}
          inzet={gegevens.inzet}
          begeleiders={gegevens.begeleiders}
          demoTypes={gegevens.demoTypes}
          herlaad={laad}
          planStart={planStart}
          onPlanAfgehandeld={() => setPlanStart(undefined)}
          stelStatusVoor={(status, reden) => setVoorstel({ status, reden })}
        />
      )}
      {tab === 'agenda' && (
        <Dagweergave
          demos={gegevens.demos}
          onPlan={start => {
            setPlanStart(start);
            setTab('demos');
          }}
        />
      )}
      {tab === 'notities' && <Notities aanvraagId={a.id} />}
      {tab === 'geschiedenis' && <Geschiedenis aanvraagId={a.id} />}
    </div>
  );
}
