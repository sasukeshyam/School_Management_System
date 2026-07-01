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
const getAssignments = async (req, res, next) => {
  try { const r = await feeService.getAssignments(req.schoolId, req.query); sendPaginated(res, r.data, r.total, r.page, r.limit); } catch(e){next(e)}
};

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

const getPayments = async (req, res, next) => {
  try { const r = await feeService.getPayments(req.schoolId, req.query); sendPaginated(res, r.data, r.total, r.page, r.limit); } catch(e){next(e)}
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

module.exports = {
  getGroups, createGroup, updateGroup, deleteGroup,
  getTypes,  createType,  updateType,  deleteType,
  getMasters,createMaster,updateMaster,deleteMaster,
  getAssignments, bulkAssign,
  collectFee, getPayments,
  getReport, updateOverdue,
  getMyFees, getMyPayments, payMyFee,
};