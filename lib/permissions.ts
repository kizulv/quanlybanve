export const PERMISSIONS = {
  // Core Features
  VIEW_SALES: "VIEW_SALES",
  VIEW_SCHEDULE: "VIEW_SCHEDULE",
  VIEW_ORDER_INFO: "VIEW_ORDER_INFO",

  // Management
  VIEW_FINANCE: "VIEW_FINANCE",
  MANAGE_USERS: "MANAGE_USERS",
  MANAGE_SETTINGS: "MANAGE_SETTINGS",

  // Actions
  CREATE_TRIP: "CREATE_TRIP",
  UPDATE_TRIP: "UPDATE_TRIP",
  DELETE_TRIP: "DELETE_TRIP",
  BOOK_TICKET: "BOOK_TICKET",
};

export const ROLE_PERMISSIONS: Record<string, string[]> = {
  guest: [
    PERMISSIONS.VIEW_SALES,
    PERMISSIONS.VIEW_SCHEDULE, // Guest can view schedule? Maybe just Order Info?
    // Request said: "Guest can access Ticket Search (Tra cứu vé)".
    // Usually Guests might also want to see the "Sales" (Seat Map) to see available seats, but maybe not book?
    // Let's interpret "Guest" strictly as "Public User" first.
    // However, the current code has roles: ["admin", "sale", "guest"] for Sales/Schedule/OrderInfo.
    // So I will maintain that access.
    PERMISSIONS.VIEW_ORDER_INFO,
  ],
  sale: [
    PERMISSIONS.VIEW_SALES,
    PERMISSIONS.VIEW_SCHEDULE,
    PERMISSIONS.VIEW_ORDER_INFO,
    PERMISSIONS.BOOK_TICKET,
  ],
  admin: [
    // Admin has everything
    PERMISSIONS.VIEW_SALES,
    PERMISSIONS.VIEW_SCHEDULE,
    PERMISSIONS.VIEW_ORDER_INFO,
    PERMISSIONS.VIEW_FINANCE,
    PERMISSIONS.MANAGE_USERS,
    PERMISSIONS.MANAGE_SETTINGS,
    PERMISSIONS.CREATE_TRIP,
    PERMISSIONS.UPDATE_TRIP,
    PERMISSIONS.DELETE_TRIP,
    PERMISSIONS.BOOK_TICKET,
  ],
};
