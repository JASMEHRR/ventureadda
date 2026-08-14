import { motion, useReducedMotion } from 'motion/react'
import type { ReactNode } from 'react'

/**
 * Ascend's standard scroll reveal, spec §6: fades up from 16px, once, firing
 * 60px before the element reaches the viewport edge.
 *
 * `initial={false}` under reduced motion is load-bearing, not a nicety. It
 * renders straight at the target values; leaving `initial={{ opacity: 0 }}` in
 * place means anyone with the OS setting on gets a blank page if the animation
 * never runs. Content visibility must never depend on an animation firing.
 */
export default function Reveal({
  children,
  className = '',
  /** Stagger a group by passing increasing values. Keep it under ~0.3s. */
  delay = 0,
  as = 'div',
}: {
  children: ReactNode
  className?: string
  delay?: number
  as?: 'div' | 'section' | 'li'
}) {
  const reduce = useReducedMotion()
  const Component = motion[as]

  return (
    <Component
      initial={reduce ? false : { opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.5, ease: 'easeOut', delay: reduce ? 0 : delay }}
      className={className}
    >
      {children}
    </Component>
  )
}
