const express = require('express')
const router  = express.Router()
const ctrl    = require('../controllers/feeController')
const { authenticate, permissionGuard } = require('../middlewares/authMiddleware')

router.use(authenticate)

// ─── Fee Groups ───────────────────────────────────────────────────────────────
router.get   ('/groups',         permissionGuard('fees.view'),   ctrl.getGroups)
router.post  ('/groups',         permissionGuard('fees.create'), ctrl.createGroup)
router.put   ('/groups/:id',     permissionGuard('fees.edit'),   ctrl.updateGroup)
router.delete('/groups/:id',     permissionGuard('fees.delete'), ctrl.deleteGroup)

// ─── Fee Types ────────────────────────────────────────────────────────────────
router.get   ('/types',          permissionGuard('fees.view'),   ctrl.getTypes)
router.post  ('/types',          permissionGuard('fees.create'), ctrl.createType)
router.put   ('/types/:id',      permissionGuard('fees.edit'),   ctrl.updateType)
router.delete('/types/:id',      permissionGuard('fees.delete'), ctrl.deleteType)

// ─── Fee Masters ──────────────────────────────────────────────────────────────
router.get   ('/masters',        permissionGuard('fees.view'),   ctrl.getMasters)
router.post  ('/masters',        permissionGuard('fees.create'), ctrl.createMaster)
router.put   ('/masters/:id',    permissionGuard('fees.edit'),   ctrl.updateMaster)
router.delete('/masters/:id',    permissionGuard('fees.delete'), ctrl.deleteMaster)

// ─── Fee Assignments ──────────────────────────────────────────────────────────
router.get   ('/assigns',        permissionGuard('fees.view'),   ctrl.getAssignments)
router.post  ('/assigns/bulk',   permissionGuard('fees.create'), ctrl.bulkAssign)

// ─── Fee Collection ───────────────────────────────────────────────────────────
router.post  ('/collect',        permissionGuard('fees.collect'),ctrl.collectFee)
router.get   ('/payments',       permissionGuard('fees.view'),   ctrl.getPayments)

// ─── Reports ──────────────────────────────────────────────────────────────────
router.get   ('/report',         permissionGuard('fees.view'),   ctrl.getReport)
router.post  ('/update-overdue', permissionGuard('fees.edit'),   ctrl.updateOverdue)

// ─── Student routes ───────────────────────────────────────────────────────────
router.get   ('/student/my-fees',    ctrl.getMyFees)
router.get   ('/student/my-payments',ctrl.getMyPayments)
router.post  ('/student/pay',        ctrl.payMyFee)

module.exports = router