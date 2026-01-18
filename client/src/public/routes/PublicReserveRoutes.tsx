import { Routes, Route, Navigate } from "react-router-dom";
import OfferLandingPage from "../pages/OfferLandingPage";
import ReserveShell from "../pages/ReserveShell";
import ResumePage from "../pages/ResumePage";
import ReservationStatusPage from "../pages/ReservationStatusPage";
import ConfirmationPage from "../pages/ConfirmationPage";
import SearchStep from "../pages/steps/SearchStep";
import DetailsStep from "../pages/steps/DetailsStep";
import ReviewStep from "../pages/steps/ReviewStep";
import ConfirmStep from "../pages/steps/ConfirmStep";

/**
 * Public reservation routes - no authentication required.
 * 
 * Routes:
 * - /reserve/:portalSlug/:offerSlug → OfferLandingPage (entry-point)
 * - /reserve/:portalSlug/:offerSlug/start → ReserveShell (step router)
 *   - /start/search → SearchStep
 *   - /start/details → DetailsStep
 *   - /start/review → ReviewStep
 *   - /start/confirm → ConfirmStep (identity capture + submit)
 * - /reserve/resume → ResumePage
 * - /reserve/status/:token → ReservationStatusPage
 * - /reserve/confirmation/:token → ConfirmationPage
 */
export function PublicReserveRoutes() {
  return (
    <Routes>
      <Route path="resume" element={<ResumePage />} />
      <Route path="status/:token" element={<ReservationStatusPage />} />
      <Route path="confirmation/:token" element={<ConfirmationPage />} />
      <Route path=":portalSlug/:offerSlug" element={<OfferLandingPage />} />
      <Route path=":portalSlug/:offerSlug/start" element={<ReserveShell />}>
        <Route index element={<Navigate to="search" replace />} />
        <Route path="search" element={<SearchStep />} />
        <Route path="details" element={<DetailsStep />} />
        <Route path="review" element={<ReviewStep />} />
        <Route path="confirm" element={<ConfirmStep />} />
      </Route>
    </Routes>
  );
}

export default PublicReserveRoutes;
