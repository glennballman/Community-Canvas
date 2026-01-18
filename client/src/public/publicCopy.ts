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
    reserveNow: "Reserve Now",
  },

  buttons: {
    startReservation: "Start Reservation",
    continueReservation: "Continue Reservation",
    viewStatus: "View Status",
    back: "Back",
    cancel: "Cancel",
    confirm: "Confirm",
    submit: "Submit Request",
    refresh: "Refresh",
    startNewReservation: "Start a New Reservation",
    addAnother: "Add Another Item",
    resumeReservation: "Resume Reservation",
    startOver: "Start Over",
    next: "Next",
    previous: "Previous",
  },

  loading: {
    default: "Loading...",
    checkingAvailability: "Checking availability...",
    processingReservation: "Processing your reservation...",
    loadingOffer: "Loading offer details...",
    loadingCart: "Loading your reservation...",
  },

  empty: {
    noActiveReservation: "No active reservation found",
    noOfferFound: "This offer is not available",
    noPortalFound: "Portal not found",
    sessionExpired: "Your session has expired. Please start a new reservation.",
    noAuthFound: "We couldn't find an active reservation.",
    cartEmpty: "Your reservation is empty.",
  },

  errors: {
    generic: "Something went wrong. Please try again.",
    notFound: "The requested resource was not found.",
    unavailable: "This feature is not available at this time.",
    networkError: "Unable to connect. Please check your connection.",
    invalidToken: "Invalid or expired reservation token.",
    cartLoadFailed: "Failed to load your reservation.",
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
    active: "Active",
    submitted: "Submitted",
    completed: "Completed",
    unknown: "Unknown",
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
    itemCount: (n: number) => n === 1 ? "1 item" : `${n} items`,
  },

  steps: {
    selectDates: "Select Dates",
    selectItems: "Select Items",
    guestDetails: "Guest Details",
    review: "Review",
    payment: "Payment",
    confirmation: "Confirmation",
    // Step router labels
    search: "Search",
    details: "Details",
  },

  stepLabels: {
    search: "Search",
    details: "Details",
    review: "Review",
  },

  lock: {
    submitted: "This reservation has been submitted.",
    completed: "This reservation is complete.",
    expired: "This reservation has expired.",
    locked: "This reservation cannot be modified.",
  },

  banners: {
    submitted: "This reservation has already been submitted and cannot be modified.",
    completed: "This reservation is complete. Thank you!",
    expired: "This reservation has expired. Please start a new one.",
    locked: "This reservation is locked and cannot be modified.",
    cannotChange: "This reservation can't be changed.",
  },

  availability: {
    searchButton: "Search Availability",
    checkIn: "Check-in",
    checkOut: "Check-out",
    date: "Date",
    selectDate: "Select a date",
    guests: "Guests",
    quantity: "Quantity",
    vehicleLength: "Vehicle Size",
    vesselLength: "Vessel Length (ft)",
    power: "Power Requirement",
    noResults: "No availability found for your selected dates.",
    available: "Available",
    capacity: "Capacity",
    addToReservation: "Add to Reservation",
    searchFirst: "Select your dates above to see availability.",
    // Entry point type labels
    lodging: "Lodging",
    parking: "Parking",
    marina: "Marina Slip",
    activity: "Activity",
    equipment: "Equipment Rental",
  },
} as const;

export type PublicCopyKey = keyof typeof publicCopy;
