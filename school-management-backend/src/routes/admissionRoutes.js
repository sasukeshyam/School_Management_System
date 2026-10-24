// const express = require('express');
// const router = express.Router();
// const createCrudController = require('../controllers/crudController');
// const createCrudService = require('../services/crudService');
// const { OnlineAdmission } = require('../models/Content');
// const { authenticate, permissionGuard } = require('../middlewares/authMiddleware');
// const ctrl = createCrudController(createCrudService(OnlineAdmission), 'Admission');

// // Public route for applying
// router.post('/apply', ctrl.create);
// router.use(authenticate);
// router.get('/',    permissionGuard('admissions.view'),   ctrl.getAll);
// router.get('/:id', permissionGuard('admissions.view'),   ctrl.getById);
// router.put('/:id', permissionGuard('admissions.review'), ctrl.update);
// router.delete('/:id', permissionGuard('admissions.delete'), ctrl.delete);
// module.exports = router;


const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/admissionController');
const { authenticate, permissionGuard } = require('../middlewares/authMiddleware');

// ─── Public routes — no auth needed ──────────────────────────────────────────
router.get  ('/schools', ctrl.getSchools); // list active schools
router.post ('/apply',   ctrl.apply);      // submit admission form

// ─── Admin routes — auth required ────────────────────────────────────────────
router.use(authenticate);
router.post('/bulk-approve', permissionGuard('admissions.review'),ctrl.bulkApprove)
router.get ('/',           permissionGuard('admissions.view'),    ctrl.getAll);
router.get ('/:id',        permissionGuard('admissions.view'),    ctrl.getOne);
router.put ('/:id/approve',permissionGuard('admissions.review'),  ctrl.approve);
router.put ('/:id/reject', permissionGuard('admissions.review'),  ctrl.reject);

module.exports = router;