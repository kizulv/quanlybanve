// This file is now used only for pure constants or re-exports if needed.
// Generators have moved to utils/generators.ts
// Mock data has moved to data/seed.ts

export const APP_NAME = "Ticket Manager";
export const DATE_FORMAT = "DD/MM/YYYY";

// Environment Configuration
export const MAIN_DOMAIN = import.meta.env.VITE_APP_MAIN_DOMAIN;
export const MAIN_URL = `https://${MAIN_DOMAIN}`;

export const ORDER_DOMAIN = import.meta.env.VITE_APP_ORDER_DOMAIN;
export const ORDER_URL = `https://${ORDER_DOMAIN}`;

// export const MONGO_URI = import.meta.env.MONGO_URI;
// Backward compatibility (if needed)
export const BASE_URL = ORDER_URL;

// Seat Configuration
export const PRO_FLOOR_SEAT_COUNT_SLEEPER = 6;
export const PRO_FLOOR_SEAT_COUNT_CABIN = 6;
