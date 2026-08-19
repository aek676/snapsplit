import { cn } from 'shadcn-ui-utils';

export function Wordmark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'font-serif text-[22px] font-semibold tracking-tight text-content-primary',
        className,
      )}
    >
      Snap<span className="text-primary">Split</span>
    </span>
  );
}
