const mongoose  = require('mongoose');
const { FeeGroup, FeeType, FeeMaster, FeeAssign, FeeCollect, Transaction } = require('../models/Fee');
const { Student } = require('../models/Student');
const { paginate } = require('../utils/pagination');
const { v4: uuidv4 } = require('uuid');

const ObjId = (id) => new mongoose.Types.ObjectId(id);

// ─── Invoice / Receipt number generators ─────────────────────────────────────
const genInvoiceNo = async (schoolId) => {
  const y = new Date().getFullYear();
  const n = await FeeAssign.countDocuments({ school_id: schoolId });
  return `INV-${y}-${String(n + 1).padStart(5, '0')}`;
};

const genReceiptNo = async (schoolId) => {
  const y = new Date().getFullYear();
  const n = await FeeCollect.countDocuments({ school_id: schoolId });
  return `RCP-${y}-${String(n + 1).padStart(5, '0')}`;
};

// ─── FeeGroup CRUD ────────────────────────────────────────────────────────────
const getGroups = async (schoolId, query) => {
  const { page, limit, skip, sort } = paginate(query);
  const filter = { school_id: schoolId, is_deleted: false };
  if (query.search) filter.name = { $regex: query.search, $options: 'i' };
  const [data, total] = await Promise.all([
    FeeGroup.find(filter).sort(sort).skip(skip).limit(limit),
    FeeGroup.countDocuments(filter),
  ]);
  return { data, total, page, limit };
};
const createGroup = (data, schoolId, userId) =>
  FeeGroup.create({ ...data, school_id: schoolId, created_by: userId });
const updateGroup = (id, data, schoolId) =>
  FeeGroup.findOneAndUpdate({ _id: id, school_id: schoolId }, data, { new: true });
const deleteGroup = (id, schoolId) =>
  FeeGroup.findOneAndUpdate({ _id: id, school_id: schoolId }, { is_deleted: true });

// ─── FeeType CRUD ─────────────────────────────────────────────────────────────
const getTypes = async (schoolId, query) => {
  const { page, limit, skip, sort } = paginate(query);
  const filter = { school_id: schoolId, is_deleted: false };
  const [data, total] = await Promise.all([
    FeeType.find(filter).sort(sort).skip(skip).limit(limit),
    FeeType.countDocuments(filter),
  ]);
  return { data, total, page, limit };
};
const createType = (data, schoolId, userId) =>
  FeeType.create({ ...data, school_id: schoolId, created_by: userId });
const updateType = (id, data, schoolId) =>
  FeeType.findOneAndUpdate({ _id: id, school_id: schoolId }, data, { new: true });
const deleteType = (id, schoolId) =>
  FeeType.findOneAndUpdate({ _id: id, school_id: schoolId }, { is_deleted: true });

// ─── FeeMaster CRUD ───────────────────────────────────────────────────────────
const getMasters = async (schoolId, query) => {
  const { page, limit, skip, sort } = paginate(query);
  const filter = { school_id: schoolId, is_deleted: false };
  if (query.session_id)   filter.session_id   = query.session_id;
  if (query.fee_group_id) filter.fee_group_id = query.fee_group_id;
  const [data, total] = await Promise.all([
    FeeMaster.find(filter)
      .populate('fee_group_id', 'name')
      .populate('fee_type_id', 'name code')
      .populate({ path: 'class_setup_id', populate: ['class_id', 'section_id'] })
      .sort(sort).skip(skip).limit(limit),
    FeeMaster.countDocuments(filter),
  ]);
  return { data, total, page, limit };
};
const createMaster = (data, schoolId, userId) =>
  FeeMaster.create({ ...data, school_id: schoolId, created_by: userId });
const updateMaster = (id, data, schoolId) =>
  FeeMaster.findOneAndUpdate({ _id: id, school_id: schoolId }, data, { new: true });
const deleteMaster = (id, schoolId) =>
  FeeMaster.findOneAndUpdate({ _id: id, school_id: schoolId }, { is_deleted: true });

