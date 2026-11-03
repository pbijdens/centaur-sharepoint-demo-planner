import * as React from 'react';
import { MSGraphClientV3 } from '@microsoft/sp-http';
import { Instellingen } from './model';
import { Acties } from './services/acties';
import { GraphService } from './services/graph';
import { Installatie } from './services/installatie';
import { Repository } from './services/repository';

export interface Gebruiker {
  naam: string;
  email: string;
}

/** Diensten die altijd beschikbaar zijn, ook vóór installatie en instellingen. */
export interface Basis {
  repo: Repository;
  installatie: Installatie;
  graphClient: MSGraphClientV3;
  gebruiker: Gebruiker;
}

/** Diensten in de werkende app: mailbox en agenda zijn ingesteld. */
export interface Diensten extends Basis {
  graph: GraphService;
  acties: Acties;
  instellingen: Instellingen;
  herlaadInstellingen: () => Promise<void>;
}

export const DienstenContext = React.createContext<Diensten | undefined>(undefined);

export function useDiensten(): Diensten {
  const d = React.useContext(DienstenContext);
  if (!d) throw new Error('DienstenContext ontbreekt');
  return d;
}
