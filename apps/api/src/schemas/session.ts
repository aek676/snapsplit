import { type InferSchemaType, model, Schema } from 'mongoose';
import { lineItemSchema } from './lineItem';
import { participantSchema } from './participant';

export const STATUS = ['draft', 'open', 'closed'] as const;

export const TOTAL_SOURCE = ['receipt', 'items'] as const;
export type TotalSource = (typeof TOTAL_SOURCE)[number];

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
    totalSource: {
      type: String,
      enum: TOTAL_SOURCE,
      required: true,
      default: 'receipt',
    },
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
sessionSchema.index({ 'participants.deviceTokenHash': 1 });
// 90 days — keep in sync with the GCS lifecycle rule (docs/deployment.md).
sessionSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 3600 });

export type Session = InferSchemaType<typeof sessionSchema>;
export const Session = model('Session', sessionSchema);
