import './shell.css';

/** Fond vivant et discret : trois halos de couleur qui respirent lentement (CSS seul, sans coût GPU notable). */
export function LivingBackground() {
  return (
    <div className="living-bg" aria-hidden>
      <span className="living-bg__blob living-bg__blob--a" />
      <span className="living-bg__blob living-bg__blob--b" />
      <span className="living-bg__blob living-bg__blob--c" />
    </div>
  );
}
