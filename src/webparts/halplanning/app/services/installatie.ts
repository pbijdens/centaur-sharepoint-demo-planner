// Aanmaken van de lijsten op de huidige site (FR-81). Idempotent: bestaande lijsten en kolommen
// worden overgeslagen, zodat een onderbroken installatie opnieuw gestart kan worden.

import { SPFI } from '@pnp/sp';
import { PermissionKind } from '@pnp/sp/security';
import { AANMAAKVOLGORDE, LIJSTEN, LijstDef, LijstSleutel, VeldDef } from '../lists';
import { DEMOTYPES_BEGIN } from '../model';
import { foutStatus } from './sp';

// AddFieldOptions: AddToDefaultContentType (1) | AddFieldInternalNameHint (8) | AddFieldToDefaultView (16)
const VELD_OPTIES = 1 | 8 | 16;

function xml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function veldXml(v: VeldDef, lookupLijstId?: string): string {
  const attrs = [
    'Name="' + v.naam + '"',
    'StaticName="' + v.naam + '"',
    'DisplayName="' + xml(v.weergave) + '"'
  ];
  if (v.index || v.uniek) attrs.push('Indexed="TRUE"');
  if (v.uniek) attrs.push('EnforceUniqueValues="TRUE"');
  const standaard = v.standaard !== undefined ? '<Default>' + xml(v.standaard) + '</Default>' : '';
  switch (v.type) {
    case 'tekst':
      return '<Field Type="Text" MaxLength="255" ' + attrs.join(' ') + ' />';
    case 'notitie':
      return '<Field Type="Note" NumLines="6" RichText="FALSE" ' + attrs.join(' ') + ' />';
    case 'keuze':
      return (
        '<Field Type="Choice" Format="Dropdown" ' + attrs.join(' ') + '><CHOICES>' +
        (v.keuzes || []).map(k => '<CHOICE>' + xml(k) + '</CHOICE>').join('') +
        '</CHOICES>' + standaard + '</Field>'
      );
    case 'janee':
      return '<Field Type="Boolean" ' + attrs.join(' ') + '>' + standaard + '</Field>';
    case 'datum':
      return '<Field Type="DateTime" Format="DateTime" ' + attrs.join(' ') + ' />';
    case 'getal':
      return '<Field Type="Number" ' + attrs.join(' ') + '>' + standaard + '</Field>';
    case 'lookup':
      return '<Field Type="Lookup" List="{' + lookupLijstId + '}" ShowField="Title" ' + attrs.join(' ') + ' />';
    case 'url':
      return '<Field Type="URL" Format="Hyperlink" ' + attrs.join(' ') + ' />';
  }
}

interface BestaandVeld {
  InternalName: string;
  Choices?: string[];
}

/** Keuzes uit het schema die nog niet in de bestaande keuzekolom staan (bijvoorbeeld een nieuwe status). */
function ontbrekendeKeuzes(veld: VeldDef, bestaand: BestaandVeld): string[] {
  if (veld.type !== 'keuze') return [];
  const huidig = bestaand.Choices || [];
  return (veld.keuzes || []).filter(k => huidig.indexOf(k) < 0);
}

export class Installatie {
  private readonly webUrl: string;

  constructor(private readonly sp: SPFI, webServerRelativeUrl: string) {
    this.webUrl = webServerRelativeUrl.replace(/\/$/, '');
  }

  private lijstUrl(def: LijstDef): string {
    return this.webUrl + '/Lists/' + def.url;
  }

  /**
   * Geeft de lijsten die ontbreken, waarin kolommen ontbreken of waarin een keuzekolom keuzes mist
   * (bijvoorbeeld na een update van de app).
   * Een installatie vult beide aan.
   */
  async onvolledigeLijsten(): Promise<LijstSleutel[]> {
    const resultaten = await Promise.all(
      AANMAAKVOLGORDE.map(async sleutel => {
        const def = LIJSTEN[sleutel];
        try {
          const velden = await this.velden(def);
          const compleet = def.velden.every(v => {
            const b = velden.filter(f => f.InternalName === v.naam)[0];
            return !!b && ontbrekendeKeuzes(v, b).length === 0;
          });
          return compleet ? undefined : sleutel;
        } catch (e) {
          if (foutStatus(e) === 404) return sleutel;
          throw e;
        }
      })
    );
    return resultaten.filter((s): s is LijstSleutel => !!s);
  }

