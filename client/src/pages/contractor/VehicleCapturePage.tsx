/**
 * VehicleCapturePage - Prompt A2
 * Camera-first vehicle + trailer capture
 */

import ContractorIngestionCapture from '@/components/contractor/ContractorIngestionCapture';

export default function VehicleCapturePage() {
  return (
    <ContractorIngestionCapture
      sourceType="vehicle_photo"
      title="Add My Truck & Trailer"
      helperText="Take a photo. We'll figure out the rest."
      allowMultiple={false}
    />
  );
}
