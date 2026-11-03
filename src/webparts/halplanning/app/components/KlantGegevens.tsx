// Klantgegevens van een aanvraag (§4.5).

import * as React from 'react';
import { Button, Field, Input } from '@fluentui/react-components';
import { SaveRegular } from '@fluentui/react-icons';
import { useDiensten } from '../AppContext';
import { formatteerIban, isGeldigEmail, isGeldigeIban } from '../logic/validatie';
import { Aanvraag } from '../model';
import { useBezig, useGedeeldeStijl } from './algemeen';

type Velden = Pick<Aanvraag, 'titel' | 'naam' | 'organisatie' | 'email' | 'telefoon' | 'iban'>;

export function KlantGegevens(props: { aanvraag: Aanvraag; herlaad: () => Promise<void> }): JSX.Element {
  const d = useDiensten();
  const g = useGedeeldeStijl();
  const a = props.aanvraag;
  const [v, setV] = React.useState<Velden>({ titel: a.titel, naam: a.naam, organisatie: a.organisatie, email: a.email, telefoon: a.telefoon, iban: a.iban });
  const [bezig, voerUit] = useBezig();

  React.useEffect(() => {
    setV({ titel: a.titel, naam: a.naam, organisatie: a.organisatie, email: a.email, telefoon: a.telefoon, iban: a.iban });
  }, [a]);

  const gewijzigd = (Object.keys(v) as (keyof Velden)[]).some(k => v[k] !== a[k]);
  const zet = (k: keyof Velden): ((_: unknown, data: { value: string }) => void) => (_, data) => setV({ ...v, [k]: data.value });

  const emailFout = v.email && !isGeldigEmail(v.email) ? 'Dit lijkt geen geldig e-mailadres.' : undefined;
  const ibanWaarschuwing = v.iban && !isGeldigeIban(v.iban) ? 'Dit IBAN klopt niet volgens de controle. Opslaan kan wel.' : undefined;

  const bewaar = async (): Promise<void> => {
    const ok = await voerUit(async () => {
      await d.repo.wijzigAanvraag(a.id, { ...v, iban: v.iban && isGeldigeIban(v.iban) ? formatteerIban(v.iban) : v.iban }, a.etag);
      return true;
    }, 'Gegevens opgeslagen');
    if (ok) await props.herlaad();
  };

  return (
    <div className={g.formulier}>
      <Field label="Titel" hint="Wordt het onderwerp van de agenda-afspraak.">
        <Input value={v.titel} onChange={zet('titel')} />
      </Field>
      <Field label="Naam">
        <Input value={v.naam} onChange={zet('naam')} />
      </Field>
      <Field label="Organisatie">
        <Input value={v.organisatie} onChange={zet('organisatie')} />
      </Field>
      <Field label="E-mailadres" validationMessage={emailFout} validationState={emailFout ? 'error' : 'none'}>
        <Input type="email" value={v.email} onChange={zet('email')} />
      </Field>
      <Field label="Telefoonnummer">
        <Input type="tel" value={v.telefoon} onChange={zet('telefoon')} />
      </Field>
      <Field label="IBAN" validationMessage={ibanWaarschuwing} validationState={ibanWaarschuwing ? 'warning' : 'none'}>
        <Input value={v.iban} onChange={zet('iban')} />
      </Field>
      <div className={g.knoppen}>
        <Button appearance="primary" icon={<SaveRegular />} disabled={!gewijzigd || bezig || !!emailFout} onClick={bewaar}>
          Opslaan
        </Button>
      </div>
    </div>
  );
}
