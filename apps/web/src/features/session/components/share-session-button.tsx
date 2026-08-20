import type { ComponentProps } from 'react';

import { Button } from 'shadcn-ui/button';
import { toast } from 'shadcn-ui/toast';

type ShareSessionButtonProps = ComponentProps<typeof Button>;

export function ShareSessionButton(props: ShareSessionButtonProps) {
  const share = async () => {
    const url = window.location.href;

    try {
      if (navigator.share) {
        await navigator.share({ url });
        return;
      }
      await navigator.clipboard.writeText(url);
      toast.add({ type: 'success', title: 'Link copied' });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      toast.add({
        type: 'error',
        title: 'Error',
        description: "Couldn't share the link",
      });
    }
  };

  return <Button onClick={share} {...props} />;
}
