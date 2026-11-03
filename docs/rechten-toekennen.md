# Rechten toekennen voor Halplanning (PowerShell)

Deze handleiding beschrijft hoe een beheerder via de command line alle rechten toekent die Halplanning nodig heeft. Zie §3 van [SPECIFICATION.md](../SPECIFICATION.md) voor de achtergrond.

## Overzicht

| Wie | Wat | Waar | Stap |
|---|---|---|---|
| Agents | Volledige toegang | Gedeelde mailbox | 2 |
| Agents | Verzenden als | Gedeelde mailbox | 2 |
| Agents | Editor | Agendamap van de gedeelde mailbox | 2 |
| Agents | Lid | Team / SharePoint-site | 3 |
| Site-eigenaar (eenmalig) | Eigenaar | Team / SharePoint-site, om de lijsten aan te maken | 3 |
| Flow-account | Volledige toegang | Gedeelde mailbox | 4 |
| Flow-account | Lid | Team / SharePoint-site | 4 |
| Tenant (eenmalig) | Graph-rechten van de SPFx-oplossing goedkeuren | SharePoint-beheer | 5 |

**Aanpak**: ken de mailboxrechten niet per persoon toe, maar aan één **beveiligingsgroep met e-mail** (*Halplanning-agents*). Een nieuwe agent toevoegen of verwijderen is dan één commando (stap 6).

> Wijzigingen in mailboxrechten kunnen **tot 60 minuten** duren voordat ze werken. Laat de agent na die tijd de app (of Teams) opnieuw openen.

## 0. Voorbereiding

PowerShell 7 wordt aanbevolen. Installeer eenmalig de modules:

```powershell
Install-Module ExchangeOnlineManagement -Scope CurrentUser
Install-Module MicrosoftTeams -Scope CurrentUser
Install-Module Microsoft.Online.SharePoint.PowerShell -Scope CurrentUser
```

Zet de variabelen voor deze omgeving. Alle blokken hieronder gebruiken ze.

```powershell
$Tenant      = "contoso"                          # het deel vóór .onmicrosoft.com / -admin.sharepoint.com
$Mailbox     = "halplanning@contoso.nl"           # adres van de gedeelde mailbox
$AgentsGroep = "Halplanning-agents"               # naam van de beveiligingsgroep
$AgentsAdres = "halplanning-agents@contoso.nl"    # e-mailadres van de beveiligingsgroep
$TeamNaam    = "Halplanning"                      # weergavenaam van het team
$FlowAccount = "svc-halplanning@contoso.nl"       # account waaronder de Power Automate-flow draait
$Agents      = @("jan@contoso.nl", "piet@contoso.nl")
```

## 1. Beveiligingsgroep aanmaken (eenmalig)

```powershell
Connect-ExchangeOnline

New-DistributionGroup -Name $AgentsGroep -PrimarySmtpAddress $AgentsAdres -Type Security
# Optioneel: verberg de groep in het adresboek, zodat er geen mail naartoe gestuurd wordt
Set-DistributionGroup -Identity $AgentsGroep -HiddenFromAddressListsEnabled $true

foreach ($a in $Agents) { Add-DistributionGroupMember -Identity $AgentsGroep -Member $a }
```

## 2. Rechten op de gedeelde mailbox

### 2a. Volledige toegang en Verzenden als

```powershell
Connect-ExchangeOnline   # als je nog niet verbonden bent

# Volledige toegang: berichten lezen en de Outlook-link openen
Add-MailboxPermission -Identity $Mailbox -User $AgentsGroep -AccessRights FullAccess -InheritanceType All

# Verzenden als: de app verstuurt antwoorden met de gedeelde mailbox als afzender
Add-RecipientPermission -Identity $Mailbox -Trustee $AgentsGroep -AccessRights SendAs -Confirm:$false
```

Is Volledige toegang via een groep toegekend, dan verschijnt de mailbox **niet automatisch** in Outlook (AutoMapping werkt niet via groepen). Voor de app maakt dat niet uit. Willen agents de mailbox ook in Outlook zien, ken het recht dan per persoon toe:

```powershell
foreach ($a in $Agents) {
    Add-MailboxPermission -Identity $Mailbox -User $a -AccessRights FullAccess -InheritanceType All -AutoMapping $true
}
```

> Gebruik **niet** `Set-Mailbox -GrantSendOnBehalfTo`. Dat geeft "Verzenden namens": de ontvanger ziet dan "Agent namens Halplanning", en dat is niet de bedoeling.

### 2b. Rechten op de agenda

De app leest en schrijft de agenda via Microsoft Graph. Ken daarom ook expliciet rechten op de agendamap toe. De mapnaam hangt af van de taal van de mailbox ("Agenda" of "Calendar"), dus haal die eerst op:

```powershell
$AgendaMap = (Get-MailboxFolderStatistics -Identity $Mailbox -FolderScope Calendar |
              Where-Object FolderType -eq "Calendar").Name
$AgendaPad = "${Mailbox}:\$AgendaMap"

Add-MailboxFolderPermission -Identity $AgendaPad -User $AgentsGroep -AccessRights Editor
```

Bestaat er al een vermelding voor de groep, gebruik dan `Set-MailboxFolderPermission` met dezelfde parameters.

Is in de app een **subagenda** gekozen (een tweede agenda in de mailbox), ken het recht dan ook op die map toe, bijvoorbeeld `"${Mailbox}:\$AgendaMap\Demo's"`.

## 3. Team / SharePoint-site

De lijsten staan op de SharePoint-site van het team waarin de app draait. Leden van het team krijgen automatisch *Bewerken*-rechten op die site.

