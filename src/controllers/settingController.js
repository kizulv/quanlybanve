import Setting from "../models/Setting.js";
import SystemSettings from "../models/SystemSettings.js";

// --- Setting (Key-Value) ---

export const getSettingByKey = async (req, res) => {
  try {
    const setting = await Setting.findOne({ key: req.params.key });
    res.json(setting ? setting.value : null);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

export const updateSetting = async (req, res) => {
  try {
    const { key, value } = req.body;
    const setting = await Setting.findOneAndUpdate(
      { key },
      { value },
      { upsert: true, new: true },
    );
    res.json(setting.value);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

// --- System Settings (Singleton) ---

export const getSystemSettings = async (req, res) => {
  try {
    let settings = await SystemSettings.findOne();
    if (!settings) {
      settings = new SystemSettings();
      await settings.save();
    }
    res.json(settings);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

export const updateSystemSettings = async (req, res) => {
  try {
    let settings = await SystemSettings.findOne();
    if (!settings) {
      settings = new SystemSettings(req.body);
    } else {
      Object.assign(settings, req.body);
    }
    await settings.save();
    res.json(settings);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
