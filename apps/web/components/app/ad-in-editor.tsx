import { AdPreview } from "@/components/app/ad-preview"

/** The developer's editor, with the advertiser's card in the Vibefuel panel. */
export function AdInEditor(props: React.ComponentProps<typeof AdPreview> & { editorName?: string }) {
  const { editorName = "Cursor", ...ad } = props
  return (
    <div className="mock-window ad-in-editor" data-frame="editor">
      <div className="mock-titlebar">
        <span className="mock-dots" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        <span className="mock-title">app.tsx — {editorName}</span>
      </div>
      <div className="mock-body">
        <div className="mock-activity" aria-hidden="true">
          <i />
          <i />
          <i />
          <i className="is-active" />
        </div>
        <div className="mock-sidebar">
          <div className="mock-sidebar-title">Vibefuel</div>
          <AdPreview {...ad} />
          <div className="mock-balance">
            <span>Balance</span>
            <strong>128 tokens</strong>
          </div>
        </div>
        <div className="mock-editor" aria-hidden="true">
          <div className="mock-tabs">
            <span className="is-active">app.tsx</span>
            <span>agent.ts</span>
          </div>
          <div className="mock-code">
            {[
              [0, [["k", 30], ["n", 60], ["p", 28]]],
              [1, [["n", 44], ["p", 70]]],
              [1, [["k", 24], ["n", 40], ["s", 64]]],
              [2, [["n", 84], ["p", 26]]],
              [1, [["c", 96]]],
              [1, [["k", 34], ["n", 52]]],
              [0, [["p", 16]]],
              [0, [["k", 42], ["n", 66], ["p", 24]]],
              [1, [["n", 38], ["s", 78]]],
            ].map(([indent, segs], row) => (
              <div key={row} className="mock-line" style={{ paddingLeft: `${(indent as number) * 12}px` }}>
                {(segs as [string, number][]).map(([tone, width], i) => (
                  <i key={i} className={`mock-tok tone-${tone}`} style={{ width: `${width}px` }} />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="mock-statusbar">
        <span>main</span>
        <span className="mock-status-fuel">⛽ 128 tokens</span>
      </div>
    </div>
  )
}