  /** Controleert of de gebruiker lijsten mag beheren (site-eigenaar). */
  async magInstalleren(): Promise<boolean> {
    return this.sp.web.currentUserHasPermissions(PermissionKind.ManageLists);
  }

  async installeer(voortgang: (melding: string) => void): Promise<void> {
    const ids: Partial<Record<LijstSleutel, string>> = {};

    for (const sleutel of AANMAAKVOLGORDE) {
      const def = LIJSTEN[sleutel];
      voortgang('Lijst "' + def.titel + '" controleren…');
      ids[sleutel] = await this.zorgVoorLijst(def);
    }

    for (const sleutel of AANMAAKVOLGORDE) {
      const def = LIJSTEN[sleutel];
      const lijst = this.sp.web.getList(this.lijstUrl(def));
      const bestaand = await this.velden(def);

      for (const veld of def.velden) {
        const b = bestaand.filter(f => f.InternalName === veld.naam)[0];
        if (b) {
          const nieuw = ontbrekendeKeuzes(veld, b);
          if (nieuw.length) {
            voortgang('Keuzes van "' + veld.weergave + '" in "' + def.titel + '" bijwerken…');
            // Volgorde van het schema aanhouden; keuzes die alleen in de lijst staan blijven achteraan behouden.
            const keuzes = (veld.keuzes || []).concat((b.Choices || []).filter(k => (veld.keuzes || []).indexOf(k) < 0));
            await lijst.fields.getByInternalNameOrTitle(veld.naam).update({ Choices: keuzes }, 'SP.FieldChoice');
          }
          continue;
        }
        voortgang('Kolom "' + veld.weergave + '" toevoegen aan "' + def.titel + '"…');
        const doelId = veld.doel ? ids[veld.doel] : undefined;
        await lijst.fields.createFieldAsXml({ SchemaXml: veldXml(veld, doelId), Options: VELD_OPTIES });
      }

      const titel = lijst.fields.getByInternalNameOrTitle('Title');
      if (def.titleWeergave) await titel.update({ Title: def.titleWeergave });
      else await titel.update({ Required: false, Hidden: true });
    }

    voortgang('Beginwaarden toevoegen…');
    const types = this.sp.web.getList(this.lijstUrl(LIJSTEN.demoTypes));
    const aantal = ((await types.items.select('Id').top(1)()) as unknown[]).length;
    if (aantal === 0) {
      for (let i = 0; i < DEMOTYPES_BEGIN.length; i++) {
        await types.items.add({ Title: DEMOTYPES_BEGIN[i], Volgorde: (i + 1) * 10, Actief: true });
      }
    }
    voortgang('Klaar.');
  }

  private async velden(def: LijstDef): Promise<BestaandVeld[]> {
    return (await this.sp.web.getList(this.lijstUrl(def)).fields.select('InternalName', 'Choices')()) as BestaandVeld[];
  }

  private async zorgVoorLijst(def: LijstDef): Promise<string> {
    try {
      const info = (await this.sp.web.getList(this.lijstUrl(def)).select('Id')()) as { Id: string };
      return info.Id;
    } catch (e) {
      if (foutStatus(e) !== 404) throw e;
    }
    // De URL wordt afgeleid van de titel bij aanmaken; daarna de weergavetitel zetten.
    const info = await this.sp.web.lists.add(def.url, 'Halplanning – ' + def.titel, 100, false, { OnQuickLaunch: false });
    if (def.titel !== def.url) await this.sp.web.lists.getById(info.Id).update({ Title: def.titel });
    return info.Id;
  }
}
