import { createFileRoute } from '@tanstack/react-router';

import { ReceiptCapture } from '@/features/session/components/receipt-capture';

export const Route = createFileRoute('/')({
  component: HomePage,
});

function HomePage() {
  return <ReceiptCapture />;
}
