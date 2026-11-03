// Hoofdcomponent: opstartcontroles (installatie, instellingen), navigatie en hoofdmenu (§4.8).

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
  Menu,
  MenuDivider,
  MenuItem,
  MenuList,
  MenuPopover,
  MenuTrigger,
  Toaster,
  tokens
} from '@fluentui/react-components';
import {
  AddRegular,
  DocumentTableArrowRightRegular,
  NavigationRegular,
  PeopleRegular,
  PersonQuestionMarkRegular,
  CalendarLtrRegular,
  ReceiptMoneyRegular,
  SettingsRegular,
  SignatureRegular,
  TagMultipleRegular,
  TextBulletListSquareRegular
} from '@fluentui/react-icons';
import { Basis, Diensten, DienstenContext, useDiensten } from './AppContext';
import { isGeldigEmail } from './logic/validatie';
import { LijstSleutel } from './lists';
import { Instellingen } from './model';
import { Acties } from './services/acties';
import { GraphService } from './services/graph';
import { AanvraagDetail } from './components/AanvraagDetail';
import { AanvraagLijst } from './components/AanvraagLijst';
import { Fout, Laden, TOASTER_ID, useBezig } from './components/algemeen';
import { BeheerBegeleiders, BeheerDemoTypes, BeheerStandaardantwoorden, HandtekeningScherm } from './components/Beheer';
import { InstallatieScherm, InstellingenScherm } from './components/Instellingen';
import { ExcelDialoog, LijstDialoog, maakFactuurlijst } from './components/Rapporten';

type Scherm =
  | { s: 'lijst' }
  | { s: 'aanvraag'; id: number }
  | { s: 'begeleiders' }
  | { s: 'demotypes' }
  | { s: 'standaardantwoorden' }
  | { s: 'handtekening' }
  | { s: 'instellingen' };

const useStijl = makeStyles({
  app: {
    minHeight: '100%',
    backgroundColor: tokens.colorNeutralBackground2,
    color: tokens.colorNeutralForeground1,
    fontFamily: tokens.fontFamilyBase
  },
  balk: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '6px 8px',
    backgroundColor: tokens.colorNeutralBackground1,
    borderBottom: '1px solid ' + tokens.colorNeutralStroke2,
    position: 'sticky',
    top: 0,
    zIndex: 10
  },
  naam: { fontSize: tokens.fontSizeBase400, fontWeight: tokens.fontWeightSemibold, cursor: 'pointer' }
});

function NieuweAanvraagDialoog(props: { open: boolean; onSluit: (id?: number) => void }): JSX.Element {
  const d = useDiensten();
  const [naam, setNaam] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [organisatie, setOrganisatie] = React.useState('');
  const [telefoon, setTelefoon] = React.useState('');
  const [bezig, voerUit] = useBezig();

  React.useEffect(() => {
    if (props.open) {
      setNaam('');
      setEmail('');
      setOrganisatie('');
      setTelefoon('');
    }
  }, [props.open]);

  const emailFout = email && !isGeldigEmail(email) ? 'Dit lijkt geen geldig e-mailadres.' : undefined;

  const maak = async (): Promise<void> => {
    const id = await voerUit(
      () =>
        d.repo.maakAanvraag({
          titel: naam.trim(),
          naam: naam.trim(),
          email: email.trim(),
          organisatie: organisatie.trim(),
          telefoon: telefoon.trim(),
          status: 'Nieuw',
          onbeantwoord: false,
          bron: 'Handmatig',
          laatsteBerichtOp: new Date()
        }),
      'Aanvraag aangemaakt'
    );
    if (id !== undefined) props.onSluit(id);
  };

  return (
    <Dialog open={props.open} onOpenChange={(_, v) => !v.open && props.onSluit()}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>Nieuwe aanvraag</DialogTitle>
          <DialogContent>
            <Field label="Naam" required>
              <Input value={naam} onChange={(_, v) => setNaam(v.value)} />
            </Field>
            <Field label="E-mailadres" validationMessage={emailFout}>
              <Input type="email" value={email} onChange={(_, v) => setEmail(v.value)} />
            </Field>
            <Field label="Organisatie">
              <Input value={organisatie} onChange={(_, v) => setOrganisatie(v.value)} />
            </Field>
            <Field label="Telefoonnummer">
              <Input type="tel" value={telefoon} onChange={(_, v) => setTelefoon(v.value)} />
            </Field>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => props.onSluit()} disabled={bezig}>
              Annuleren
            </Button>
            <Button appearance="primary" disabled={!naam.trim() || !!emailFout || bezig} onClick={maak}>
              Aanmaken
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}

