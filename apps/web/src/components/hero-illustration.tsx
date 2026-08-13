import { cn } from 'shadcn-ui-utils';

import heroIllustration from '@/assets/hero-illustration.jpg';

export function HeroIllustration({ className }: { className?: string }) {
  return (
    <img
      src={heroIllustration}
      alt="Friends around a cafe table sharing a receipt"
      className={cn('h-auto w-full object-cover', className)}
    />
  );
}
