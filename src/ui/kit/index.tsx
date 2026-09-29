import { AnimatePresence, motion, useReducedMotion, type HTMLMotionProps } from 'framer-motion';
import { useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { spring, staggerDelay } from '@/theme/motion/tokens';
import { useBackClose } from './backClose';
import { IconBack, IconChevron } from './icons';
import './kit.css';

export { Segmented } from '@/ui/import/Segmented';
export { Slider } from '@/ui/import/Slider';
export { Switch } from '@/ui/import/Switch';
import '@/ui/import/import.css';

/**
 * Écran d'onglet ou de sous-page : grand titre qui se replie en barre au défilement,
 * contenu défilant avec la place de la barre de navigation en bas.
 */
export function Screen({
  title,
  onBack,
  actions,
  children,
  className = '',
}: {
  title: string;
  onBack?: () => void;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  return (
    <div className={`screen ${className}`}>
      <header className="screen__bar" data-collapsed={collapsed}>
        {onBack && (
          <IconButton label="Retour" onClick={onBack}>
            <IconBack />
          </IconButton>
        )}
        <motion.span
          className="screen__bar-title"
          animate={{ opacity: collapsed ? 1 : 0, y: collapsed ? 0 : 6 }}
        >
          {title}
        </motion.span>
        <span className="screen__actions">{actions}</span>
      </header>
      <div
        className="screen__scroll"
        ref={scroller}
        onScroll={(e) => {
          setCollapsed(e.currentTarget.scrollTop > 40);
        }}
      >
        <h1 className="screen__title">{title}</h1>
        {children}
      </div>
    </div>
  );
}

export function IconButton({
  label,
  children,
  ...rest
}: { label: string; children: ReactNode } & Omit<HTMLMotionProps<'button'>, 'children'>) {
  return (
    <motion.button
      className="kit-icon-btn"
      aria-label={label}
      whileTap={{ scale: 0.86 }}
      transition={{ type: 'spring', ...spring.snappy }}
      {...rest}
    >
      {children}
    </motion.button>
  );
}

export function Button({
  variant = 'tonal',
  children,
  ...rest
}: { variant?: 'filled' | 'tonal' | 'text'; children: ReactNode } & Omit<
  HTMLMotionProps<'button'>,
  'children'
>) {
  return (
    <motion.button
      className={`kit-btn kit-btn--${variant}`}
      whileTap={{ scale: 0.95 }}
      transition={{ type: 'spring', ...spring.snappy }}
      {...rest}
    >
      {children}
    </motion.button>
  );
}

/** Carte : surface arrondie, apparition en cascade selon son rang (`index`). */
export function Card({
  index = 0,
  children,
  className = '',
  onClick,
}: {
  index?: number;
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  const reduced = useReducedMotion();
  const Tag = onClick ? motion.button : motion.div;
  return (
    <Tag
      className={`kit-card ${className}`}
      initial={reduced ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', ...spring.gentle, delay: staggerDelay(index) / 1000 }}
      {...(onClick && { whileTap: { scale: 0.97 }, onClick })}
    >
      {children}
    </Tag>
  );
}

export function Chip({
  selected = false,
  children,
  onClick,
}: {
  selected?: boolean;
  children: ReactNode;
  onClick?: () => void;
}) {
  return (
    <motion.button className="kit-chip" aria-pressed={selected} whileTap={{ scale: 0.92 }} onClick={onClick}>
      {children}
    </motion.button>
  );
}

export function SectionHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="kit-section">
      <h2>{title}</h2>
      {action}
    </div>
  );
}

/** Ligne de liste (réglages, menus) ; flèche si elle ouvre une sous-page. */
export function ListRow({
  icon,
  title,
  subtitle,
  trailing,
  onClick,
}: {
  icon?: ReactNode;
  title: string;
  subtitle?: string;
  trailing?: ReactNode;
  onClick?: () => void;
}) {
  const content = (
    <>
      {icon && <span className="kit-row__icon">{icon}</span>}
      <span className="kit-row__text">
        <strong>{title}</strong>
        {subtitle && <small>{subtitle}</small>}
      </span>
      {trailing ?? (onClick && <IconChevron size={18} />)}
    </>
  );
  return onClick ? (
    <motion.button className="kit-row" whileTap={{ scale: 0.98 }} onClick={onClick}>
      {content}
    </motion.button>
  ) : (
    <div className="kit-row">{content}</div>
  );
}

/** Anneau de progression (0–1). */
export function ProgressRing({
  value,
  size = 44,
  stroke = 4,
  color = 'var(--primary)',
  children,
}: {
  value: number;
  size?: number;
  stroke?: number;
  color?: string;
  children?: ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <span className="kit-ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }} aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--outline)" strokeWidth={stroke} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={false}
          animate={{ strokeDashoffset: c * (1 - Math.min(1, Math.max(0, value))) }}
          transition={{ type: 'spring', ...spring.gentle }}
        />
      </svg>
      {children && <span className="kit-ring__inner">{children}</span>}
    </span>
  );
}

/** Squelette animé pendant un chargement (jamais d'écran vide). */
export function Skeleton({
  width = '100%',
  height = 16,
  radius = 10,
}: {
  width?: number | string;
  height?: number | string;
  radius?: number;
}) {
  return <span className="kit-skeleton" style={{ width, height, borderRadius: radius }} aria-hidden />;
}

export function Badge({ children }: { children: ReactNode }) {
  return <span className="kit-badge">{children}</span>;
}

export function EmptyState({
  icon,
  title,
  text,
  action,
}: {
  icon?: ReactNode;
  title: string;
  text?: string;
  action?: ReactNode;
}) {
  return (
    <div className="kit-empty">
      {icon && <span className="kit-empty__icon">{icon}</span>}
      <strong>{title}</strong>
      {text && <p>{text}</p>}
      {action}
    </div>
  );
}

/** Feuille du bas : ressort naturel, fermeture en glissant vers le bas ou en touchant le voile. */
export function Sheet({
  open,
  onClose,
  label,
  children,
}: {
  open: boolean;
  onClose: () => void;
  label: string;
  children: ReactNode;
}) {
  useBackClose(open, onClose);
  // rendue dans <body> : au-dessus de la barre d'onglets et des sous-pages
  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="kit-scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.section
            className="kit-sheet"
            role="dialog"
            aria-label={label}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', ...spring.sheet }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 110 || info.velocity.y > 600) onClose();
            }}
          >
            <div className="kit-sheet__grip" />
            {children}
          </motion.section>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}
