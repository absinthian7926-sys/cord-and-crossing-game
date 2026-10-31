import { PLAYER } from '../data/player'
import { usePlayerStore } from '../game/player/playerStore'
function Bar({
  label,
  value,
  max,
  color,
}: {
  label: string
  value: number
  max: number
  color: string
}) {
  const width = Math.max(0, Math.min(100, (value / max) * 100))
  return (
    <div className="hud-bar-wrap">
      <div className="hud-label">
        <span>{label}</span>
        <span>{Math.ceil(value)}</span>
      </div>
      <div className="hud-bar">
        <div
          className="hud-bar-fill"
          style={{ width: `${width}%`, backgroundColor: color }}
        />
      </div>
    </div>
  )
}
export function Hud() {
  const vitals = usePlayerStore((s) => s.vitals),
    invulnerable = usePlayerStore((s) => s.invulnerable)
  return (
    <div className="hud" aria-label="Player status">
      <div className="controls-hint">
        WASD move · Shift run · Space jump · Ctrl or C dodge · Drag to look
      </div>
      <div className="vitals">
        <Bar
          label="Health"
          value={vitals.health}
          max={PLAYER.health.max}
          color="#9f3f37"
        />
        <Bar
          label="Stamina"
          value={vitals.stamina}
          max={PLAYER.stamina.max}
          color="#c8a85a"
        />
        {invulnerable && <div className="dodge-state">DODGE</div>}
      </div>
      <div className="reticle" />
    </div>
  )
}