// ─── Bulk assign fee to students ──────────────────────────────────────────────
const bulkAssign = async (feeMasterId, schoolId, createdBy, studentIds = null) => {
  const master = await FeeMaster.findOne({ _id: feeMasterId, school_id: schoolId });
  if (!master) throw Object.assign(new Error('Fee master not found'), { statusCode: 404 });

  let students;
  if (studentIds?.length) {
    students = await Student.find({ _id: { $in: studentIds }, school_id: schoolId });
  } else if (master.class_setup_id) {
    students = await Student.find({ class_setup_id: master.class_setup_id, school_id: schoolId, status: 'active', is_deleted: false });
  } else {
    students = await Student.find({ school_id: schoolId, status: 'active', is_deleted: false });
  }

  if (!students.length) throw Object.assign(new Error('No students found to assign fees'), { statusCode: 400 });

  const ops = await Promise.all(students.map(async (s) => {
    const invoice_no = await genInvoiceNo(schoolId);
    return {
      updateOne: {
        filter: { fee_master_id: feeMasterId, student_id: s._id, school_id: schoolId },
        update: {
          $setOnInsert: {
            fee_master_id: feeMasterId,
            student_id:    s._id,
            school_id:     schoolId,
            amount:        master.amount,
            due_date:      master.due_date,
            status:        'unpaid',
            invoice_no,
            created_by:    createdBy,
          },
        },
        upsert: true,
      },
    };
  }));

  await FeeAssign.bulkWrite(ops);
  return { assigned: students.length };
};

// ─── Get fee assignments (admin view) ────────────────────────────────────────
const getAssignments = async (schoolId, query) => {
  const { page, limit, skip } = paginate(query);
  const filter = { school_id: schoolId };
  if (query.status)      filter.status      = query.status;
  if (query.student_id)  filter.student_id  = query.student_id;
  if (query.fee_master_id) filter.fee_master_id = query.fee_master_id;

  const [data, total] = await Promise.all([
    FeeAssign.find(filter)
      .populate({ path: 'student_id', populate: { path: 'user_id', select: 'name email phone' } })
      .populate({ path: 'fee_master_id', populate: ['fee_group_id', 'fee_type_id'] })
      .sort({ due_date: 1 }).skip(skip).limit(limit),
    FeeAssign.countDocuments(filter),
  ]);

  // Attach payments summary
  const enriched = await Promise.all(data.map(async (a) => {
    const payments = await FeeCollect.find({ fee_assign_id: a._id }).sort({ paid_date: -1 });
    const total_paid = payments.reduce((s, p) => s + p.amount_paid, 0);
    const net_amount = a.amount - (a.discount || 0) + (a.fine || 0);
    return {
      ...a.toObject(),
      payments,
      total_paid,
      net_amount,
      balance: Math.max(0, net_amount - total_paid),
    };
  }));

  return { data: enriched, total, page, limit };
};

