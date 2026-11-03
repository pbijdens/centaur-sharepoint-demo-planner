// Detailweergave van een aanvraag (FR-30 e.v.).

import * as React from 'react';
import {
  Button,
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
  MoreVerticalRegular,
  ArrowUndoRegular
} from '@fluentui/react-icons';
import { useDiensten } from '../AppContext';
import { Aanvraag, Begeleider, Bericht, Demo, DemoType, Inzet, Status, STATUSSEN } from '../model';
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

export function AanvraagDetail(props: { id: number; terug: () => void }): JSX.Element {
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
