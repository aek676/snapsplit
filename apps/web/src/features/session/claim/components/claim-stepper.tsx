import { MinusIcon, PlusIcon } from 'lucide-react';
import { Button } from 'shadcn-ui/button';
import { ButtonGroup, ButtonGroupText } from 'shadcn-ui/button-group';

type ClaimStepperProps = {
  itemName: string;
  units: number;
  remaining: number;
  disabled?: boolean;
  onChange: (units: number) => void;
};

export function ClaimStepper({
  itemName,
  units,
  remaining,
  disabled,
  onChange,
}: ClaimStepperProps) {
  return (
    <ButtonGroup>
      <Button
        size="icon"
        aria-label={`Claim one less ${itemName}`}
        disabled={disabled || units === 0}
        onClick={() => onChange(units - 1)}
      >
        <MinusIcon />
      </Button>
      <ButtonGroupText className="min-w-12 justify-center bg-surface">
        {remaining} left
      </ButtonGroupText>
      <Button
        size="icon"
        aria-label={`Claim one more ${itemName}`}
        disabled={disabled || remaining === 0}
        onClick={() => onChange(units + 1)}
      >
        <PlusIcon />
      </Button>
    </ButtonGroup>
  );
}
