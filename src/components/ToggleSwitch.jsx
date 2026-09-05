// Styled replacement for a raw <input type="checkbox">, which
// otherwise renders as the browser's own default control — the last
// place in the settings pages still showing that, everywhere else on
// the site (buttons, tabs, cards) already got the premium pass.
export default function ToggleSwitch({ checked, onChange, disabled = false }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={'toggle-switch' + (checked ? ' checked' : '')}
    >
      <span className="toggle-switch-thumb" />
    </button>
  )
}
