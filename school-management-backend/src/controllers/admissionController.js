const admissionService = require('../services/admissionService');
const { sendSuccess, sendError, sendPaginated } = require('../utils/response');

// ─── Public routes (no auth) ──────────────────────────────────────────────────

// GET /admissions/schools — list all active schools for apply page
const getSchools = async (req, res, next) => {
  try {
    const schools = await admissionService.getActiveSchools();
    sendSuccess(res, schools);
  } catch (err) { next(err); }
};

// POST /admissions/apply — submit admission form
const apply = async (req, res, next) => {
  try {
    const { school_id, student_name, dob, gender, guardian_email } = req.body;
    if (!school_id)      return sendError(res, 'school_id is required', 400);
    if (!student_name)   return sendError(res, 'student_name is required', 400);
    if (!dob)            return sendError(res, 'Date of birth is required', 400);
    if (!gender)         return sendError(res, 'Gender is required', 400);
    if (!guardian_email) return sendError(res, 'Guardian email is required', 400);

    const admission = await admissionService.submitAdmission(req.body);
    sendSuccess(res, admission, 'Admission application submitted successfully! We will review and contact you.', 201);
  } catch (err) { next(err); }
};

// ─── Admin routes (auth required) ────────────────────────────────────────────

// GET /admissions — list all admissions
const getAll = async (req, res, next) => {
  try {
    const result = await admissionService.getAdmissions(req.schoolId, req.query);
    res.json({
      success: true,
      data:    result.data,
      pagination: { total: result.total, page: result.page, limit: result.limit },
      counts:  result.counts,
    });
  } catch (err) { next(err); }
};

// GET /admissions/:id — get one admission
const getOne = async (req, res, next) => {
  try {
    const admission = await admissionService.getAdmission(req.params.id, req.schoolId);
    if (!admission) return sendError(res, 'Admission not found', 404);
    sendSuccess(res, admission);
  } catch (err) { next(err); }
};

// PUT /admissions/:id/approve — approve and create student
const approve = async (req, res, next) => {
  try {
    const result = await admissionService.approveAdmission(
      req.params.id, req.schoolId, req.user._id
    );
    sendSuccess(res, result, `Admission approved! Student account created. Credentials sent to ${result.admission?.guardian_email}`);
  } catch (err) { next(err); }
};

// PUT /admissions/:id/reject — reject with reason
const reject = async (req, res, next) => {
  try {
    const { reason } = req.body;
    const admission = await admissionService.rejectAdmission(
      req.params.id, req.schoolId, req.user._id, reason
    );
    sendSuccess(res, admission, 'Admission rejected');
  } catch (err) { next(err); }
};

// POST /admissions/bulk-approve — approve multiple at once
const bulkApprove = async (req, res, next) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return sendError(res, 'ids array is required', 400);
    }
    const result = await admissionService.bulkApprove(ids, req.schoolId, req.user._id);
    sendSuccess(
      res, result,
      `${result.approved.length} approved${result.failed.length ? `, ${result.failed.length} failed` : ''}`
    );
  } catch (err) { next(err); }
};

module.exports = { getSchools, apply, getAll, getOne, approve, reject, bulkApprove };