/**
 * Centralized public-facing copy for reservation flows.
 * 
 * IMPORTANT: Never use "book" or "booking" - use "reserve" and "reservation" only.
 * This is enforced by CI via scripts/forbidden-words-check.ts
 */

export const publicCopy = {
  titles: {
    reserve: "Reserve",
    reservation: "Reservation",
    resumeReservation: "Resume Reservation",
    reservationStatus: "Reservation Status",
    confirmReservation: "Confirm Reservation",
    reservationConfirmed: "Reservation Confirmed",
  },

  buttons: {
    startReservation: "Start Reservation",
    continueReservation: "Continue Reservation",
    viewStatus: "View Status",
    back: "Back",
    cancel: "Cancel",
    confirm: "Confirm",
    submit: "Submit Request",
  },

  loading: {
    default: "Loading...",
    checkingAvailability: "Checking availability...",
    processingReservation: "Processing your reservation...",
    loadingOffer: "Loading offer details...",
  },

  empty: {
    noActiveReservation: "No active reservation found",
    noOfferFound: "This offer is not available",
    noPortalFound: "Portal not found",
    sessionExpired: "Your session has expired. Please start a new reservation.",
  },

  errors: {
    generic: "Something went wrong. Please try again.",
    notFound: "The requested resource was not found.",
    unavailable: "This feature is not available at this time.",
    networkError: "Unable to connect. Please check your connection.",
    invalidToken: "Invalid or expired reservation token.",
  },

  disclaimers: {
    requestOnly: "This is a reservation request. Confirmation is subject to availability and operator approval.",
    instantConfirm: "Your reservation will be confirmed immediately upon completion.",
    paymentRequired: "Payment is required to complete your reservation.",
    noChargeUntilConfirmed: "You will not be charged until your reservation is confirmed.",
  },

  status: {
    pending: "Pending",
    confirmed: "Confirmed",
    cancelled: "Cancelled",
    expired: "Expired",
    awaitingApproval: "Awaiting Approval",
  },

  confirmation: {
    title: "Reservation Confirmed",
    thankYou: "Thank you for your reservation!",
    referenceLabel: "Reference Number",
    detailsLabel: "Reservation Details",
    nextSteps: "What happens next?",
    contactInfo: "If you have questions, please contact the operator.",
  },

  cart: {
    yourReservation: "Your Reservation",
    summary: "Summary",
    total: "Total",
    addItem: "Add Item",
    removeItem: "Remove",
    empty: "Your cart is empty",
  },

  steps: {
    selectDates: "Select Dates",
    selectItems: "Select Items",
    guestDetails: "Guest Details",
    review: "Review",
    payment: "Payment",
    confirmation: "Confirmation",
  },
} as const;

export type PublicCopyKey = keyof typeof publicCopy;
