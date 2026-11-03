// Zoekbare keuzelijst van aanvragen (alle statussen behalve Verwijderd), voor samenvoegen en demo verplaatsen.

import * as React from 'react';
import { Combobox, Field, Option } from '@fluentui/react-components';
import { useDiensten } from '../AppContext';
import { Aanvraag, STATUSSEN } from '../model';
import { foutTekst } from '../services/sp';

const MAX_OPTIES = 50;

export function aanvraagLabel(a: Aanvraag): string {
  return [a.titel || a.naam || a.email || '(zonder titel)', a.email, a.status].filter(x => !!x).join(' · ');
}

export function AanvraagKiezer(props: {
  /** Laadt de aanvragen opnieuw en wist de keuze zodra dit waar wordt (bij het openen van de dialoog). */
  actief: boolean;
  label: string;
  /** Deze aanvraag staat niet in de lijst (de huidige). */
  zonderId: number;
  keuze?: Aanvraag;
  onKeuze: (a?: Aanvraag) => void;
  disabled?: boolean;
}): JSX.Element {
  const d = useDiensten();
  const [opties, setOpties] = React.useState<Aanvraag[] | undefined>();
  const [fout, setFout] = React.useState<unknown>();
  const [zoek, setZoek] = React.useState('');

  React.useEffect(() => {
    if (!props.actief) return;
    setZoek('');
    setOpties(undefined);
    setFout(undefined);
    props.onKeuze(undefined);
    d.repo
      .aanvragen(STATUSSEN.filter(st => st !== 'Verwijderd'))
      .then(r => setOpties(r.filter(a => a.id !== props.zonderId)))
      .catch(setFout);
  }, [props.actief]);

  const term = zoek.trim().toLowerCase();
  const gevonden = (opties || []).filter(a => !term || [a.titel, a.naam, a.organisatie, a.email].some(v => (v || '').toLowerCase().indexOf(term) >= 0));

  return (
    <Field label={props.label} validationMessage={fout ? foutTekst(fout) : undefined}>
      <Combobox
        freeform
        placeholder={opties ? 'Zoek op naam, organisatie, e-mail of titel' : 'Aanvragen laden…'}
        disabled={!opties || props.disabled}
        value={zoek}
        selectedOptions={props.keuze ? [String(props.keuze.id)] : []}
        onChange={e => {
          setZoek(e.target.value);
          props.onKeuze(undefined);
        }}
        onOptionSelect={(_, v) => {
          const a = (opties || []).filter(x => String(x.id) === v.optionValue)[0];
          props.onKeuze(a);
          setZoek(a ? aanvraagLabel(a) : '');
        }}
      >
        {gevonden.slice(0, MAX_OPTIES).map(a => (
          <Option key={a.id} value={String(a.id)} text={aanvraagLabel(a)}>
            {aanvraagLabel(a)}
          </Option>
        ))}
        {gevonden.length === 0 && opties && (
          <Option disabled value="" text="">
            Geen aanvragen gevonden
          </Option>
        )}
      </Combobox>
    </Field>
  );
}
