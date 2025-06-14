import * as authService from "../services/authService.js";

export const register = async (req, res) => {
  try {
    const foundationId = req.user.foundationId;
    const { roles, ...rest } = req.body;

    const user = await authService.registerUser(
      { ...rest, role: roles?.[0] }, // extract first role
      foundationId
    );

    res.status(201).json({ message: "User registered", user });
  } catch (err) {
    res
      .status(err.status || 500)
      .json({ error: err.message || "Server error" });
  }
};

export const login = async (req, res) => {
  try {
    const token = await authService.authenticateUser(req.body);
    res.json({ token });
  } catch (err) {
    res
      .status(err.status || 500)
      .json({ error: err.message || "Server error" });
  }
};
