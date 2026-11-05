const feeService = require('../services/feeService');
const { sendSuccess, sendError, sendPaginated } = require('../utils/response');
const { Student } = require('../models/Student');

// ─── Fee Groups ───────────────────────────────────────────────────────────────
const getGroups  = async (req, res, next) => {
  try { const r = await feeService.getGroups(req.schoolId, req.query); sendPaginated(res, r.data, r.total, r.page, r.limit); } catch(e){next(e)}
};
const createGroup = async (req, res, next) => {
  try { sendSuccess(res, await feeService.createGroup(req.body, req.schoolId, req.user._id), 'Fee group created', 201); } catch(e){next(e)}
};
const updateGroup = async (req, res, next) => {
  try { sendSuccess(res, await feeService.updateGroup(req.params.id, req.body, req.schoolId), 'Updated'); } catch(e){next(e)}
};
const deleteGroup = async (req, res, next) => {
  try { await feeService.deleteGroup(req.params.id, req.schoolId); sendSuccess(res, {}, 'Deleted'); } catch(e){next(e)}
};

// ─── Fee Types ────────────────────────────────────────────────────────────────
const getTypes  = async (req, res, next) => {
  try { const r = await feeService.getTypes(req.schoolId, req.query); sendPaginated(res, r.data, r.total, r.page, r.limit); } catch(e){next(e)}
};
const createType = async (req, res, next) => {
  try { sendSuccess(res, await feeService.createType(req.body, req.schoolId, req.user._id), 'Fee type created', 201); } catch(e){next(e)}
};
const updateType = async (req, res, next) => {
  try { sendSuccess(res, await feeService.updateType(req.params.id, req.body, req.schoolId), 'Updated'); } catch(e){next(e)}
};
const deleteType = async (req, res, next) => {
  try { await feeService.deleteType(req.params.id, req.schoolId); sendSuccess(res, {}, 'Deleted'); } catch(e){next(e)}
};

// ─── Fee Masters ──────────────────────────────────────────────────────────────
const getMasters  = async (req, res, next) => {
  try { const r = await feeService.getMasters(req.schoolId, req.query); sendPaginated(res, r.data, r.total, r.page, r.limit); } catch(e){next(e)}
};
const createMaster = async (req, res, next) => {
  try { sendSuccess(res, await feeService.createMaster(req.body, req.schoolId, req.user._id), 'Fee master created', 201); } catch(e){next(e)}
};
const updateMaster = async (req, res, next) => {
  try { sendSuccess(res, await feeService.updateMaster(req.params.id, req.body, req.schoolId), 'Updated'); } catch(e){next(e)}
};
const deleteMaster = async (req, res, next) => {
  try { await feeService.deleteMaster(req.params.id, req.schoolId); sendSuccess(res, {}, 'Deleted'); } catch(e){next(e)}
};

// ─── Fee Assignments ──────────────────────────────────────────────────────────

const editAssignment = async (req, res, next) => {
  try {
    const result = await feeService.editAssignment(req.params.id, req.body, req.schoolId)
    sendSuccess(res, result, 'Fee assignment updated')
  } catch(e) { next(e) }
}

const bulkAssign = async (req, res, next) => {
  try {
    const { fee_master_id, student_ids } = req.body;
    if (!fee_master_id) return sendError(res, 'fee_master_id is required', 400);
    const result = await feeService.bulkAssign(fee_master_id, req.schoolId, req.user._id, student_ids);
    sendSuccess(res, result, `Fees assigned to ${result.assigned} students`);
  } catch(e){next(e)}
};

// ─── Fee Collection ───────────────────────────────────────────────────────────
const collectFee = async (req, res, next) => {
  try {
    const { fee_assign_id, amount_paid, payment_method, transaction_id, note, paid_date } = req.body;
    if (!fee_assign_id || !amount_paid) return sendError(res, 'fee_assign_id and amount_paid are required', 400);
    const result = await feeService.collectFee(
      fee_assign_id,
      { amount_paid: Number(amount_paid), payment_method, transaction_id, note, paid_date },
      req.schoolId,
      req.user._id
    );
    sendSuccess(res, result, `Payment of ₹${amount_paid} collected. Receipt: ${result.receipt_no}`);
  } catch(e){next(e)}
};


