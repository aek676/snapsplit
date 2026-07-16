import { InferSchemaType, model, Schema } from 'mongoose';
import { lineItemSchema } from './lineItem';
import { participantSchema } from './participant';

export const STATUS = ['draft', 'open', 'closed'] as const;
export type Status = (typeof STATUS)[number];

const sessionSchema = new Schema(
  {
    code: String,
    status: {
      type: String,
      enum: STATUS,
      required: true,
      default: 'draft',
    },
    merchant: String,
    date: Date,
    currency: { type: String, default: 'EUR' },
    totalCents: { type: Number, min: 0, default: 0 },
    receiptImageUrl: { type: String, default: '' },
    closedAt: Date,
    participants: [participantSchema],
    lineItems: [lineItemSchema],
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

sessionSchema.index(
  { code: 1 },
  { unique: true, partialFilterExpression: { code: { $type: 'string' } } },
);
sessionSchema.index({ 'participants.deviceToken': 1 });

export type Session = InferSchemaType<typeof sessionSchema>;
export const Session = model('Session', sessionSchema);
