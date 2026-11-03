import * as React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Version } from '@microsoft/sp-core-library';
import { BaseClientSideWebPart } from '@microsoft/sp-webpart-base';
import { IReadonlyTheme } from '@microsoft/sp-component-base';
import { MSGraphClientV3 } from '@microsoft/sp-http';
import {
  FluentProvider,
  teamsDarkTheme,
  teamsHighContrastTheme,
  teamsLightTheme,
  Theme,
  webDarkTheme,
  webLightTheme
} from '@fluentui/react-components';

import { App } from './app/App';
import { Basis } from './app/AppContext';
import { Installatie } from './app/services/installatie';
import { Repository } from './app/services/repository';
import { maakSp } from './app/services/sp';

export interface IHalplanningWebPartProps {}

export default class HalplanningWebPart extends BaseClientSideWebPart<IHalplanningWebPartProps> {
  private _root: Root | undefined;
  private _basis: Basis | undefined;
  private _thema: Theme = webLightTheme;

  public render(): void {
    if (!this._basis) return;
    if (!this._root) this._root = createRoot(this.domElement);
    this._root.render(
      React.createElement(
        FluentProvider,
        { theme: this._thema, style: { minHeight: '100%', background: 'transparent' } },
        React.createElement(App, { basis: this._basis })
      )
    );
  }

  protected async onInit(): Promise<void> {
    await super.onInit();
    const web = this.context.pageContext.web;
    const sp = maakSp(this.context);
    const graphClient: MSGraphClientV3 = await this.context.msGraphClientFactory.getClient('3');
    this._basis = {
      repo: new Repository(sp, web.serverRelativeUrl),
      installatie: new Installatie(sp, web.serverRelativeUrl),
      graphClient,
      gebruiker: { naam: this.context.pageContext.user.displayName, email: this.context.pageContext.user.email }
    };

    const teams = this.context.sdks.microsoftTeams;
    if (teams) {
      try {
        const ctx = await teams.teamsJs.app.getContext();
        this._thema = this._teamsThema(ctx.app.theme);
        teams.teamsJs.app.registerOnThemeChangeHandler(thema => {
          this._thema = this._teamsThema(thema);
          this.render();
        });
      } catch {
        this._thema = teamsLightTheme;
      }
    }
  }

  private _teamsThema(naam: string): Theme {
    if (naam === 'dark') return teamsDarkTheme;
    if (naam === 'contrast') return teamsHighContrastTheme;
    return teamsLightTheme;
  }

  protected onThemeChanged(currentTheme: IReadonlyTheme | undefined): void {
    if (!currentTheme || this.context.sdks.microsoftTeams) return;
    this._thema = currentTheme.isInverted ? webDarkTheme : webLightTheme;
    if (this._root) this.render();
  }

  protected onDispose(): void {
    this._root?.unmount();
    this._root = undefined;
  }

  protected get dataVersion(): Version {
    return Version.parse('1.0');
  }
}