// ─── Collect fee payment ──────────────────────────────────────────────────────
const collectFee = async (feeAssignId, paymentData, schoolId, collectedBy) => {
  const assign = await FeeAssign.findOne({ _id: feeAssignId, school_id: schoolId });
  if (!assign) throw Object.assign(new Error('Fee assignment not found'), { statusCode: 404 });
  if (assign.status === 'paid') throw Object.assign(new Error('Fee already fully paid'), { statusCode: 400 });

  // Calculate balance
  const existing = await FeeCollect.aggregate([
    { $match: { fee_assign_id: ObjId(feeAssignId) } },
    { $group: { _id: null, total: { $sum: '$amount_paid' } } },
  ]);
  const alreadyPaid = existing[0]?.total || 0;
  const netAmount   = assign.amount - (assign.discount || 0) + (assign.fine || 0);
  const balance     = Math.max(0, netAmount - alreadyPaid);

  if (paymentData.amount_paid > balance) {
    throw Object.assign(new Error(`Amount exceeds balance of ₹${balance}`), { statusCode: 400 });
  }

  const receipt_no = await genReceiptNo(schoolId);

  // Create collection record
  const collection = await FeeCollect.create({
    school_id:      schoolId,
    fee_assign_id:  feeAssignId,
    amount_paid:    paymentData.amount_paid,
    paid_date:      paymentData.paid_date || new Date(),
    payment_method: paymentData.payment_method || 'cash',
    transaction_id: paymentData.transaction_id || uuidv4(),
    receipt_no,
    note:           paymentData.note,
    collected_by:   collectedBy,
    created_by:     collectedBy,
  });

  // Update assign status
  const newPaid  = alreadyPaid + paymentData.amount_paid;
  const newStatus = newPaid >= netAmount ? 'paid' : newPaid > 0 ? 'partial' : 'unpaid';
  await FeeAssign.findByIdAndUpdate(feeAssignId, { status: newStatus });

  // Log transaction
  await Transaction.create({
    school_id:   schoolId,
    type:        'income',
    description: `Fee collection - ${receipt_no}`,
    amount:      paymentData.amount_paid,
    date:        paymentData.paid_date || new Date(),
    reference:   receipt_no,
    category:    'fee',
    created_by:  collectedBy,
  });

  // Return enriched data
  const updatedAssign = await FeeAssign.findById(feeAssignId)
    .populate({ path: 'student_id', populate: { path: 'user_id', select: 'name email' } })
    .populate({ path: 'fee_master_id', populate: ['fee_group_id', 'fee_type_id'] });

  return { collection, assign: updatedAssign, receipt_no, new_status: newStatus, balance: Math.max(0, netAmount - newPaid) };
};

// ─── Payment history (admin) ──────────────────────────────────────────────────
const getPayments = async (schoolId, query) => {
  const { page, limit, skip } = paginate(query);
  const filter = { school_id: schoolId };
  if (query.student_id) {
    // Get all assign IDs for student
    const assigns = await FeeAssign.find({ student_id: query.student_id, school_id: schoolId }).select('_id');
    filter.fee_assign_id = { $in: assigns.map(a => a._id) };
  }
  if (query.from && query.to) {
    filter.paid_date = { $gte: new Date(query.from), $lte: new Date(query.to) };
  }
  if (query.payment_method) filter.payment_method = query.payment_method;

  const [data, total] = await Promise.all([
    FeeCollect.find(filter)
      .populate({ path: 'fee_assign_id', populate: [
        { path: 'student_id', populate: { path: 'user_id', select: 'name email' } },
        { path: 'fee_master_id', populate: ['fee_group_id', 'fee_type_id'] },
      ]})
      .populate('collected_by', 'name')
      .sort({ paid_date: -1 }).skip(skip).limit(limit),
    FeeCollect.countDocuments(filter),
  ]);
  return { data, total, page, limit };
};

// ─── Fee Report / Defaulters ──────────────────────────────────────────────────
const getFeeReport = async (schoolId, query) => {
  const match = { school_id: ObjId(schoolId) };
  if (query.session_id) match.session_id = ObjId(query.session_id);
  if (query.status)     match.status     = query.status;

  const [summary, monthlyCollection, defaulters] = await Promise.all([
    // Summary
    FeeAssign.aggregate([
      { $match: { school_id: ObjId(schoolId) } },
      { $group: {
        _id:           '$status',
        count:         { $sum: 1 },
        total_amount:  { $sum: '$amount' },
      }},
    ]),

    // Monthly collection
    FeeCollect.aggregate([
      { $match: { school_id: ObjId(schoolId) } },
      { $group: {
        _id:   { year: { $year: '$paid_date' }, month: { $month: '$paid_date' } },
        total: { $sum: '$amount_paid' },
        count: { $sum: 1 },
      }},
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]),

    // Defaulters (unpaid + overdue)
    FeeAssign.find({ school_id: schoolId, status: { $in: ['unpaid', 'partial'] } })
      .populate({ path: 'student_id', populate: [
        { path: 'user_id', select: 'name email phone' },
        { path: 'class_setup_id', populate: ['class_id', 'section_id'] },
      ]})
      .populate({ path: 'fee_master_id', populate: ['fee_group_id', 'fee_type_id'] })
      .sort({ due_date: 1 })
      .limit(100),
  ]);

  return { summary, monthlyCollection, defaulters };
};

