import { InferSchemaType, model, Schema } from 'mongoose';
import { claimSchema } from './claim';

export const lineItemSchema = new Schema({
  name: String,
  quantity: { type: Number, min: 0 },
  unitPriceCents: { type: Number, min: 0 },
  lineTotalCents: { type: Number, min: 0 },
  claims: [claimSchema],
  aiConfidence: { type: Number, min: 0, max: 1 },
});

export type LineItem = InferSchemaType<typeof lineItemSchema>;
export const LineItem = model('LineItem', lineItemSchema);