// ─── Report ───────────────────────────────────────────────────────────────────
const getReport = async (req, res, next) => {
  try { sendSuccess(res, await feeService.getFeeReport(req.schoolId, req.query)); } catch(e){next(e)}
};

const updateOverdue = async (req, res, next) => {
  try {
    const count = await feeService.updateOverdue(req.schoolId);
    sendSuccess(res, { updated: count }, `${count} fees marked as overdue`);
  } catch(e){next(e)}
};

// ─── Student routes ───────────────────────────────────────────────────────────
const getMyFees = async (req, res, next) => {
  try {
    const student = await Student.findOne({ user_id: req.user._id, school_id: req.schoolId });
    if (!student) return sendError(res, 'Student profile not found', 404);
    const result = await feeService.getStudentFees(student._id, req.schoolId, req.query);
    sendSuccess(res, result);
  } catch(e){next(e)}
};

const getMyPayments = async (req, res, next) => {
  try {
    const student = await Student.findOne({ user_id: req.user._id, school_id: req.schoolId });
    if (!student) return sendError(res, 'Student not found', 404);
    const r = await feeService.getStudentPayments(student._id, req.schoolId, req.query);
    sendPaginated(res, r.data, r.total, r.page, r.limit);
  } catch(e){next(e)}
};

const payMyFee = async (req, res, next) => {
  try {
    const student = await Student.findOne({ user_id: req.user._id, school_id: req.schoolId });
    if (!student) return sendError(res, 'Student not found', 404);
    const { fee_assign_id, amount_paid, payment_method, transaction_id } = req.body;
    const result = await feeService.collectFee(
      fee_assign_id,
      { amount_paid: Number(amount_paid), payment_method: payment_method || 'online', transaction_id },
      req.schoolId,
      req.user._id
    );
    sendSuccess(res, result, 'Payment successful');
  } catch(e){next(e)}
};

;

// ─── Razorpay ─────────────────────────────────────────────────────────────────
const createRazorpayOrder = async (req, res, next) => {
  try {
    const Razorpay  = require('razorpay')
    const { FeeAssign, FeeCollect } = require('../models/Fee')
    const mongoose  = require('mongoose')

    const { fee_assign_id } = req.body
    if (!fee_assign_id) return sendError(res, 'fee_assign_id is required', 400)

    // Find assign — student may belong to any school so use just _id + student check
    const assign = await FeeAssign.findById(fee_assign_id)
    if (!assign) return sendError(res, 'Fee assignment not found', 404)
    if (assign.status === 'paid') return sendError(res, 'Already fully paid', 400)

    // Calculate balance
    const paid = await FeeCollect.aggregate([
      { $match: { fee_assign_id: new mongoose.Types.ObjectId(fee_assign_id) } },
      { $group: { _id: null, total: { $sum: '$amount_paid' } } },
    ])
    const alreadyPaid = paid[0]?.total || 0
    const netAmount   = assign.amount - (assign.discount || 0) + (assign.fine || 0)
    const balance     = Math.max(0, netAmount - alreadyPaid)

    if (balance <= 0) return sendError(res, 'No balance due', 400)

    const amount = Number(req.body.amount) || balance
    if (amount > balance) return sendError(res, `Amount ₹${amount} exceeds balance ₹${balance}`, 400)
    if (amount < 1)       return sendError(res, 'Amount must be at least ₹1', 400)

    const razorpay = new Razorpay({
      key_id:     process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    })

    const order = await razorpay.orders.create({
      amount:   Math.round(amount * 100), // convert to paise
      currency: 'INR',
      receipt:  `fee_${Date.now()}`.slice(0, 40),
    })

    sendSuccess(res, {
      order_id:     order.id,
      amount:       order.amount,
      currency:     order.currency,
      key_id:       process.env.RAZORPAY_KEY_ID,
      fee_assign_id,
      student_name: req.user?.name || 'Student',
    })
  } catch (err) {
    console.error('RAZORPAY ORDER ERROR:', err?.error || err?.message || err)
    next(err)
  }
}

