import express from "express";
import {
  getSettingByKey,
  updateSetting,
  getSystemSettings,
  updateSystemSettings,
} from "../controllers/settingController.js";
import { verifyToken, isAdmin } from "../middleware/auth.js";

const router = express.Router();

// Public or Protected?
// In server.js they were just app.get/app.post without explicit middleware,
// likely taking advantage of global middleware or public access.
// However, `updateSetting` generally should be protected.
// `server.js` didn't have specific auth middleware on them shown in previous snippets.
// But mostly these are admin functions.
// For now I will match server.js which seemed open or relied on something else?
// Wait, generic Middleware in server.js?
// I'll keep them open for now to match behavior, or add verifyToken if I see fit.
// Given strict modularization, I should probably check if auth was applied globally.
// In `src/app.js`, no global auth middleware is applied to `/api/*`.
// So `server.js` endpoints were PUBLIC. I will keep them PUBLIC to avoid breaking changes,
// unless I am sure.
// BUT, `updateSystemSettings` definitely feels like it should be admin only.
// The user didn't ask me to secure them, but to modularize.
// I will replicate `server.js` behavior: No explicit middleware shown in snippet.

router.get("/settings/:key", getSettingByKey);
router.post("/settings", updateSetting);

router.get("/system-settings", getSystemSettings);
router.put("/system-settings", updateSystemSettings);

export default router;
