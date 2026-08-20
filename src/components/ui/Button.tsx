import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Loader2 } from 'lucide-react'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'whatsapp'

/**
 * Shared shape from Ascend spec §5: pill, uppercase, bold, wide-tracked, 12px.
 * `transition` rather than `transition-colors` because Tailwind v4's default
 * transition property list covers transform too, which the press scale needs.
 */
const base =
  'inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 ' +
  'text-[13.5px] font-bold uppercase tracking-wider transition duration-150 ' +
  'active:scale-[0.97] disabled:pointer-events-none disabled:opacity-40'

const variants: Record<ButtonVariant, string> = {
  // §5 table, verbatim.
  primary: 'bg-brand-500/15 text-brand-300 border border-brand-500/30 hover:bg-brand-500/25',
  secondary: 'bg-white/5 text-white/80 border border-white/12 hover:bg-white/10 hover:text-white',
  ghost: 'text-white/55 border border-transparent hover:text-white',

  // Spec GAP. Ascend does destructive actions with ad-hoc inline red classes;
  // this mirrors primary's construction exactly with red substituted, so it
  // reads as the same system rather than a bolt-on.
  danger: 'bg-red-500/15 text-red-400 border border-red-500/30 hover:bg-red-500/25',

  // VentureAdda departure. Solid rather than the tinted construction above:
  // the entire point is that people recognise #25D366 instantly and know what
  // the button does before reading it. A 15% wash would lose that. Scoped
  // strictly to WhatsApp CTAs — every other accent in the app stays cyan.
  whatsapp: 'bg-whatsapp text-black border border-whatsapp hover:bg-whatsapp/85',
}

type CommonProps = {
  variant?: ButtonVariant
  children: ReactNode
  className?: string
}

/**
 * A call to action that navigates is a link, not a button — it has to work with
 * middle-click, ctrl-click and "copy link address", and a button does none of
 * those. Before this existed, four pages hand-rolled the pill classes onto a
 * Link to get there, which is how they drifted apart.
 *
 * `to` is internal (React Router), `href` is external (a plain anchor). Neither
 * takes `loading` or `disabled`: there is no such thing as a disabled link, and
 * faking one with pointer-events leaves it in the tab order.
 */
type ButtonProps = CommonProps & {
  to?: undefined
  href?: undefined
  loading?: boolean
} & ButtonHTMLAttributes<HTMLButtonElement>

type LinkProps = CommonProps & {
  to: string
} & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'>

type ExternalProps = CommonProps & {
  href: string
} & AnchorHTMLAttributes<HTMLAnchorElement>

export default function Button(props: ButtonProps | LinkProps | ExternalProps) {
  const { variant = 'primary', className = '', children } = props

  if ('to' in props && props.to !== undefined) {
    const { to, variant: _variant, className: _className, children: _children, ...rest } = props
    return (
      <Link to={to} className={`${base} ${variants[variant]} ${className}`} {...rest}>
        {children}
      </Link>
    )
  }

  if ('href' in props && props.href !== undefined) {
    const { variant: _variant, className: _className, children: _children, ...rest } = props
    return (
      <a className={`${base} ${variants[variant]} ${className}`} {...rest}>
        {children}
      </a>
    )
  }

  const {
    variant: _variant,
    className: _className,
    children: _children,
    loading = false,
    disabled,
    ...rest
  } = props as ButtonProps

  return (
    <button
      type="button"
      // `||`, not `??`. With `??`, the ordinary form case
      // `disabled={!formValid} loading={submitting}` passes `false` once the
      // form is valid, and `false ?? true` is `false` — leaving the button
      // live for the whole submit, so a double tap submits twice.
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`${base} ${variants[variant]} ${className}`}
      {...rest}
    >
      {loading && <Loader2 size={13} className="animate-spin" aria-hidden="true" />}
      {children}
    </button>
  )
}
