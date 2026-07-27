import { Pencil, Trash2 } from 'lucide-react';
import type { LineItem } from '@/types/session';
import { formatCents } from '@/utils/money';

export const LOW_CONFIDENCE_THRESHOLD = 0.7;

interface LineItemRowProps {
  lineItem: LineItem;
  currency: string;
  onEdit: () => void;
  onDelete: () => void;
  isDeleting: boolean;
}

export function LineItemRow({
  lineItem,
  currency,
  onEdit,
  onDelete,
  isDeleting,
}: LineItemRowProps) {
  const lowConfidence = lineItem.aiConfidence < LOW_CONFIDENCE_THRESHOLD;

  return (
    <li
      className={`relative flex items-center gap-4 border-b border-border px-4 py-5 ${
        lowConfidence ? 'border-l-[3px] border-l-warning' : ''
      }`}
    >
      {lowConfidence && (
        <span className="absolute top-2 left-4 eyebrow text-warning">
          Check this
        </span>
      )}
      <span className={`flex-1 item-name ${lowConfidence ? 'mt-3' : ''}`}>
        {lineItem.name}
      </span>
      <span className="rounded-full bg-surface-alt px-2 py-0.5 text-[13px] font-bold text-content-secondary tabular-nums">
        x{lineItem.quantity}
      </span>
      <span className="w-20 text-right price-total">
        {formatCents(lineItem.lineTotalCents, currency)}
      </span>
      <button
        type="button"
        aria-label={`Edit ${lineItem.name}`}
        onClick={onEdit}
        className="flex h-11 w-11 items-center justify-center rounded-full text-primary transition-colors hover:bg-primary-tint/50"
      >
        <Pencil size={20} />
      </button>
      <button
        type="button"
        aria-label={`Delete ${lineItem.name}`}
        onClick={onDelete}
        disabled={isDeleting}
        className="flex h-11 w-11 items-center justify-center rounded-full text-error transition-colors hover:bg-error/10 disabled:opacity-50"
      >
        <Trash2 size={20} />
      </button>
    </li>
  );
}
