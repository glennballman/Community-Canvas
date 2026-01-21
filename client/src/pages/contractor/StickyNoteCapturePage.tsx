/**
 * StickyNoteCapturePage - Prompt A2
 * Camera-first sticky note capture (WOW path)
 */

import ContractorIngestionCapture from '@/components/contractor/ContractorIngestionCapture';

export default function StickyNoteCapturePage() {
  return (
    <ContractorIngestionCapture
      sourceType="sticky_note"
      title="Add a Job From a Sticky Note"
      helperText="Snap a photo. We'll turn it into a real job."
      allowMultiple={false}
    />
  );
}
