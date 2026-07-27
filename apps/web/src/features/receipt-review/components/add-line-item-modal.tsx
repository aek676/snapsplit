import { useForm } from '@tanstack/react-form';
import { Minus, Plus } from 'lucide-react';

import { Button } from 'shadcn-ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from 'shadcn-ui/dialog';
import { Field, FieldError, FieldGroup, FieldLabel } from 'shadcn-ui/field';
import { Input } from 'shadcn-ui/input';

import { CurrencyInput } from '@/components/ui/form/currency-input';
import {
  type AddLineItemDraftInput,
  addLineItemDraftInputSchema,
} from '@/features/receipt-review/api/add-line-item';

type AddLineItemModalProps = {
  currency: string;
  isSaving: boolean;
  onSave: (draft: AddLineItemDraftInput) => void;
  onCancel: () => void;
};

export function AddLineItemModal({
  currency,
  isSaving,
  onSave,
  onCancel,
}: AddLineItemModalProps) {
  const form = useForm({
    defaultValues: {
      name: '',
      unitPriceCents: 0,
      quantity: 1,
    },
    validators: {
      onSubmit: addLineItemDraftInputSchema,
    },
    onSubmit: async ({ value }) => {
      onSave(value);
    },
  });

  return (
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="sm:max-w-100" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle className="screen-title">Add item</DialogTitle>
        </DialogHeader>
        <form
          className="contents"
          onSubmit={(event) => {
            event.preventDefault();
            form.handleSubmit();
          }}
        >
          <FieldGroup>
            <form.Field name="name">
              {(field) => {
                const isInvalid =
                  field.state.meta.isTouched && !field.state.meta.isValid;
                return (
                  <Field data-invalid={isInvalid}>
                    <FieldLabel variant="eyebrow" htmlFor={field.name}>
                      Name
                    </FieldLabel>
                    <Input
                      id={field.name}
                      name={field.name}
                      type="text"
                      variant="field"
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(event) =>
                        field.handleChange(event.target.value)
                      }
                      aria-invalid={isInvalid}
                    />
                    {isInvalid && (
                      <FieldError errors={field.state.meta.errors} />
                    )}
                  </Field>
                );
              }}
            </form.Field>
            <div className="flex gap-3">
              <form.Field name="unitPriceCents">
                {(field) => {
                  const isInvalid =
                    field.state.meta.isTouched && !field.state.meta.isValid;
                  return (
                    <Field className="flex-1" data-invalid={isInvalid}>
                      <FieldLabel variant="eyebrow" htmlFor={field.name}>
                        Unit price
                      </FieldLabel>
                      <CurrencyInput
                        id={field.name}
                        currency={currency}
                        value={field.state.value}
                        onChange={(cents) => field.handleChange(cents)}
                      />
                      {isInvalid && (
                        <FieldError errors={field.state.meta.errors} />
                      )}
                    </Field>
                  );
                }}
              </form.Field>
              <form.Field name="quantity">
                {(field) => (
                  <Field className="flex-1">
                    <FieldLabel variant="eyebrow">Quantity</FieldLabel>
                    <div className="flex items-center justify-between rounded-xl bg-surface-alt px-4 py-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Decrease quantity"
                        onClick={() =>
                          field.handleChange(Math.max(1, field.state.value - 1))
                        }
                        className="text-primary"
                      >
                        <Minus size={20} />
                      </Button>
                      <span className="item-name tabular-nums">
                        {field.state.value}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Increase quantity"
                        onClick={() =>
                          field.handleChange(field.state.value + 1)
                        }
                        className="text-primary"
                      >
                        <Plus size={20} />
                      </Button>
                    </div>
                  </Field>
                )}
              </form.Field>
            </div>
          </FieldGroup>
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="ghost" size="xl" onClick={onCancel}>
              Cancel
            </Button>
            <form.Subscribe
              selector={(s) => ({
                canSubmit: s.canSubmit,
              })}
            >
              {({ canSubmit }) => (
                <Button
                  type="submit"
                  size="xl"
                  disabled={!canSubmit || isSaving}
                >
                  Save
                </Button>
              )}
            </form.Subscribe>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
