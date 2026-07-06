import type { FunctionalComponent } from 'preact'

interface LogoProps {
  class?: string
  label: string
  base?: string
}

function withBase(base: string, link: string): string {
  if (/^https?:\/\//.test(link)) return link
  const b = base === '/' ? '' : base.replace(/\/$/, '')
  const l = link.startsWith('/') ? link : `/${link}`
  return `${b}${l}`
}

const Logo: FunctionalComponent<LogoProps> = ({ class: className, label, base = '/' }) => (
  <span class={`ks-logo ${className ?? ''}`.trim()} aria-label={label}>
    <span class="ks-logo__kamod-wrap" aria-hidden="true">
      <img
        src={withBase(base, '/logo-kamod-dark.svg')}
        alt=""
        class="ks-logo__kamod ks-logo__kamod--light"
        decoding="async"
      />
      <img
        src={withBase(base, '/logo-kamod-light.svg')}
        alt=""
        class="ks-logo__kamod ks-logo__kamod--dark"
        decoding="async"
      />
    </span>
    <span class="ks-logo__signals" aria-hidden="true">
      Signals
    </span>
  </span>
)

export default Logo
