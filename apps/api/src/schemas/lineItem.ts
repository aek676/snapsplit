import { type InferSchemaType, Schema } from 'mongoose';
import { claimSchema } from './claim';

export const lineItemSchema = new Schema({
  name: { type: String, required: true },
  quantity: { type: Number, min: 0, default: 0 },
  unitPriceCents: { type: Number, min: 0, default: 0 },
  lineTotalCents: { type: Number, min: 0, default: 0 },
  claims: [claimSchema],
  aiConfidence: { type: Number, min: 0, max: 1, default: 0 },
});

export type LineItem = InferSchemaType<typeof lineItemSchema>;
