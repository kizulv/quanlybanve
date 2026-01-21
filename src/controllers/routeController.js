import Route from "../models/Route.js";

export const getAllRoutes = async (req, res) => {
  try {
    res.json(await Route.find());
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

export const createRoute = async (req, res) => {
  try {
    const route = new Route(req.body);
    await route.save();
    res.json(route);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

export const updateRoute = async (req, res) => {
  try {
    res.json(
      await Route.findByIdAndUpdate(req.params.id, req.body, { new: true }),
    );
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

export const deleteRoute = async (req, res) => {
  try {
    await Route.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
