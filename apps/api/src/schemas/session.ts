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
    currency: String,
    totalCents: Number,
    receiptImageUrl: String,
    closedAt: Date,
    participants: [participantSchema],
    lineItems: [lineItemSchema],
  },
  { timestamps: { createdAt: 'createdAt', updatedAt: false } },
);

sessionSchema.index({ code: 1 }, { unique: true });
sessionSchema.index({ 'participants.deviceToken': 1 });

export type Session = InferSchemaType<typeof sessionSchema>;
export const Session = model('Session', sessionSchema);
