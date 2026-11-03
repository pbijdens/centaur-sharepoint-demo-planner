// Notities (FR-42: toevoegen, wijzigen en verwijderen) en geschiedenis van statuswijzigingen (FR-22).

import * as React from 'react';
import { Button, makeStyles, Menu, MenuItem, MenuList, MenuPopover, MenuTrigger, Textarea, tokens } from '@fluentui/react-components';
import { AddRegular, DeleteRegular, EditRegular, MoreHorizontalRegular } from '@fluentui/react-icons';
import { useDiensten } from '../AppContext';
import { datumTijd } from '../logic/datum';
import { Notitie, Statuswijziging } from '../model';
import { Fout, Laden, useBevestig, useBezig, useGedeeldeStijl } from './algemeen';

const useStijl = makeStyles({
  lijst: { display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' },
  notitie: {
    padding: '8px 12px',
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorNeutralBackground2,
    whiteSpace: 'pre-wrap',
    overflowWrap: 'anywhere'
  },
  kop: { display: 'flex', alignItems: 'flex-start', gap: '8px' },
  meta: { fontSize: tokens.fontSizeBase200, color: tokens.colorNeutralForeground3, marginBottom: '4px', flexGrow: 1, minWidth: 0 },
  knoppen: { display: 'flex', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }
});

export function Notities(props: { aanvraagId: number }): JSX.Element {
  const d = useDiensten();
  const s = useStijl();
  const g = useGedeeldeStijl();
  const [notities, setNotities] = React.useState<Notitie[] | undefined>();
  const [fout, setFout] = React.useState<unknown>();
  const [tekst, setTekst] = React.useState('');
  const [bewerk, setBewerk] = React.useState<{ id: number; tekst: string } | undefined>();
  const [bezig, voerUit] = useBezig();
  const [bevestigDialoog, bevestig] = useBevestig();

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

  const bewaar = async (n: Notitie): Promise<void> => {
    if (!bewerk || !bewerk.tekst.trim()) return;
    const ok = await voerUit(async () => {
      await d.repo.wijzigNotitie(n.id, bewerk.tekst.trim(), n.etag);
      return true;
    }, 'Notitie gewijzigd');
    if (ok) setBewerk(undefined);
    await laad();
  };

  const verwijder = async (n: Notitie): Promise<void> => {
    const ok = await bevestig({
      titel: 'Notitie verwijderen?',
      tekst: 'De notitie wordt voor alle agents verwijderd.',
      knop: 'Verwijderen',
      gevaarlijk: true
    });
    if (!ok) return;
    await voerUit(() => d.repo.verwijderNotitie(n.id), 'Notitie verwijderd');
    await laad();
  };

  if (fout) return <Fout fout={fout} />;
  if (!notities) return <Laden />;

  return (
    <div>
      {bevestigDialoog}
      <div className={s.lijst}>
        {notities.length === 0 && <div className={g.leeg}>Nog geen notities.</div>}
        {notities.map(n => (
          <div key={n.id} className={s.notitie}>
            <div className={s.kop}>
              <div className={s.meta}>
                {n.auteur} · {n.gemaakt ? datumTijd(n.gemaakt) : ''}
                {n.gewijzigd && ' · gewijzigd' + (n.gewijzigdDoor ? ' door ' + n.gewijzigdDoor : '') + ' op ' + datumTijd(n.gewijzigd)}
              </div>
              {(!bewerk || bewerk.id !== n.id) && (
                <Menu>
                  <MenuTrigger disableButtonEnhancement>
                    <Button size="small" appearance="subtle" icon={<MoreHorizontalRegular />} aria-label="Acties voor notitie" disabled={bezig} />
                  </MenuTrigger>
                  <MenuPopover>
                    <MenuList>
                      <MenuItem icon={<EditRegular />} onClick={() => setBewerk({ id: n.id, tekst: n.tekst })}>
                        Wijzigen
                      </MenuItem>
                      <MenuItem icon={<DeleteRegular />} onClick={() => verwijder(n)}>
                        Verwijderen
                      </MenuItem>
                    </MenuList>
                  </MenuPopover>
                </Menu>
              )}
            </div>
            {bewerk && bewerk.id === n.id ? (
              <>
                <Textarea value={bewerk.tekst} onChange={(_, v) => setBewerk({ id: n.id, tekst: v.value })} resize="vertical" style={{ width: '100%' }} aria-label="Notitie" />
                <div className={s.knoppen}>
                  <Button appearance="primary" disabled={bezig || !bewerk.tekst.trim()} onClick={() => bewaar(n)}>
                    Opslaan
                  </Button>
                  <Button disabled={bezig} onClick={() => setBewerk(undefined)}>
                    Annuleren
                  </Button>
                </div>
              </>
            ) : (
              n.tekst
            )}
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
