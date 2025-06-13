import * as authService from '../services/authService.js';

export const register = async (req, res) => {
  try {
    const user = await authService.registerUser(req.body);
    res.status(201).json({ message: 'User registered', user });
  } catch (err) {
    res
      .status(err.status || 500)
      .json({ error: err.message || 'Server error' });
  }
};

export const login = async (req, res) => {
  try {
    const token = await authService.authenticateUser(req.body);
    res.json({ token });
  } catch (err) {
    res
      .status(err.status || 500)
      .json({ error: err.message || 'Server error' });
  }
};
