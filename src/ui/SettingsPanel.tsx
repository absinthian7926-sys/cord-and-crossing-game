import { SETTINGS, type VolumeBus } from '../data/settings'
import { QUALITY_LEVELS, type QualityLevel } from '../data/zone'
import type { SettingsData } from '../game/settings/settings'

export type SettingsPanelSection = 'graphics' | 'volume'

export type SettingsPanelProps = {
  readonly section: SettingsPanelSection
  readonly settings: SettingsData
  readonly onQualityChange: (quality: QualityLevel) => void
  readonly onVolumeChange: (bus: VolumeBus, value: number) => void
  readonly onReduceMotionChange: (value: boolean) => void
  readonly onMouseSensitivityChange: (value: number) => void
  readonly onInvertYChange: (value: boolean) => void
  readonly onBack: () => void
}

const VOLUME_LABELS: Readonly<Record<VolumeBus, string>> = {
  master: 'Master',
  music: 'Music',
  sfx: 'Sound effects',
  ambient: 'Ambient',
}

export function SettingsPanel({
  section,
  settings,
  onQualityChange,
  onVolumeChange,
  onReduceMotionChange,
  onMouseSensitivityChange,
  onInvertYChange,
  onBack,
}: SettingsPanelProps) {
  return (
    <section aria-labelledby="settings-title">
      <h2 id="settings-title">
        {section === 'graphics' ? 'Graphics' : 'Volume'}
      </h2>
      {section === 'graphics' ? (
        <div className="settings-fields">
          <fieldset className="settings-fieldset">
            <legend>Quality</legend>
            <div className="quality-options">
              {QUALITY_LEVELS.map((quality) => (
                <label key={quality}>
                  <input
                    type="radio"
                    name="graphics-quality"
                    value={quality}
                    checked={settings.quality === quality}
                    onChange={() => onQualityChange(quality)}
                  />
                  {quality}
                </label>
              ))}
            </div>
          </fieldset>
          <label className="setting-toggle">
            <input
              type="checkbox"
              checked={settings.reduceMotion}
              onChange={(event) =>
                onReduceMotionChange(event.currentTarget.checked)
              }
            />
            Reduce motion
          </label>
          <label className="setting-slider">
            <span>
              Mouse sensitivity
              <output>{settings.mouseSensitivity.toFixed(1)}x</output>
            </span>
            <input
              type="range"
              min={SETTINGS.mouseSensitivity.minimum}
              max={SETTINGS.mouseSensitivity.maximum}
              step="0.1"
              value={settings.mouseSensitivity}
              onChange={(event) =>
                onMouseSensitivityChange(event.currentTarget.valueAsNumber)
              }
            />
          </label>
          <label className="setting-toggle">
            <input
              type="checkbox"
              checked={settings.invertY}
              onChange={(event) => onInvertYChange(event.currentTarget.checked)}
            />
            Invert Y
          </label>
        </div>
      ) : (
        <div className="settings-fields">
          {(Object.keys(VOLUME_LABELS) as VolumeBus[]).map((bus) => (
            <label className="setting-slider" key={bus}>
              <span>
                {VOLUME_LABELS[bus]}
                <output>{Math.round(settings.volumes[bus])}</output>
              </span>
              <input
                type="range"
                min={SETTINGS.volume.minimum}
                max={SETTINGS.volume.maximum}
                step="1"
                value={settings.volumes[bus]}
                onChange={(event) =>
                  onVolumeChange(bus, event.currentTarget.valueAsNumber)
                }
              />
            </label>
          ))}
        </div>
      )}
      <button type="button" className="menu-button" onClick={onBack}>
        Back
      </button>
    </section>
  )
}
