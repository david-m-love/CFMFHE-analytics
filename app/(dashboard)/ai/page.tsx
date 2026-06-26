import { PageHeader } from '@/components/page-header'
import { ComingSoon } from '@/components/coming-soon'

export default function AiPage() {
  return (
    <>
      <PageHeader
        title="Ask Anything"
        description="Natural-language questions answered over your live data, powered by Claude."
        showSource={false}
      />
      <ComingSoon
        phase="Phase 5"
        items={[
          'Chat UI with streaming Claude responses (claude-sonnet-4-6)',
          'Current filtered data snapshot injected as system context',
          'Inline chart rendering when Claude suggests a visualization',
          'Suggested starter questions and clear-conversation control',
        ]}
      />
    </>
  )
}
