const authService = require('../services/authService');
const { sendSuccess, sendError } = require('../utils/response');

// ─── Master Login — no school_id required ─────────────────────────────────────
const masterLogin = async (req, res, next) => {
  try {
    const { email, password } = req.body
    if (!email || !password) return sendError(res, 'Email and password are required', 400)
 
    const User      = require('../models/User')
    const { UserRole, Role } = require('../models/Role')
    const bcrypt    = require('bcryptjs')
    const { generateAccessToken, generateRefreshToken, storeRefreshToken } = require('../utils/jwt')
 
    // // Find user by email only — across all schools
    // const user = await User.findOne({ email, is_deleted: false, is_active: true })
    // if (!user) return sendError(res, 'Invalid credentials', 401)
 
    // // Check password
    // const valid = await bcrypt.compare(password, user.password_hash)
    // if (!valid) return sendError(res, 'Invalid credentials', 401)
    // Find user by email only — across all schools
    const user = await User.findOne({
      email,
      is_active: true,
    }).select('+password_hash')

    console.log('EMAIL:', email)
    console.log('USER FOUND:', !!user)
    console.log('PASSWORD HASH EXISTS:', !!user?.password_hash)

    if (!user || !user.password_hash) {
      return sendError(res, 'Invalid credentials', 401)
    }

    // Check password
    const valid = await bcrypt.compare(password, user.password_hash)

    if (!valid) {
      return sendError(res, 'Invalid credentials', 401)
    }
 
    // Get roles — must be super_admin
    const userRoles = await UserRole.find({ user_id: user._id }).populate('role_id')
    const roles     = userRoles.map(ur => ur.role_id?.slug).filter(Boolean)
 
    if (!roles.includes('master')) {
      return sendError(res, 'Access denied. Master only.', 403)
    }
 
    // Generate tokens
    const payload = { userId: user._id, schoolId: user.school_id, email: user.email }
    const accessToken  = generateAccessToken(payload)
    const refreshToken = generateRefreshToken(payload)
    await storeRefreshToken(user._id, refreshToken)
 
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure:   process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge:   7 * 24 * 60 * 60 * 1000,
    })
 
    sendSuccess(res, {
      user:         { _id: user._id, name: user.name, email: user.email, school_id: user.school_id },
      roles,
      access_token: accessToken,
    }, 'Master login successful')
  } catch (err) { next(err) }
}

const login = async (req, res, next) => {
  try {
    const { email, password, school_id } = req.body;
    if (!email || !password || !school_id) {
      return sendError(res, 'Email, password and school_id are required', 400);
    }
    const result = await authService.login({ email, password, school_id });

    // Set refresh token as httpOnly cookie
    console.log(process.env.NODE_ENV)
    res.cookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    sendSuccess(res, {
      user:         result.user,
      roles:        result.roles,
      access_token: result.accessToken,
    }, 'Login successful');
  } catch (err) { next(err); }
};

const refresh = async (req, res, next) => {
  try {
    const token = req.cookies?.refreshToken || req.body.refresh_token;
    if (!token) return sendError(res, 'Refresh token required', 401);

    const tokens = await authService.refreshTokens(token);

    res.cookie('refreshToken', tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    sendSuccess(res, { access_token: tokens.accessToken }, 'Token refreshed');
  } catch (err) { next(err); }
};

const logout = async (req, res, next) => {
  try {
    await authService.logout(req.user._id);
    res.clearCookie('refreshToken');
    sendSuccess(res, {}, 'Logged out successfully');
  } catch (err) { next(err); }
};

const changePassword = async (req, res, next) => {
  try {
    await authService.changePassword(req.user._id, req.body);
    sendSuccess(res, {}, 'Password changed successfully');
  } catch (err) { next(err); }
};

const me = async (req, res, next) => {
  try {
    sendSuccess(res, { user: req.user }, 'Profile fetched');
  } catch (err) { next(err); }
};

module.exports = { login, masterLogin, refresh, logout, changePassword, me };
