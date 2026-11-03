// Instellingen (FR-80) en installatie van de lijsten op de site (FR-81).

import * as React from 'react';
import {
  Button,
  Dropdown,
  Field,
  Input,
  makeStyles,
  MessageBar,
  MessageBarBody,
  Option,
  tokens
} from '@fluentui/react-components';
import { ArrowLeftRegular, CheckmarkRegular, SaveRegular } from '@fluentui/react-icons';
import { Basis } from '../AppContext';
import { isGeldigEmail } from '../logic/validatie';
import { LIJSTEN, LijstSleutel } from '../lists';
import { Instellingen } from '../model';
import { Agenda, GraphService } from '../services/graph';
import { foutTekst } from '../services/sp';
import { Fout, Laden, useBezig, useGedeeldeStijl } from './algemeen';

const useStijl = makeStyles({
  titel: { fontSize: tokens.fontSizeBase500, fontWeight: tokens.fontWeightSemibold },
  log: {
    fontFamily: tokens.fontFamilyMonospace,
    fontSize: tokens.fontSizeBase200,
    backgroundColor: tokens.colorNeutralBackground3,
    padding: '8px',
    borderRadius: tokens.borderRadiusMedium,
    maxHeight: '240px',
    overflowY: 'auto',
    whiteSpace: 'pre-wrap'
  }
});

export function InstellingenScherm(props: {
  basis: Basis;
  instellingen: Instellingen;
  onOpgeslagen: () => Promise<void>;
  terug?: () => void;
}): JSX.Element {
  const s = useStijl();
  const g = useGedeeldeStijl();
  const [adres, setAdres] = React.useState(props.instellingen.mailboxAdres);
  const [agendas, setAgendas] = React.useState<Agenda[] | undefined>();
  const [agendaId, setAgendaId] = React.useState(props.instellingen.agendaId);
  const [controleFout, setControleFout] = React.useState<string | undefined>();
  const [bezig, voerUit] = useBezig();

  const controleer = async (): Promise<void> => {
    setControleFout(undefined);
    setAgendas(undefined);
    const r = await voerUit(async () => {
      try {
        await GraphService.testMailtoegang(props.basis.graphClient, adres.trim());
      } catch (e) {
        throw new Error('Geen toegang tot het postvak van ' + adres.trim() + '. ' + foutTekst(e));
      }
      try {
        return await GraphService.agendas(props.basis.graphClient, adres.trim());
      } catch (e) {
        throw new Error('Geen toegang tot de agenda’s van ' + adres.trim() + '. ' + foutTekst(e));
      }
    });
    if (!r) {
      setControleFout('Controle mislukt. Zie de melding hierboven en docs/rechten-toekennen.md.');
      return;
    }
    setAgendas(r);
    const huidig = r.filter(a => a.id === agendaId)[0];
    if (!huidig) setAgendaId((r.filter(a => a.standaard)[0] || r[0] || { id: '' }).id);
  };

  const bewaar = async (): Promise<void> => {
    const agenda = (agendas || []).filter(a => a.id === agendaId)[0];
    if (!agenda) return;
    const ok = await voerUit(async () => {
      await props.basis.repo.zetInstelling('MailboxAdres', adres.trim());
      await props.basis.repo.zetInstelling('AgendaId', agenda.id);
      await props.basis.repo.zetInstelling('AgendaNaam', agenda.naam);
      return true;
    }, 'Instellingen opgeslagen');
    if (ok) await props.onOpgeslagen();
  };

  const gekozen = (agendas || []).filter(a => a.id === agendaId)[0];

  return (
    <div className={g.scherm}>
      <div className={g.kop}>
        {props.terug && <Button appearance="subtle" icon={<ArrowLeftRegular />} onClick={props.terug} aria-label="Terug" />}
        <div className={g.groei + ' ' + s.titel}>Instellingen</div>
      </div>
      <div className={g.formulier}>
        {!props.instellingen.mailboxAdres && (
          <MessageBar intent="info">
            <MessageBarBody>Stel eerst de gedeelde mailbox en de agenda in. Daarna is de app klaar voor gebruik.</MessageBarBody>
          </MessageBar>
        )}
        <Field label="Adres van de gedeelde mailbox" hint="Bijvoorbeeld halplanning@centaur.nl">
          <Input
            type="email"
            value={adres}
            onChange={(_, v) => {
              setAdres(v.value);
              setAgendas(undefined);
            }}
          />
        </Field>
        <div>
          <Button icon={<CheckmarkRegular />} disabled={bezig || !isGeldigEmail(adres)} onClick={controleer}>
            Toegang controleren en agenda’s ophalen
          </Button>
        </div>
        {controleFout && <Fout fout={controleFout} />}
        {agendas && (
          <>
            <MessageBar intent="success">
              <MessageBarBody>Toegang tot het postvak en de agenda’s is in orde.</MessageBarBody>
            </MessageBar>
            <Field label="Agenda">
              <Dropdown
                value={gekozen ? gekozen.naam : ''}
                selectedOptions={agendaId ? [agendaId] : []}
                onOptionSelect={(_, v) => setAgendaId(v.optionValue || '')}
              >
                {agendas.map(a => (
                  <Option key={a.id} value={a.id} text={a.naam}>
                    {a.naam}
                    {a.standaard ? ' (standaard)' : ''}
                    {a.kanBewerken ? '' : ' – alleen lezen'}
                  </Option>
                ))}
              </Dropdown>
            </Field>
            {gekozen && !gekozen.kanBewerken && <Fout fout="Je hebt geen schrijfrechten op deze agenda. Ken het recht Editor toe (zie docs/rechten-toekennen.md)." />}
            <div>
              <Button appearance="primary" icon={<SaveRegular />} disabled={bezig || !gekozen} onClick={bewaar}>
                Opslaan
              </Button>
            </div>
          </>
        )}
        {props.instellingen.mailboxAdres && !agendas && (
          <p className={g.gedempt}>
            Huidige instelling: {props.instellingen.mailboxAdres}, agenda “{props.instellingen.agendaNaam || props.instellingen.agendaId}”.
          </p>
        )}
      </div>
    </div>
  );
}

