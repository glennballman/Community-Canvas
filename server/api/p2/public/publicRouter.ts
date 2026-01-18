import { Router } from "express";

import { getPublicCart } from "./handlers/publicCart.get";
import { postPublicCartItems } from "./handlers/publicCartItems.post";
import { deletePublicCartItem } from "./handlers/publicCartItem.delete";
import { postPublicCartRefresh } from "./handlers/publicCartRefresh.post";
import { postPublicCartSubmit } from "./handlers/publicCartSubmit.post";

import { getPublicAvailability } from "./handlers/publicAvailability.get";
import { postPublicAvailabilityBatch } from "./handlers/publicAvailabilityBatch.post";

import { postPublicConfirm } from "./handlers/publicConfirm.post";
import { postPublicSubmitConfirm } from "./handlers/publicSubmitConfirm.post";

import { getPublicReservationStatus } from "./handlers/publicReservationStatus.get";
import { getPublicResume } from "./handlers/publicResume.get";

import { postPublicCancelRequest } from "./handlers/publicCancelRequest.post";
import { postPublicReservationChangeRequest } from "./handlers/publicReservationChangeRequest.post";
import { postPublicAllocationCancelRequest } from "./handlers/publicAllocationCancelRequest.post";
import { postPublicAllocationChangeRequest } from "./handlers/publicAllocationChangeRequest.post";

export const publicRouter = Router();

// Cart operations
publicRouter.get("/cart", getPublicCart);
publicRouter.post("/cart/items", postPublicCartItems);
publicRouter.delete("/cart/items/:id", deletePublicCartItem);
publicRouter.post("/cart/refresh", postPublicCartRefresh);
publicRouter.post("/cart/submit", postPublicCartSubmit);

// Availability
publicRouter.get("/availability", getPublicAvailability);
publicRouter.post("/availability/batch", postPublicAvailabilityBatch);

// Confirmation
publicRouter.post("/reservations/confirm", postPublicConfirm);
publicRouter.post("/reservations/submit-confirm", postPublicSubmitConfirm);

// Status & Resume
publicRouter.get("/reservations/status", getPublicReservationStatus);
publicRouter.get("/resume", getPublicResume);

// Cancel & Change requests (request-only, no auto-mutations)
publicRouter.post("/reservations/:id/cancel-request", postPublicCancelRequest);
publicRouter.post("/reservations/:id/change-request", postPublicReservationChangeRequest);
publicRouter.post("/allocations/:id/cancel-request", postPublicAllocationCancelRequest);
publicRouter.post("/allocations/:id/change-request", postPublicAllocationChangeRequest);
