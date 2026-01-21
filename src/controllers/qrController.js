import QRGeneral from "../models/QRGeneral.js";

export const getQRGeneral = async (req, res) => {
  try {
    const record = await QRGeneral.findOne().sort({ createdAt: -1 });
    res.json(record || { data: null });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

export const createQRGeneral = async (req, res) => {
  try {
    // Delete all previous records to ensure only 1 exists (or just create new and let get pick latest)
    // Requirement says: "Chỉ tồn tại duy nhất 1 bản ghi" -> Delete all first
    await QRGeneral.deleteMany({});

    const newRecord = new QRGeneral({
      data: req.body,
      status: "pending",
    });
    await newRecord.save();
    res.json(newRecord);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

export const deleteQRGeneral = async (req, res) => {
  try {
    await QRGeneral.deleteMany({});
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

export const simulateQRSuccess = async (req, res) => {
  try {
    const record = await QRGeneral.findOne().sort({ createdAt: -1 });
    if (!record)
      return res.status(404).json({ error: "No active transaction" });

    record.status = "success";
    // Optional: Update payment info in data object if needed
    // record.data.payment.paidTransfer = record.data.payment.totalAmount;

    await record.save();
    res.json({ success: true, record });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
