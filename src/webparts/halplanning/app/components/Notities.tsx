// Notities (FR-42) en geschiedenis van statuswijzigingen (FR-22).

import * as React from 'react';
import { Button, makeStyles, Textarea, tokens } from '@fluentui/react-components';
import { AddRegular } from '@fluentui/react-icons';
import { useDiensten } from '../AppContext';
import { datumTijd } from '../logic/datum';
import { Notitie, Statuswijziging } from '../model';
import { Fout, Laden, useBezig, useGedeeldeStijl } from './algemeen';

const useStijl = makeStyles({
  lijst: { display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' },
  notitie: {
    padding: '8px 12px',
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorNeutralBackground2,
    whiteSpace: 'pre-wrap',
    overflowWrap: 'anywhere'
  },
  meta: { fontSize: tokens.fontSizeBase200, color: tokens.colorNeutralForeground3, marginBottom: '4px' }
});

export function Notities(props: { aanvraagId: number }): JSX.Element {
  const d = useDiensten();
  const s = useStijl();
  const g = useGedeeldeStijl();
  const [notities, setNotities] = React.useState<Notitie[] | undefined>();
  const [fout, setFout] = React.useState<unknown>();
  const [tekst, setTekst] = React.useState('');
  const [bezig, voerUit] = useBezig();

  const laad = React.useCallback(async () => {
    try {
      setNotities(await d.repo.notities(props.aanvraagId));
    } catch (e) {
      setFout(e);
    }
  }, [props.aanvraagId]);

  React.useEffect(() => {
    laad().catch(() => undefined);
  }, [laad]);

  const voegToe = async (): Promise<void> => {
    if (!tekst.trim()) return;
    const ok = await voerUit(async () => {
      await d.repo.maakNotitie(props.aanvraagId, tekst.trim());
      return true;
    });
    if (ok) {
      setTekst('');
      await laad();
    }
  };

  if (fout) return <Fout fout={fout} />;
  if (!notities) return <Laden />;

  return (
    <div>
      <div className={s.lijst}>
        {notities.length === 0 && <div className={g.leeg}>Nog geen notities.</div>}
        {notities.map(n => (
          <div key={n.id} className={s.notitie}>
            <div className={s.meta}>
              {n.auteur} · {n.gemaakt ? datumTijd(n.gemaakt) : ''}
            </div>
            {n.tekst}
          </div>
        ))}
      </div>
      <div className={g.formulier}>
        <Textarea value={tekst} onChange={(_, v) => setTekst(v.value)} placeholder="Notitie toevoegen (zichtbaar voor alle agents)" resize="vertical" />
        <div>
          <Button appearance="primary" icon={<AddRegular />} disabled={bezig || !tekst.trim()} onClick={voegToe}>
            Notitie toevoegen
          </Button>
        </div>
      </div>
    </div>
  );
}

export function Geschiedenis(props: { aanvraagId: number }): JSX.Element {
  const d = useDiensten();
  const s = useStijl();
  const g = useGedeeldeStijl();
  const [items, setItems] = React.useState<Statuswijziging[] | undefined>();
  const [fout, setFout] = React.useState<unknown>();

  React.useEffect(() => {
    d.repo.statuswijzigingen(props.aanvraagId).then(setItems).catch(setFout);
  }, [props.aanvraagId]);

  if (fout) return <Fout fout={fout} />;
  if (!items) return <Laden />;
  if (items.length === 0) return <div className={g.leeg}>Nog geen statuswijzigingen.</div>;
  return (
    <div className={s.lijst}>
      {items.map(i => (
        <div key={i.id} className={s.notitie}>
          <div className={s.meta}>
            {i.op ? datumTijd(i.op) : ''} · {i.door}
          </div>
          {i.van} → {i.naar}
        </div>
      ))}
    </div>
  );
}
