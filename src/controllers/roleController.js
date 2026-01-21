import Role from "../models/Role.js";

export const getAllRoles = async (req, res) => {
  try {
    const roles = await Role.find({});
    res.json(roles);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

export const updateRolePermissions = async (req, res) => {
  try {
    const { name } = req.params;
    const { permissions } = req.body;

    if (name === "admin") {
      return res.status(403).json({ error: "Cannot modify admin permissions" });
    }

    const role = await Role.findOne({ name });
    if (!role) {
      const newRole = new Role({ name, permissions });
      await newRole.save();
      return res.json(newRole);
    }

    role.permissions = permissions;
    await role.save();
    res.json(role);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
