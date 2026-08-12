const express = require('express');
const router  = express.Router();
const User    = require('../models/User');
const { authenticate, permissionGuard } = require('../middlewares/authMiddleware');
const { upload, cloudinary } = require('../config/cloudinary');
const { sendSuccess, sendError } = require('../utils/response');
const createCrudController = require('../controllers/crudController');
const createCrudService    = require('../services/crudService');

const ctrl = createCrudController(createCrudService(User), 'User');

router.use(authenticate);

// ─── Avatar routes MUST come before /:id to avoid conflict ───────────────────
router.post('/avatar/upload', upload('avatars').single('avatar'), async (req, res, next) => {
  try {
    if (!req.file) return sendError(res, 'No file uploaded. Make sure field name is "avatar"', 400);

    const user = await User.findById(req.user._id);
    if (!user) return sendError(res, 'User not found', 404);

    // Delete old avatar from cloudinary
    if (user.avatar && user.avatar.includes('cloudinary')) {
      try {
        const parts    = user.avatar.split('/');
        const filename = parts[parts.length - 1].split('.')[0];
        const folder   = parts[parts.length - 2];
        await cloudinary.uploader.destroy(`school_mgmt/avatars/${filename}`);
      } catch(e) { /* ignore delete errors */ }
    }

    user.avatar = req.file.path;
    await user.save({ validateBeforeSave: false });

    sendSuccess(res, { avatar: req.file.path }, 'Profile picture updated');
  } catch (err) { next(err); }
});

router.delete('/avatar/remove', async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return sendError(res, 'User not found', 404);

    if (user.avatar && user.avatar.includes('cloudinary')) {
      try {
        const parts    = user.avatar.split('/');
        const filename = parts[parts.length - 1].split('.')[0];
        await cloudinary.uploader.destroy(`school_mgmt/avatars/${filename}`);
      } catch(e) { /* ignore */ }
    }

    user.avatar = null;
    await user.save({ validateBeforeSave: false });

    sendSuccess(res, { avatar: null }, 'Profile picture removed');
  } catch (err) { next(err); }
});

// ─── Standard CRUD — /:id must come AFTER specific routes ────────────────────
router.get   ('/',    permissionGuard('users.view'),   ctrl.getAll);
router.post  ('/',    permissionGuard('users.create'), ctrl.create);
router.get   ('/:id', permissionGuard('users.view'),   ctrl.getById);
router.put   ('/:id', permissionGuard('users.edit'),   ctrl.update);
router.delete('/:id', permissionGuard('users.delete'), ctrl.delete);

module.exports = router;