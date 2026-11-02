import CodeMirror, { EditorView } from '@uiw/react-codemirror'
import { json } from '@codemirror/lang-json'
import { oneDark } from '@codemirror/theme-one-dark'

const theme = EditorView.theme({
  '&': { backgroundColor: 'transparent', fontSize: '12.5px' },
  '.cm-gutters': { backgroundColor: 'transparent', border: 'none', color: 'oklch(0.5 0.01 270)' },
  '.cm-content, .cm-gutters': { fontFamily: "'JetBrains Mono Variable', ui-monospace, monospace" },
  '&.cm-focused': { outline: 'none' },
  '.cm-activeLine, .cm-activeLineGutter': { backgroundColor: 'oklch(1 0 0 / 4%)' },
})

export function JsonEditor({ value, onChange, readOnly, lang = true, height, minHeight = '120px' }: {
  value: string
  onChange?: (v: string) => void
  readOnly?: boolean
  lang?: boolean
  height?: string
  minHeight?: string
}) {
  return (
    <CodeMirror
      value={value}
      onChange={onChange}
      readOnly={readOnly}
      editable={!readOnly}
      extensions={lang ? [json(), theme, EditorView.lineWrapping] : [theme, EditorView.lineWrapping]}
      theme={oneDark}
      height={height}
      minHeight={minHeight}
      basicSetup={{ foldGutter: !!readOnly, highlightActiveLine: !readOnly }}
    />
  )
}
