import Trip from "../models/Trip.js";

export const getAllTrips = async (req, res) => {
  try {
    const { date } = req.query;
    const filter = {};
    if (date) {
      filter.departureTime = { $regex: `^${date}` };
    }
    res.json(await Trip.find(filter));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

export const createTrip = async (req, res) => {
  try {
    const trip = new Trip(req.body);
    await trip.save();
    res.json(trip);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

export const updateTrip = async (req, res) => {
  try {
    res.json(
      await Trip.findByIdAndUpdate(req.params.id, req.body, { new: true }),
    );
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

export const deleteTrip = async (req, res) => {
  try {
    await Trip.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

export const updateTripSeats = async (req, res) => {
  try {
    // DEPRECATED: Seats are no longer stored in Trip.
    // This endpoint is kept for API compatibility but does nothing.
    res.json({ success: true, message: "Deprecated" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
