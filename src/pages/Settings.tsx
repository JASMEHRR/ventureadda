import { useId } from 'react'
import { Link } from 'react-router-dom'
import { Bell, Eye, RotateCcw } from 'lucide-react'
import Button from '../components/ui/Button'
import ChoiceGroup from '../components/ui/ChoiceGroup'
import PushToggle from '../components/PushToggle'
import { useAuth } from '../auth/AuthProvider'
import { DEFAULTS, resetAppearance, useAppearance } from '../lib/appearance'
import type { Appearance } from '../lib/appearance'

/**
 * Per-device preferences.
 *
 * NOTHING HERE IS SAVED TO YOUR ACCOUNT, and that is the design rather than a
 * shortcut. Every setting on this page is a property of the screen in front of
 * you: heavier glass on a phone in sunlight, lighter glass on a laptop
 * indoors, notifications on the device you actually carry. Syncing them would
 * make each device fight the last one you touched.
 */

function Slider({
  label,
  hint,
  value,
  min,
  max,
  step,
  format,
  onChange,
}: {
  label: string
  hint: string
  value: number
  min: number
  max: number
  step: number
  /** How the current value reads to a person. Percentages, not raw floats. */
  format: (value: number) => string
  onChange: (value: number) => void
}) {
  const id = useId()
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <label
          htmlFor={id}
          className="font-mono text-[9px] font-extrabold tracking-[0.18em] text-white/40 uppercase"
        >
          {label}
        </label>
        <span className="font-mono text-[11px] font-bold text-brand-400">{format(value)}</span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        // The native control, styled only where it costs nothing. A custom
        // slider would have to reimplement keyboard stepping, page-up/down and
        // the whole touch target, and this one already announces its value.
        className="mt-2 w-full accent-brand-400"
      />
      <p className="mt-1 text-[12.5px] leading-relaxed text-white/40">{hint}</p>
    </div>
  )
}

export default function Settings() {
  const { profile } = useAuth()
  const [appearance, update] = useAppearance()

  const percent = (value: number, of: number) => `${Math.round((value / of) * 100)}%`
  const isDefault = (Object.keys(DEFAULTS) as (keyof Appearance)[]).every(
    (key) => appearance[key] === DEFAULTS[key],
  )

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <header className="liquid-glass-panel rounded-3xl px-5 py-4">
        <h2 className="font-mono text-[10px] font-extrabold tracking-[0.22em] text-brand-400 uppercase">
          Settings
        </h2>
        <p className="mt-2 text-[13.5px] leading-relaxed text-white/50">
          These apply to this device only, and take effect immediately.
        </p>
      </header>

      <section className="liquid-glass-panel space-y-5 rounded-3xl p-5">
        <div className="flex items-center gap-2.5">
          <Eye size={15} className="shrink-0 text-brand-400" aria-hidden="true" />
          <h3 className="text-[15px] font-bold text-white">Appearance</h3>
        </div>

        <Slider
          label="Panel solidity"
          hint="How much the panels stand out from the photo behind them. Turn it up if text is hard to read outdoors."
          value={appearance.glassOpacity}
          min={0.2}
          max={3}
          step={0.1}
          format={(value) => percent(value, 1)}
          onChange={(glassOpacity) => update({ glassOpacity })}
        />

        <Slider
          label="Blur"
          hint="How much the backdrop is blurred behind the panels. Lower is sharper and slightly faster on old phones."
          value={appearance.glassBlur}
          min={0}
          max={40}
          step={1}
          format={(value) => `${value}px`}
          onChange={(glassBlur) => update({ glassBlur })}
        />

        <Slider
          label="Backdrop dimming"
          hint="Darkens the photograph behind everything. The quickest fix for a bright backdrop washing out the text on top of it."
          value={appearance.backdropDim}
          min={0}
          max={0.85}
          step={0.05}
          format={(value) => percent(value, 0.85)}
          onChange={(backdropDim) => update({ backdropDim })}
        />

        <div className="border-t border-white/8 pt-4">
          <ChoiceGroup
            label="Photo slideshows"
            value={appearance.autoPlayPhotos}
            onChange={(autoPlayPhotos) => update({ autoPlayPhotos })}
            choices={[
              {
                value: 'on',
                label: 'Always play',
                detail:
                  'Cards cycle through their photos. With reduced motion set on your device, they change without sliding.',
              },
              {
                value: 'auto',
                label: 'Follow my system',
                detail:
                  'Stop cycling if your device asks apps to reduce motion — which Windows also does when animation effects are off.',
              },
              { value: 'off', label: 'Never', detail: 'Photos change only when you swipe or tap.' },
            ]}
          />
        </div>

        <div className="border-t border-white/8 pt-4">
          <Button variant="secondary" disabled={isDefault} onClick={resetAppearance}>
            <RotateCcw size={13} aria-hidden="true" />
            Reset to defaults
          </Button>
        </div>
      </section>

      <section className="liquid-glass-panel space-y-3 rounded-3xl p-5">
        <div className="flex items-center gap-2.5">
          <Bell size={15} className="shrink-0 text-brand-400" aria-hidden="true" />
          <h3 className="text-[15px] font-bold text-white">Notifications</h3>
        </div>

        {profile ? (
          <>
            <p className="text-[13.5px] leading-relaxed text-white/50">
              Sellers can be told on this device when an order comes in. It is per device, so
              turning it on here does not cover your phone.
            </p>
            {/* Renders nothing at all when push is unconfigured on this
                deployment, which is why the sentence above is written to make
                sense on its own. */}
            <PushToggle uid={profile.uid} />
          </>
        ) : (
          <p className="text-[13.5px] leading-relaxed text-white/50">
            <Link to="/signin" className="text-brand-400 underline underline-offset-2">
              Sign in
            </Link>{' '}
            to turn on order notifications.
          </p>
        )}
      </section>
    </div>
  )
}