export function InstallatieScherm(props: { basis: Basis; ontbrekend: LijstSleutel[]; onKlaar: () => void }): JSX.Element {
  const s = useStijl();
  const g = useGedeeldeStijl();
  const [mag, setMag] = React.useState<boolean | undefined>();
  const [log, setLog] = React.useState<string[]>([]);
  const [fout, setFout] = React.useState<unknown>();
  const [bezig, setBezig] = React.useState(false);

  React.useEffect(() => {
    props.basis.installatie.magInstalleren().then(setMag).catch(() => setMag(false));
  }, []);

  const installeer = async (): Promise<void> => {
    setBezig(true);
    setFout(undefined);
    try {
      await props.basis.installatie.installeer(m => setLog(l => l.concat(m)));
      props.onKlaar();
    } catch (e) {
      setFout(e);
    } finally {
      setBezig(false);
    }
  };

  return (
    <div className={g.scherm}>
      <div className={g.kop}>
        <div className={g.groei + ' ' + s.titel}>Halplanning installeren op deze site</div>
      </div>
      <div className={g.formulier}>
        <p>De volgende lijsten ontbreken nog op deze site, of missen kolommen van een nieuwere versie van de app:</p>
        <ul>
          {props.ontbrekend.map(k => (
            <li key={k}>{LIJSTEN[k].titel}</li>
          ))}
        </ul>
        {mag === undefined && <Laden tekst="Rechten controleren…" />}
        {mag === false && (
          <MessageBar intent="warning">
            <MessageBarBody>Alleen een eigenaar van deze site kan de lijsten aanmaken of bijwerken. Vraag een eigenaar om de app één keer te openen.</MessageBarBody>
          </MessageBar>
        )}
        {mag && (
          <div>
            <Button appearance="primary" disabled={bezig} onClick={installeer}>
              {bezig ? 'Bezig met installeren…' : 'Lijsten aanmaken of bijwerken'}
            </Button>
          </div>
        )}
        {fout ? <Fout fout={fout} /> : undefined}
        {log.length > 0 && <div className={s.log}>{log.join('\n')}</div>}
      </div>
    </div>
  );
}
