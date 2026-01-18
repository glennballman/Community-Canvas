import { Routes, Route } from "react-router-dom";
import OfferLandingPage from "../pages/OfferLandingPage";
import ReserveShell from "../pages/ReserveShell";
import ResumePage from "../pages/ResumePage";
import ReservationStatusPage from "../pages/ReservationStatusPage";
import ConfirmationPage from "../pages/ConfirmationPage";

/**
 * Public reservation routes - no authentication required.
 * 
 * Routes:
 * - /reserve/:portalSlug/:offerSlug → OfferLandingPage (entry-point)
 * - /reserve/:portalSlug/:offerSlug/start → ReserveShell (step router)
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
      <Route path=":portalSlug/:offerSlug/start" element={<ReserveShell />} />
    </Routes>
  );
}

export default PublicReserveRoutes;