function Hoofdscherm(): JSX.Element {
  const d = useDiensten();
  const s = useStijl();
  const [scherm, setScherm] = React.useState<Scherm>({ s: 'lijst' });
  const [nieuw, setNieuw] = React.useState(false);
  const [excel, setExcel] = React.useState(false);
  const [lijst, setLijst] = React.useState<'hulp' | 'komend' | undefined>();
  const [bezig, voerUit] = useBezig();
  const naarLijst = (): void => setScherm({ s: 'lijst' });

  return (
    <>
      <div className={s.balk}>
        <Menu>
          <MenuTrigger disableButtonEnhancement>
            <Button appearance="subtle" icon={<NavigationRegular />} aria-label="Menu" />
          </MenuTrigger>
          <MenuPopover>
            <MenuList>
              <MenuItem icon={<AddRegular />} onClick={() => setNieuw(true)}>
                Nieuwe aanvraag
              </MenuItem>
              <MenuDivider />
              <MenuItem icon={<TextBulletListSquareRegular />} onClick={() => setScherm({ s: 'standaardantwoorden' })}>
                Standaardantwoorden
              </MenuItem>
              <MenuItem icon={<PeopleRegular />} onClick={() => setScherm({ s: 'begeleiders' })}>
                Begeleiders
              </MenuItem>
              <MenuItem icon={<TagMultipleRegular />} onClick={() => setScherm({ s: 'demotypes' })}>
                Soorten demo
              </MenuItem>
              <MenuItem icon={<SignatureRegular />} onClick={() => setScherm({ s: 'handtekening' })}>
                Handtekening
              </MenuItem>
              <MenuDivider />
              <MenuItem icon={<DocumentTableArrowRightRegular />} onClick={() => setExcel(true)}>
                Excel-export
              </MenuItem>
              <MenuItem icon={<PersonQuestionMarkRegular />} onClick={() => setLijst('hulp')}>
                Hulp gezocht
              </MenuItem>
              <MenuItem icon={<CalendarLtrRegular />} onClick={() => setLijst('komend')}>
                Komende demo’s
              </MenuItem>
              <MenuItem icon={<ReceiptMoneyRegular />} disabled={bezig} onClick={() => voerUit(() => maakFactuurlijst(d), 'Factuurlijst gemaakt')}>
                Factuurlijst
              </MenuItem>
              <MenuDivider />
              <MenuItem icon={<SettingsRegular />} onClick={() => setScherm({ s: 'instellingen' })}>
                Instellingen
              </MenuItem>
            </MenuList>
          </MenuPopover>
        </Menu>
        <span className={s.naam} onClick={naarLijst} role="link">
          Halplanning
        </span>
      </div>

      {scherm.s === 'lijst' && <AanvraagLijst open={id => setScherm({ s: 'aanvraag', id })} />}
      {scherm.s === 'aanvraag' && <AanvraagDetail id={scherm.id} terug={naarLijst} />}
      {scherm.s === 'begeleiders' && <BeheerBegeleiders terug={naarLijst} />}
      {scherm.s === 'demotypes' && <BeheerDemoTypes terug={naarLijst} />}
      {scherm.s === 'standaardantwoorden' && <BeheerStandaardantwoorden terug={naarLijst} />}
      {scherm.s === 'handtekening' && <HandtekeningScherm terug={naarLijst} />}
      {scherm.s === 'instellingen' && <InstellingenScherm basis={d} instellingen={d.instellingen} onOpgeslagen={d.herlaadInstellingen} terug={naarLijst} />}

      <NieuweAanvraagDialoog
        open={nieuw}
        onSluit={id => {
          setNieuw(false);
          if (id !== undefined) setScherm({ s: 'aanvraag', id });
        }}
      />
      <ExcelDialoog open={excel} onSluit={() => setExcel(false)} />
      <LijstDialoog soort={lijst} onSluit={() => setLijst(undefined)} />
    </>
  );
}

type Opstart =
  | { fase: 'laden' }
  | { fase: 'fout'; fout: unknown }
  | { fase: 'installeren'; ontbrekend: LijstSleutel[] }
  | { fase: 'instellen'; instellingen: Instellingen }
  | { fase: 'klaar'; instellingen: Instellingen };

export function App(props: { basis: Basis }): JSX.Element {
  const s = useStijl();
  const { basis } = props;
  const [opstart, setOpstart] = React.useState<Opstart>({ fase: 'laden' });

  const start = React.useCallback(async () => {
    try {
      const ontbrekend = await basis.installatie.onvolledigeLijsten();
      if (ontbrekend.length) {
        setOpstart({ fase: 'installeren', ontbrekend });
        return;
      }
      const instellingen = await basis.repo.instellingen();
      setOpstart(instellingen.mailboxAdres && instellingen.agendaId ? { fase: 'klaar', instellingen } : { fase: 'instellen', instellingen });
    } catch (e) {
      setOpstart({ fase: 'fout', fout: e });
    }
  }, [basis]);

  React.useEffect(() => {
    start().catch(() => undefined);
  }, [start]);

  const diensten = React.useMemo<Diensten | undefined>(() => {
    if (opstart.fase !== 'klaar') return undefined;
    const graph = new GraphService(basis.graphClient, opstart.instellingen.mailboxAdres, opstart.instellingen.agendaId);
    return {
      ...basis,
      graph,
      acties: new Acties(basis.repo, graph, basis.gebruiker.naam),
      instellingen: opstart.instellingen,
      herlaadInstellingen: start
    };
  }, [opstart, basis]);

  return (
    <div className={s.app}>
      <Toaster toasterId={TOASTER_ID} position="bottom" />
      {opstart.fase === 'laden' && <Laden tekst="Halplanning starten…" />}
      {opstart.fase === 'fout' && (
        <div style={{ padding: 16 }}>
          <Fout fout={opstart.fout} />
          <Button style={{ marginTop: 12 }} onClick={() => start()}>
            Opnieuw proberen
          </Button>
        </div>
      )}
      {opstart.fase === 'installeren' && <InstallatieScherm basis={basis} ontbrekend={opstart.ontbrekend} onKlaar={() => start()} />}
      {opstart.fase === 'instellen' && <InstellingenScherm basis={basis} instellingen={opstart.instellingen} onOpgeslagen={start} />}
      {diensten && (
        <DienstenContext.Provider value={diensten}>
          <Hoofdscherm />
        </DienstenContext.Provider>
      )}
    </div>
  );
}