const verifyRazorpayPayment = async (req, res, next) => {
  try {
    const crypto = require('crypto')
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, fee_assign_id, amount_paid } = req.body

    // Verify signature
    const body      = razorpay_order_id + '|' + razorpay_payment_id
    const expected  = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET).update(body).digest('hex')
    if (expected !== razorpay_signature) return sendError(res, 'Payment verification failed', 400)

    // Record payment
    const result = await feeService.collectFee(
      fee_assign_id,
      {
        amount_paid:    Number(amount_paid) / 100, // convert from paise
        payment_method: 'online',
        transaction_id: razorpay_payment_id,
        gateway:        'razorpay',
      },
      req.schoolId,
      req.user._id
    )

    sendSuccess(res, result, 'Payment verified and recorded successfully!')
  } catch (err) { next(err) }
}


// ─── Download Receipt ─────────────────────────────────────────────────────────
const downloadReceipt = async (req, res, next) => {
  try {
    const { generateReceiptPDF } = require('../services/feeReceiptService')
    const { html, payment } = await generateReceiptPDF(req.params.paymentId, req.schoolId)

    // Return HTML — frontend will print/save as PDF
    res.setHeader('Content-Type', 'text/html')
    res.send(html)
  } catch (err) { next(err) }
}

// ─── Send overdue reminders ───────────────────────────────────────────────────
const sendReminders = async (req, res, next) => {
  try {
    const { sendOverdueReminders } = require('../services/feeReceiptService')
    const result = await sendOverdueReminders(req.schoolId)
    sendSuccess(res, result, `Reminders sent to ${result.sent} students`)
  } catch (err) { next(err) }
}

// ─── Apply discount to student fee ───────────────────────────────────────────
const applyDiscount = async (req, res, next) => {
  try {
    const { FeeAssign } = require('../models/Fee')
    const { discount, discount_reason } = req.body
    if (discount === undefined) return sendError(res, 'discount is required', 400)

    const assign = await FeeAssign.findOneAndUpdate(
      { _id: req.params.id, school_id: req.schoolId },
      {
        discount,
        discount_reason: discount_reason || '',
        // Recalculate fine net_amount via virtual
      },
      { new: true }
    )
    if (!assign) return sendError(res, 'Assignment not found', 404)
    sendSuccess(res, assign, `Discount of ₹${discount} applied`)
  } catch (err) { next(err) }
}

const pageMeta = (r) => ({ total: r.total, page: r.page, limit: r.limit, pages: Math.max(1, Math.ceil(r.total / r.limit)) });

const getAssignments = async (req, res, next) => {
  try {
    const r = await feeService.getAssignments(req.schoolId, req.query);
    res.json({ success: true, data: r.data, pagination: pageMeta(r), summary: r.summary });
  } catch (e) { next(e); }
};

const getPayments = async (req, res, next) => {
  try {
    const r = await feeService.getPayments(req.schoolId, req.query);
    res.json({ success: true, data: r.data, pagination: pageMeta(r) });
  } catch (e) { next(e); }
};

const getCollectionReport = async (req, res, next) => {
  try { sendSuccess(res, await feeService.getCollectionReport(req.schoolId, req.query)); } catch (e) { next(e); }
};

const getTodaySummary = async (req, res, next) => {
  try { sendSuccess(res, await feeService.getTodaySummary(req.schoolId)); } catch (e) { next(e); }
};

module.exports = {
  getCollectionReport, getTodaySummary,
  getGroups, createGroup, updateGroup, deleteGroup,
  getTypes,  createType,  updateType,  deleteType,
  getMasters,createMaster,updateMaster,deleteMaster,
  getAssignments, bulkAssign, editAssignment,
  collectFee, getPayments,
  getReport, updateOverdue,
  getMyFees, getMyPayments, payMyFee,
  createRazorpayOrder, verifyRazorpayPayment,
  downloadReceipt, sendReminders, applyDiscount,
}
