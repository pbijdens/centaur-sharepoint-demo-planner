// Laadt de editor (TipTap/ProseMirror) pas wanneer die nodig is, zodat het startscherm sneller opent.

import * as React from 'react';
import { Spinner } from '@fluentui/react-components';
import type { TekstEditorApi } from './TekstEditor';

export type { TekstEditorApi };

interface Props {
  html: string;
  onChange?: (html: string) => void;
}

const Editor = React.lazy(() => import(/* webpackChunkName: 'teksteditor' */ './TekstEditor').then(m => ({ default: m.TekstEditor })));

export const TekstEditor = React.forwardRef<TekstEditorApi, Props>(function TekstEditorUitgesteld(props, ref) {
  return (
    <React.Suspense fallback={<Spinner size="tiny" label="Editor laden…" />}>
      <Editor {...props} ref={ref} />
    </React.Suspense>
  );
});
