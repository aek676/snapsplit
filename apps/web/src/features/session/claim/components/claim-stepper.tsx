import { MinusIcon, PlusIcon } from 'lucide-react';
import { Button } from 'shadcn-ui/button';
import { ButtonGroup, ButtonGroupText } from 'shadcn-ui/button-group';

type ClaimStepperProps = {
  itemName: string;
  units: number;
  canIncrement: boolean;
  disabled?: boolean;
  onChange: (units: number) => void;
};

export function ClaimStepper({
  itemName,
  units,
  canIncrement,
  disabled,
  onChange,
}: ClaimStepperProps) {
  return (
    <ButtonGroup>
      <Button
        variant="outline"
        size="icon"
        aria-label={`Claim one less ${itemName}`}
        disabled={disabled || units === 0}
        onClick={() => onChange(units - 1)}
      >
        <MinusIcon />
      </Button>
      <ButtonGroupText>{units}</ButtonGroupText>
      <Button
        variant="outline"
        size="icon"
        aria-label={`Claim one more ${itemName}`}
        disabled={disabled || !canIncrement}
        onClick={() => onChange(units + 1)}
      >
        <PlusIcon />
      </Button>
    </ButtonGroup>
  );
}