```powershell
Connect-MicrosoftTeams

$TeamId = (Get-Team -DisplayName $TeamNaam).GroupId

foreach ($a in $Agents) { Add-TeamUser -GroupId $TeamId -User $a -Role Member }
```

De eerste keer dat de app op een site wordt geopend, moet een **eigenaar** de lijsten aanmaken (FR-81). Maak zo nodig een agent tijdelijk eigenaar:

```powershell
Add-TeamUser -GroupId $TeamId -User "jan@contoso.nl" -Role Owner
```

Staat de app op een losse SharePoint-site zonder team, voeg gebruikers dan toe aan de ledengroep van die site:

```powershell
Connect-SPOService -Url "https://$Tenant-admin.sharepoint.com"
$SiteUrl = "https://$Tenant.sharepoint.com/sites/halplanning"
$Leden   = (Get-SPOSiteGroup -Site $SiteUrl | Where-Object { $_.Title -like "*Leden*" -or $_.Title -like "*Members*" }).Title
foreach ($a in $Agents) { Add-SPOUser -Site $SiteUrl -LoginName $a -Group $Leden }
```

## 4. Account voor de Power Automate-flow

De flow leest nieuwe mail en schrijft naar de lijsten. Hij verstuurt zelf geen mail, dus *Verzenden als* is niet nodig.

```powershell
Connect-ExchangeOnline
Add-MailboxPermission -Identity $Mailbox -User $FlowAccount -AccessRights FullAccess -InheritanceType All -AutoMapping $false

Connect-MicrosoftTeams
Add-TeamUser -GroupId $TeamId -User $FlowAccount -Role Member
```

Het flow-account heeft een licentie nodig waarin Power Automate en de standaardconnectoren zitten (bijvoorbeeld Microsoft 365 Business Standard of E3). Een licentie voor Exchange alleen is niet genoeg.

## 5. Graph-rechten van de app goedkeuren (eenmalig per tenant)

Nadat het `.sppkg`-pakket in de app-catalogus van de tenant is geüpload, staan de aangevraagde Graph-rechten klaar voor goedkeuring.

```powershell
Connect-SPOService -Url "https://$Tenant-admin.sharepoint.com"

# Openstaande aanvragen bekijken
Get-SPOTenantServicePrincipalPermissionRequests

# Elke aanvraag van Halplanning goedkeuren
Get-SPOTenantServicePrincipalPermissionRequests |
    Where-Object PackageName -like "*halplanning*" |
    ForEach-Object { Approve-SPOTenantServicePrincipalPermissionRequest -RequestId $_.Id }

# Controleren wat er is toegekend
Get-SPOTenantServicePrincipalPermissionGrants
```

> Deze goedkeuring geldt **tenantbreed** voor alle SPFx-oplossingen (zie risico R1 in de specificatie).
>
> Werkt de module `Microsoft.Online.SharePoint.PowerShell` niet in PowerShell 7, laad hem dan met `Import-Module Microsoft.Online.SharePoint.PowerShell -UseWindowsPowerShell`, of gebruik Windows PowerShell 5.1. Goedkeuren kan ook via het SharePoint-beheercentrum, onder *Geavanceerd → API-toegang*.

## 6. Dagelijks beheer: agent toevoegen of verwijderen

**Toevoegen** (als de groep uit stap 1 wordt gebruikt):

```powershell
Connect-ExchangeOnline
Add-DistributionGroupMember -Identity $AgentsGroep -Member "nieuw@contoso.nl"

Connect-MicrosoftTeams
Add-TeamUser -GroupId $TeamId -User "nieuw@contoso.nl" -Role Member
```

**Verwijderen**:

```powershell
Connect-ExchangeOnline
Remove-DistributionGroupMember -Identity $AgentsGroep -Member "oud@contoso.nl" -Confirm:$false

Connect-MicrosoftTeams
Remove-TeamUser -GroupId $TeamId -User "oud@contoso.nl"
```

Zijn er ook persoonlijke rechten toegekend voor AutoMapping (stap 2a), verwijder die dan ook:

```powershell
Remove-MailboxPermission -Identity $Mailbox -User "oud@contoso.nl" -AccessRights FullAccess -InheritanceType All -Confirm:$false
```

## 7. Controleren

```powershell
Connect-ExchangeOnline

# Volledige toegang
Get-MailboxPermission -Identity $Mailbox | Where-Object { -not $_.IsInherited -and $_.User -notlike "NT AUTHORITY*" }

# Verzenden als
Get-RecipientPermission -Identity $Mailbox | Where-Object Trustee -notlike "NT AUTHORITY*"

# Agenda
Get-MailboxFolderPermission -Identity $AgendaPad

# Leden van de groep
Get-DistributionGroupMember -Identity $AgentsGroep
```

## Problemen oplossen

| Melding in de app | Waarschijnlijke oorzaak | Oplossing |
|---|---|---|
| Verzenden mislukt / *ErrorSendAsDenied* | Het recht Verzenden als ontbreekt, of het is nog niet actief | Stap 2a; tot 60 minuten wachten |
| Agenda niet zichtbaar / *ErrorAccessDenied* | Er ontbreekt een recht op de agendamap | Stap 2b; controleer de mapnaam |
| Mailbox niet gevonden in de instellingen | De gebruiker heeft geen Volledige toegang, of het adres is fout | Stap 2a; controleer `$Mailbox` |
| "Lijsten ontbreken, vraag een eigenaar" | De gebruiker is geen eigenaar van de site | Stap 3, eigenaar maken |
| Graph-fout *403* bij elke actie | De Graph-rechten van de app zijn nog niet goedgekeurd | Stap 5 |