// ─── Student: get my fees ─────────────────────────────────────────────────────
const getStudentFees = async (studentId, schoolId, query) => {
  const { page, limit, skip } = paginate(query);
  const filter = { student_id: studentId, school_id: schoolId };
  if (query.status) filter.status = query.status;

  const [assigns, total, summaryAgg] = await Promise.all([
    FeeAssign.find(filter)
      .populate({ path: 'fee_master_id', populate: ['fee_group_id', 'fee_type_id'] })
      .sort({ due_date: 1 }).skip(skip).limit(limit),
    FeeAssign.countDocuments(filter),
    FeeAssign.aggregate([
      { $match: { student_id: ObjId(studentId), school_id: ObjId(schoolId) } },
      { $group: {
        _id:          null,
        total_amount: { $sum: '$amount' },
        total_discount: { $sum: '$discount' },
        total_fine:   { $sum: '$fine' },
      }},
    ]),
  ]);

  // Attach payments to each assign
  const data = await Promise.all(assigns.map(async (a) => {
    const payments = await FeeCollect.find({ fee_assign_id: a._id }).sort({ paid_date: -1 });
    const total_paid = payments.reduce((s, p) => s + p.amount_paid, 0);
    const net_amount = a.amount - (a.discount || 0) + (a.fine || 0);
    return {
      ...a.toObject(),
      payments,
      total_paid,
      net_amount,
      balance: Math.max(0, net_amount - total_paid),
    };
  }));

  const agg = summaryAgg[0] || { total_amount: 0, total_discount: 0, total_fine: 0 };

  // Get total paid from FeeCollect
  const paidAgg = await FeeCollect.aggregate([
    { $match: { fee_assign_id: { $in: assigns.map(a => a._id) } } },
    { $group: { _id: null, total_paid: { $sum: '$amount_paid' } } },
  ]);
  const total_paid = paidAgg[0]?.total_paid || 0;
  const net_total  = agg.total_amount - agg.total_discount + agg.total_fine;

  return {
    data,
    total,
    page,
    limit,
    summary: {
      total_amount:  agg.total_amount,
      total_discount:agg.total_discount,
      net_total,
      total_paid,
      balance:       Math.max(0, net_total - total_paid),
    },
  };
};

// ─── Student: get my payment history ─────────────────────────────────────────
const getStudentPayments = async (studentId, schoolId, query) => {
  const { page, limit, skip } = paginate(query);
  const assigns = await FeeAssign.find({ student_id: studentId, school_id: schoolId }).select('_id');
  const [data, total] = await Promise.all([
    FeeCollect.find({ fee_assign_id: { $in: assigns.map(a => a._id) } })
      .populate({ path: 'fee_assign_id', populate: { path: 'fee_master_id', populate: ['fee_group_id', 'fee_type_id'] } })
      .sort({ paid_date: -1 }).skip(skip).limit(limit),
    FeeCollect.countDocuments({ fee_assign_id: { $in: assigns.map(a => a._id) } }),
  ]);
  return { data, total, page, limit };
};

// ─── Update overdue status ────────────────────────────────────────────────────
const updateOverdue = async (schoolId) => {
  const result = await FeeAssign.updateMany(
    { school_id: schoolId, status: 'unpaid', due_date: { $lt: new Date() } },
    { $set: { status: 'overdue' } }
  );
  return result.modifiedCount;
};

module.exports = {
  getGroups, createGroup, updateGroup, deleteGroup,
  getTypes, createType, updateType, deleteType,
  getMasters, createMaster, updateMaster, deleteMaster,
  bulkAssign, getAssignments,
  collectFee, getPayments,
  getFeeReport, updateOverdue,
  getStudentFees, getStudentPayments,
};