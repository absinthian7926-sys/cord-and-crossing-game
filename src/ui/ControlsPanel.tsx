export const CONTROL_ROWS = [
  ['Move', 'W, A, S, D'],
  ['Run', 'Shift'],
  ['Jump', 'Space'],
  ['Dodge', 'Control or C'],
  ['Look', 'Mouse'],
  ['Close strike', 'Left mouse button'],
  ['Aim and cast', 'Hold and release right mouse button'],
  ['Recall or stop', 'Q'],
  ['Clear the line', 'F'],
  ['Interact', 'E'],
  ['Quest log', 'Tab'],
  ['Pause', 'Escape'],
] as const

export type ControlsPanelProps = {
  readonly onBack: () => void
}

export function ControlsPanel({ onBack }: ControlsPanelProps) {
  return (
    <section aria-labelledby="controls-title">
      <h2 id="controls-title">Controls</h2>
      <dl className="controls-list">
        {CONTROL_ROWS.map(([action, binding]) => (
          <div key={action}>
            <dt>{action}</dt>
            <dd>{binding}</dd>
          </div>
        ))}
      </dl>
      <button type="button" className="menu-button" onClick={onBack}>
        Back
      </button>
    </section>
  )
}
