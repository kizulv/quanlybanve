import Bus from "../models/Bus.js";

export const getAllBuses = async (req, res) => {
  try {
    res.json(await Bus.find());
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

export const createBus = async (req, res) => {
  try {
    const bus = new Bus(req.body);
    await bus.save();
    res.json(bus);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

export const updateBus = async (req, res) => {
  try {
    res.json(
      await Bus.findByIdAndUpdate(req.params.id, req.body, { new: true }),
    );
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

export const deleteBus = async (req, res) => {
  try {
    await Bus.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
