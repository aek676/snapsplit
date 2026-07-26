import { createFileRoute } from '@tanstack/react-router';

import { AnalyzeReceipt } from '@/features/analyze-receipt/components/analyze-receipt';

export const Route = createFileRoute('/')({
  component: HomePage,
});

function HomePage() {
  return <AnalyzeReceipt />;
}
