// Rich-text-editor (TipTap). Tekst kan programmatisch worden ingevoegd (standaardantwoorden, FR-33,
// en later een AI-voorstel, FR-37).

import * as React from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { makeStyles, tokens, ToggleButton, Tooltip } from '@fluentui/react-components';
import {
  TextBoldRegular,
  TextBulletListLtrRegular,
  TextItalicRegular,
  TextNumberListLtrRegular,
  TextUnderlineRegular,
  LinkRegular,
  ArrowUndoRegular,
  ArrowRedoRegular
} from '@fluentui/react-icons';

const useStijl = makeStyles({
  omlijsting: {
    border: '1px solid ' + tokens.colorNeutralStroke1,
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorNeutralBackground1,
    ':focus-within': { borderBottomColor: tokens.colorBrandStroke1 }
  },
  balk: {
    display: 'flex',
    gap: '2px',
    flexWrap: 'wrap',
    padding: '4px',
    borderBottom: '1px solid ' + tokens.colorNeutralStroke2
  },
  inhoud: {
    padding: '8px 12px',
    minHeight: '140px',
    maxHeight: '50vh',
    overflowY: 'auto',
    '& .ProseMirror': { outline: 'none', minHeight: '120px' },
    '& .ProseMirror p': { margin: '0 0 8px 0' }
  }
});

export interface TekstEditorApi {
  voegIn: (html: string) => void;
  leeg: () => void;
  html: () => string;
}

interface Props {
  html: string;
  onChange?: (html: string) => void;
}

export const TekstEditor = React.forwardRef<TekstEditorApi, Props>(function TekstEditor(props, ref) {
  const s = useStijl();
  const onChange = React.useRef(props.onChange);
  onChange.current = props.onChange;
  const [, herteken] = React.useReducer((x: number) => x + 1, 0);

  const editor = useEditor({
    extensions: [StarterKit.configure({ link: { openOnClick: false } })],
    content: props.html || '',
    onUpdate: ({ editor: e }) => onChange.current && onChange.current(e.getHTML()),
    // De werkbalk toont welke opmaak actief is; die moet bij elke wijziging of cursorverplaatsing mee.
    onTransaction: () => herteken()
  });

  React.useImperativeHandle(
    ref,
    () => ({
      voegIn: (html: string) => editor && editor.chain().focus().insertContent(html).run(),
      leeg: () => editor && editor.commands.clearContent(true),
      html: () => (editor ? editor.getHTML() : '')
    }),
    [editor]
  );

  if (!editor) return <div className={s.omlijsting} />;

  const knop = (label: string, icoon: JSX.Element, actief: boolean, actie: () => void): JSX.Element => (
    <Tooltip content={label} relationship="label">
      <ToggleButton size="small" appearance="subtle" icon={icoon} checked={actief} onClick={actie} />
    </Tooltip>
  );

  const link = (): void => {
    const huidig = editor.getAttributes('link').href as string | undefined;
    const href = window.prompt('Adres van de link', huidig || 'https://');
    if (href === null) return;
    if (href === '') editor.chain().focus().unsetLink().run();
    else editor.chain().focus().extendMarkRange('link').setLink({ href }).run();
  };

  return (
    <div className={s.omlijsting}>
      <div className={s.balk}>
        {knop('Vet', <TextBoldRegular />, editor.isActive('bold'), () => editor.chain().focus().toggleBold().run())}
        {knop('Cursief', <TextItalicRegular />, editor.isActive('italic'), () => editor.chain().focus().toggleItalic().run())}
        {knop('Onderstrepen', <TextUnderlineRegular />, editor.isActive('underline'), () => editor.chain().focus().toggleUnderline().run())}
        {knop('Opsomming', <TextBulletListLtrRegular />, editor.isActive('bulletList'), () => editor.chain().focus().toggleBulletList().run())}
        {knop('Genummerde lijst', <TextNumberListLtrRegular />, editor.isActive('orderedList'), () => editor.chain().focus().toggleOrderedList().run())}
        {knop('Link', <LinkRegular />, editor.isActive('link'), link)}
        {knop('Ongedaan maken', <ArrowUndoRegular />, false, () => editor.chain().focus().undo().run())}
        {knop('Opnieuw', <ArrowRedoRegular />, false, () => editor.chain().focus().redo().run())}
      </div>
      <EditorContent editor={editor} className={s.inhoud} />
    </div>
  );
});
