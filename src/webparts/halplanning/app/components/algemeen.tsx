// Gedeelde UI-bouwstenen.

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
  makeStyles,
  MessageBar,
  MessageBarBody,
  Spinner,
  Toast,
  ToastTitle,
  tokens,
  useToastController
} from '@fluentui/react-components';
import { Status } from '../model';
import { foutTekst } from '../services/sp';

export const TOASTER_ID = 'halplanning-toaster';

type BadgeKleur = 'brand' | 'danger' | 'important' | 'informative' | 'severe' | 'subtle' | 'success' | 'warning';

const STATUS_KLEUR: Record<Status, BadgeKleur> = {
  Nieuw: 'brand',
  'In afwachting': 'warning',
  Bevestigd: 'success',
  'Klaar voor facturatie': 'important',
  Gefactureerd: 'informative',
  Gesloten: 'subtle',
  Verwijderd: 'danger'
};

export function StatusBadge(props: { status: Status; size?: 'small' | 'medium' | 'large' }): JSX.Element {
  const kleur = STATUS_KLEUR[props.status];
  return (
    <Badge appearance={kleur === 'subtle' ? 'outline' : 'filled'} color={kleur === 'subtle' ? 'informative' : kleur} size={props.size || 'medium'}>
      {props.status}
    </Badge>
  );
}

/** Meldingen onderaan het scherm. */
export function useMelding(): { ok: (tekst: string) => void; fout: (e: unknown) => void } {
  const { dispatchToast } = useToastController(TOASTER_ID);
  return React.useMemo(
    () => ({
      ok: (tekst: string) =>
        dispatchToast(
          <Toast>
            <ToastTitle>{tekst}</ToastTitle>
          </Toast>,
          { intent: 'success', timeout: 3000 }
        ),
      fout: (e: unknown) => {
        console.error(e);
        dispatchToast(
          <Toast>
            <ToastTitle>{typeof e === 'string' ? e : foutTekst(e)}</ToastTitle>
          </Toast>,
          { intent: 'error', timeout: 8000 }
        );
      }
    }),
    [dispatchToast]
  );
}

export interface BevestigOpties {
  titel: string;
  tekst: React.ReactNode;
  knop: string;
  gevaarlijk?: boolean;
  annuleren?: string;
}

/** Bevestigingsdialoog als belofte: `if (await vraag({...})) ...` */
export function useBevestig(): [JSX.Element, (o: BevestigOpties) => Promise<boolean>] {
  const [opties, setOpties] = React.useState<BevestigOpties | undefined>();
  const oplosser = React.useRef<(ja: boolean) => void>();

  const vraag = React.useCallback((o: BevestigOpties) => {
    setOpties(o);
    return new Promise<boolean>(resolve => (oplosser.current = resolve));
  }, []);

  const sluit = (ja: boolean): void => {
    setOpties(undefined);
    if (oplosser.current) oplosser.current(ja);
    oplosser.current = undefined;
  };

  const element = (
    <Dialog open={!!opties} onOpenChange={(_, d) => !d.open && sluit(false)}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>{opties?.titel}</DialogTitle>
          <DialogContent>{opties?.tekst}</DialogContent>
          <DialogActions>
            <Button appearance="secondary" onClick={() => sluit(false)}>
              {opties?.annuleren || 'Annuleren'}
            </Button>
            <Button
              appearance="primary"
              style={opties?.gevaarlijk ? { backgroundColor: tokens.colorPaletteRedBackground3 } : undefined}
              onClick={() => sluit(true)}
            >
              {opties?.knop}
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
  return [element, vraag];
}

const useLadenStijl = makeStyles({
  laden: { display: 'flex', justifyContent: 'center', padding: '32px' }
});

export function Laden(props: { tekst?: string }): JSX.Element {
  const s = useLadenStijl();
  return (
    <div className={s.laden}>
      <Spinner label={props.tekst || 'Laden…'} />
    </div>
  );
}

export function Fout(props: { fout: unknown }): JSX.Element {
  return (
    <MessageBar intent="error">
      <MessageBarBody>{typeof props.fout === 'string' ? props.fout : foutTekst(props.fout)}</MessageBarBody>
    </MessageBar>
  );
}

/** Voert een asynchrone actie uit met bezig-status en foutmelding. */
export function useBezig(): [boolean, <T>(actie: () => Promise<T>, gelukt?: string) => Promise<T | undefined>] {
  const [bezig, setBezig] = React.useState(false);
  const melding = useMelding();
  const voerUit = React.useCallback(
    async <T,>(actie: () => Promise<T>, gelukt?: string): Promise<T | undefined> => {
      setBezig(true);
      try {
        const r = await actie();
        if (gelukt) melding.ok(gelukt);
        return r;
      } catch (e) {
        melding.fout(e);
        return undefined;
      } finally {
        setBezig(false);
      }
    },
    [melding]
  );
  return [bezig, voerUit];
}

export const useGedeeldeStijl = makeStyles({
  scherm: {
    padding: '12px',
    maxWidth: '1100px',
    margin: '0 auto',
    boxSizing: 'border-box',
    '@media (min-width: 640px)': { padding: '16px 24px' }
  },
  kop: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' },
  groei: { flexGrow: 1, minWidth: 0 },
  formulier: { display: 'flex', flexDirection: 'column', gap: '12px', maxWidth: '640px' },
  rij: { display: 'flex', gap: '8px', alignItems: 'flex-end', flexWrap: 'wrap' },
  knoppen: { display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '8px' },
  kaart: {
    backgroundColor: tokens.colorNeutralBackground1,
    border: '1px solid ' + tokens.colorNeutralStroke2,
    borderRadius: tokens.borderRadiusMedium,
    padding: '12px',
    boxShadow: tokens.shadow2
  },
  gedempt: { color: tokens.colorNeutralForeground3 },
  leeg: { color: tokens.colorNeutralForeground3, padding: '24px 0', textAlign: 'center' }
});
