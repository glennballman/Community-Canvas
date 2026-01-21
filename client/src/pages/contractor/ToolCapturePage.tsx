/**
 * ToolCapturePage - Prompt A2
 * Camera-first tool capture (supports multiple images)
 */

import ContractorIngestionCapture from '@/components/contractor/ContractorIngestionCapture';

export default function ToolCapturePage() {
  return (
    <ContractorIngestionCapture
      sourceType="tool_photo"
      title="Add My Tools"
      helperText="No lists. Just photos."
      allowMultiple={true}
    />
  );
}
