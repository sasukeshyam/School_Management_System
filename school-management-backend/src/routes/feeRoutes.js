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
router.get   ('/assigns',        permissionGuard('fees.collect'),   ctrl.getAssignments)
router.post  ('/assigns/bulk',   permissionGuard('fees.create'), ctrl.bulkAssign)
router.put   ('/assigns/:id',     permissionGuard('fees.edit'),   ctrl.editAssignment)

// ─── Fee Collection ───────────────────────────────────────────────────────────
router.post  ('/collect',        permissionGuard('fees.collect'),ctrl.collectFee)
router.get   ('/payments',       permissionGuard('fees.collect'),   ctrl.getPayments)

// ─── Reports ──────────────────────────────────────────────────────────────────
router.get   ('/report',         permissionGuard('fees.collect'),   ctrl.getReport)
router.get   ('/today',             permissionGuard('fees.collect'), ctrl.getTodaySummary)
router.get   ('/collection-report',  permissionGuard('fees.collect'), ctrl.getCollectionReport)
router.post  ('/update-overdue', permissionGuard('fees.edit'),   ctrl.updateOverdue)

// ─── Student routes ───────────────────────────────────────────────────────────
router.get   ('/student/my-fees',    ctrl.getMyFees)
router.get   ('/student/my-payments',ctrl.getMyPayments)
router.post  ('/student/pay',        ctrl.payMyFee)

// ─── Receipt & Reminders ─────────────────────────────────────────────────────
router.get   ('/receipt/:paymentId',    authenticate, ctrl.downloadReceipt)
router.post  ('/send-reminders',        permissionGuard('fees.edit'), ctrl.sendReminders)
router.post  ('/assigns/:id/discount',  permissionGuard('fees.edit'), ctrl.applyDiscount)

module.exports = router

// ─── Razorpay ─────────────────────────────────────────────────────────────────
router.post('/razorpay/create-order',  ctrl.createRazorpayOrder)
router.post('/razorpay/verify',        ctrl.verifyRazorpayPayment)
