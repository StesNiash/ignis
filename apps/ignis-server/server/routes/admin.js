const express = require("express");
const { hash } = require("../auth/password");
const {
  getUsers,
  createUser,
  updateUser,
  deleteUser,
  getPermissions,
  getVaultPermissions,
  setVaultPermissions,
} = require("../auth/store");
const { requireRole } = require("../auth/middleware");
const config = require("../config");

const router = express.Router();

router.use(requireRole("admin"));

router.get("/users", (req, res) => {
  const users = getUsers();
  const list = Object.values(users).map((u) => ({
    username: u.username,
    role: u.role,
    createdAt: u.createdAt,
  }));
  res.json(list);
});

router.post("/users", async (req, res) => {
  const { username, password, role } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: "Username and password required" });
  }

  if (username.length < 3 || username.length > 32) {
    return res.status(400).json({ error: "Username must be 3-32 characters" });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters" });
  }

  const validRoles = ["admin", "editor", "reader"];
  const userRole = validRoles.includes(role) ? role : "reader";

  const existing = getUsers()[username];
  if (existing) {
    return res.status(409).json({ error: "User already exists" });
  }

  const passwordHash = await hash(password);
  const user = createUser(username, passwordHash, userRole);

  if (!user) {
    return res.status(500).json({ error: "Failed to create user" });
  }

  res.json({ username: user.username, role: user.role, createdAt: user.createdAt });
});

router.put("/users/:username", async (req, res) => {
  const { username } = req.params;
  const updates = {};

  if (req.body.role) {
    const validRoles = ["admin", "editor", "reader"];
    if (!validRoles.includes(req.body.role)) {
      return res.status(400).json({ error: "Invalid role" });
    }
    updates.role = req.body.role;
  }

  if (req.body.password) {
    if (req.body.password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    }
    updates.passwordHash = await hash(req.body.password);
  }

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: "No valid updates provided" });
  }

  const user = updateUser(username, updates);
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  res.json({ username: user.username, role: user.role });
});

router.delete("/users/:username", (req, res) => {
  const { username } = req.params;

  const users = getUsers();
  const adminCount = Object.values(users).filter((u) => u.role === "admin").length;

  if (users[username]?.role === "admin" && adminCount <= 1) {
    return res.status(400).json({ error: "Cannot delete the last admin user" });
  }

  if (!deleteUser(username)) {
    return res.status(404).json({ error: "User not found" });
  }

  res.json({ ok: true });
});

router.get("/permissions", (req, res) => {
  const perms = getPermissions();
  res.json(perms);
});

router.get("/permissions/:vaultId", (req, res) => {
  const { vaultId } = req.params;
  const vaultPath = config.getVaultPath(vaultId);

  if (!vaultPath) {
    return res.status(404).json({ error: "Vault not found" });
  }

  const vaultPerms = getVaultPermissions(vaultId);
  res.json({ vaultId, ...(vaultPerms || { editors: [], readers: [] }) });
});

router.put("/permissions/:vaultId", (req, res) => {
  const { vaultId } = req.params;
  const vaultPath = config.getVaultPath(vaultId);

  if (!vaultPath) {
    return res.status(404).json({ error: "Vault not found" });
  }

  const { editors, readers } = req.body;

  setVaultPermissions(
    vaultId,
    editors !== undefined || readers !== undefined
      ? { editors: editors || [], readers: readers || [] }
      : null,
  );

  res.json({ ok: true });
});

module.exports = router;
