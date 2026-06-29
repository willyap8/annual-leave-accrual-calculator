import type { NegativePoint } from '../accrual';
import { formatHuman } from '../dates';

interface Props {
  negative: NegativePoint | null;
}

/** Non-blocking warning shown when the forecast dips below zero. */
export default function WarningBanner({ negative }: Props) {
  if (!negative) return null;
  const entryLabel = negative.entry
    ? negative.entry.label?.trim()
      ? `"${negative.entry.label.trim()}"`
      : `${formatHuman(negative.entry.start)}–${formatHuman(negative.entry.end)}`
    : null;

  return (
    <div className="banner banner-warning" role="alert">
      <strong>Heads up:</strong> your projected balance goes negative on{' '}
      <strong>{formatHuman(negative.date)}</strong> (reaching{' '}
      {negative.balance.toFixed(1)} h)
      {entryLabel ? <> around leave {entryLabel}</> : null}. You can still save this — it’s
      just a warning.
    </div>
  );
}
