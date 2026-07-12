import { InferSchemaType, model, Schema } from 'mongoose';
import { claimSchema } from './claim';

export const lineItemSchema = new Schema({
  name: String,
  quantity: Number,
  unitPriceCents: Number,
  lineTotalCents: Number,
  claims: [claimSchema],
  aiConfidence: { type: Number, min: 0, max: 1 },
});

export type LineItem = InferSchemaType<typeof lineItemSchema>;
export const LineItem = model('LineItem', lineItemSchema);
