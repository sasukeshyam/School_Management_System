const mongoose  = require('mongoose');
const { FeeGroup, FeeType, FeeMaster, FeeAssign, FeeCollect, Transaction } = require('../models/Fee');
const { Student } = require('../models/Student');
const { paginate } = require('../utils/pagination');
const { v4: uuidv4 } = require('uuid');
const User   = require('../models/User');
const School = require('../models/School');
const { dayString, validTimeZone, escapeRegex, eachDay, eachMonth, assertDayRange, round2 } = require('../utils/feeReportUtils');

const ObjId = (id) => new mongoose.Types.ObjectId(id);

// ─── Receipt number generator ─────────────────────────────────────────────────
const genReceiptNo = async (schoolId) => {
  const y = new Date().getFullYear();
  const n = await FeeCollect.countDocuments({ school_id: schoolId });
  return `RCP-${y}-${String(n + 1).padStart(5, '0')}`;
};

const genInvoiceNo = async (schoolId) => {
  const y = new Date().getFullYear();
  const n = await FeeAssign.countDocuments({ school_id: schoolId });
  return `INV-${y}-${String(n + 1).padStart(5, '0')}`;
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
const createGroup = (data, schoolId, userId) => FeeGroup.create({ ...data, school_id: schoolId, created_by: userId });
const updateGroup = (id, data, schoolId) => FeeGroup.findOneAndUpdate({ _id: id, school_id: schoolId }, data, { new: true });
const deleteGroup = (id, schoolId) => FeeGroup.findOneAndUpdate({ _id: id, school_id: schoolId }, { is_deleted: true });

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
const createType = (data, schoolId, userId) => FeeType.create({ ...data, school_id: schoolId, created_by: userId });
const updateType = (id, data, schoolId) => FeeType.findOneAndUpdate({ _id: id, school_id: schoolId }, data, { new: true });
const deleteType = (id, schoolId) => FeeType.findOneAndUpdate({ _id: id, school_id: schoolId }, { is_deleted: true });

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
const createMaster = (data, schoolId, userId) => FeeMaster.create({ ...data, school_id: schoolId, created_by: userId });
const updateMaster = async (id, data, schoolId) => {
  const master = await FeeMaster.findOneAndUpdate(
    { _id: id, school_id: schoolId }, data, { new: true }
  );
  // Auto-sync all UNPAID/OVERDUE assignments — paid ones are NOT touched
  const updateData = {};
  if (data.amount   !== undefined) updateData.amount   = data.amount;
  if (data.due_date !== undefined) updateData.due_date = data.due_date;
  if (Object.keys(updateData).length > 0) {
    await FeeAssign.updateMany(
      { fee_master_id: id, school_id: schoolId, status: { $in: ['unpaid', 'overdue'] } },
      { $set: updateData }
    );
  }
  return master;
};
const deleteMaster = async (id, schoolId) => {
  // Cancel all UNPAID assignments for this master — paid ones stay for records
  await FeeAssign.updateMany(
    { fee_master_id: id, school_id: schoolId, status: { $in: ['unpaid', 'overdue'] } },
    { $set: { status: 'cancelled' } }
  );
  return FeeMaster.findOneAndUpdate({ _id: id, school_id: schoolId }, { is_deleted: true });
};

// ─── Bulk assign fee to students ──────────────────────────────────────────────
const bulkAssign = async (feeMasterId, schoolId, createdBy, studentIds = null, options = {}) => {
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

  if (!students.length) throw Object.assign(new Error('No students found'), { statusCode: 400 });

  let created = 0;
  let skipped = 0;

  for (const student of students) {
    // Check for existing unpaid balance of same fee type to carry forward
    let carryForward     = 0;
    let previousAssignId = null;

    if (options.carry_forward !== false) {
      const prevAssign = await FeeAssign.findOne({
        student_id:     student._id,
        school_id:      schoolId,
        status:         { $in: ['unpaid', 'partial'] },
        fee_master_id:  { $in: await FeeMaster.find({
          school_id:    schoolId,
          fee_type_id:  master.fee_type_id,
        }).distinct('_id') },
      }).sort({ created_at: -1 });

      if (prevAssign) {
        // Calculate how much is still unpaid
        const paidAgg = await FeeCollect.aggregate([
          { $match: { fee_assign_id: prevAssign._id } },
          { $group: { _id: null, total: { $sum: '$amount_paid' } } },
        ]);
        const paid      = paidAgg[0]?.total || 0;
        const netAmount = prevAssign.amount - (prevAssign.discount || 0) + (prevAssign.fine || 0) + (prevAssign.carry_forward || 0);
        carryForward    = Math.max(0, netAmount - paid);
        if (carryForward > 0) {
          previousAssignId = prevAssign._id;
          // Mark previous as carried forward
          await FeeAssign.findByIdAndUpdate(prevAssign._id, { status: 'carried_forward' });
        }
      }
    }

    const invoice_no = await genInvoiceNo(schoolId);

    // Use findOneAndUpdate with upsert to avoid duplicate errors
    const existing = await FeeAssign.findOne({
      fee_master_id: feeMasterId,
      student_id:    student._id,
      school_id:     schoolId,
      status:        { $in: ['unpaid', 'partial', 'overdue'] },
    });

    if (existing) {
      // Update existing unpaid assignment with new amount
      await FeeAssign.findByIdAndUpdate(existing._id, {
        amount:   options.amount || master.amount,
        due_date: options.due_date || master.due_date,
        label:    options.label || existing.label,
      });
      skipped++;
    } else {
      await FeeAssign.create({
        fee_master_id:       feeMasterId,
        student_id:          student._id,
        school_id:           schoolId,
        amount:              options.amount || master.amount,
        due_date:            options.due_date || master.due_date,
        status:              'unpaid',
        carry_forward:       carryForward,
        previous_assign_id:  previousAssignId,
        label:               options.label || '',
        invoice_no,
        created_by:          createdBy,
      });
      created++;
    }
  }

  return { assigned: created, skipped };
};

// ─── Edit a single fee assignment ────────────────────────────────────────────
const editAssignment = async (assignId, data, schoolId) => {
  const assign = await FeeAssign.findOne({ _id: assignId, school_id: schoolId });
  if (!assign) throw Object.assign(new Error('Assignment not found'), { statusCode: 404 });
  if (assign.status === 'paid') throw Object.assign(new Error('Cannot edit a paid fee'), { statusCode: 400 });

  const allowed = ['amount', 'discount', 'fine', 'due_date', 'label', 'carry_forward'];
  allowed.forEach(field => {
    if (data[field] !== undefined) assign[field] = data[field];
  });

  await assign.save();
  return assign;
};

// ─── Shared helpers for search & reports ──────────────────────────────────────
const HIDDEN_FEE_STATUSES = ['cancelled', 'carried_forward'];

const castId = (value, label) => {
  if (!mongoose.isValidObjectId(value)) {
    throw Object.assign(new Error(`Invalid ${label}`), { statusCode: 400 });
  }
  return ObjId(value);
};

const getSchoolTz = async (schoolId) => {
  const school = await School.findById(schoolId).select('timezone').lean();
  return school?.timezone && validTimeZone(school.timezone) ? school.timezone : 'Asia/Kolkata';
};

// Student ids matching a free-text search and/or a class. null = no restriction.
const resolveStudentIds = async (schoolId, { search, class_setup_id }) => {
  const text = (search || '').trim();
  if (!text && !class_setup_id) return null;

  const filter = { school_id: schoolId, is_deleted: false };
  if (class_setup_id) filter.class_setup_id = castId(class_setup_id, 'class_setup_id');

  if (text) {
    const rx = new RegExp(escapeRegex(text), 'i');
    const userIds = await User.find({
      school_id: schoolId,
      $or: [{ name: rx }, { email: rx }, { phone: rx }],
    }).distinct('_id');
    filter.$or = [{ user_id: { $in: userIds } }, { admission_no: rx }, { roll_number: rx }];
  }
  return Student.find(filter).distinct('_id');
};

// Fee-assignment ids for a student / class / search / fee-type filter. null = no restriction.
const resolveAssignIds = async (schoolId, query) => {
  const { search, class_setup_id, fee_type_id, student_id } = query;
  if (!(search || '').trim() && !class_setup_id && !fee_type_id && !student_id) return null;

  const filter = { school_id: schoolId };
  if (student_id) {
    filter.student_id = castId(student_id, 'student_id');
  } else {
    const studentIds = await resolveStudentIds(schoolId, query);
    if (studentIds) filter.student_id = { $in: studentIds };
  }
  if (fee_type_id) {
    const masterIds = await FeeMaster.find({
      school_id: schoolId, fee_type_id: castId(fee_type_id, 'fee_type_id'),
    }).distinct('_id');
    filter.fee_master_id = { $in: masterIds };
  }
  return FeeAssign.find(filter).distinct('_id');
};

// Pipeline stages selecting payments by calendar day (in the school's timezone),
// method, type and optionally student / class / fee type.
const paymentBase = async (schoolId, query, tz) => {
  let { from, to } = query;
  if (from || to) { from = from || to; to = to || from; }
  assertDayRange(from, to);

  const match = { school_id: ObjId(schoolId) };
  if (query.payment_method) match.payment_method = String(query.payment_method);
  if (query.payment_type)   match.payment_type   = String(query.payment_type);

  if (from && to) {
    // Loose bounds so the paid_date index is used; the exact day test happens below.
    const lo = new Date(`${from}T00:00:00.000Z`); lo.setUTCDate(lo.getUTCDate() - 1);
    const hi = new Date(`${to}T00:00:00.000Z`);   hi.setUTCDate(hi.getUTCDate() + 2);
    match.paid_date = { $gte: lo, $lt: hi };
  }

  const assignIds = await resolveAssignIds(schoolId, query);
  if (assignIds) match.fee_assign_id = { $in: assignIds };

  const stages = [
    { $match: match },
    { $addFields: { day: { $dateToString: { format: '%Y-%m-%d', date: '$paid_date', timezone: tz } } } },
  ];
  if (from && to) stages.push({ $match: { day: { $gte: from, $lte: to } } });
  return stages;
};

// ─── Get fee assignments (search + filters + totals over ALL matches) ─────────
const getAssignments = async (schoolId, query) => {
  const { page, limit, skip } = paginate(query);

  const filter = { school_id: ObjId(schoolId) };
  filter.status = query.status || { $nin: HIDDEN_FEE_STATUSES };
  if (query.fee_master_id) filter.fee_master_id = castId(query.fee_master_id, 'fee_master_id');
  if (query.fee_type_id) {
    const masterIds = await FeeMaster.find({
      school_id: schoolId, fee_type_id: castId(query.fee_type_id, 'fee_type_id'),
    }).distinct('_id');
    filter.fee_master_id = { $in: masterIds };
  }
  if (query.student_id) {
    filter.student_id = castId(query.student_id, 'student_id');
  } else {
    const studentIds = await resolveStudentIds(schoolId, query);
    if (studentIds) filter.student_id = { $in: studentIds };
  }

  const [rows, total, summaryAgg] = await Promise.all([
    FeeAssign.find(filter)
      .populate({ path: 'student_id', populate: [
        { path: 'user_id', select: 'name email phone' },
        { path: 'class_setup_id', populate: ['class_id', 'section_id'] },
      ] })
      .populate({ path: 'fee_master_id', populate: ['fee_group_id', 'fee_type_id'] })
      .sort({ due_date: 1, _id: 1 }).skip(skip).limit(limit),
    FeeAssign.countDocuments(filter),
    FeeAssign.aggregate([
      { $match: filter },
      { $addFields: {
        net: { $add: [
          { $subtract: ['$amount', { $ifNull: ['$discount', 0] }] },
          { $ifNull: ['$fine', 0] },
          { $ifNull: ['$carry_forward', 0] },
        ] },
      } },
      { $lookup: { from: FeeCollect.collection.name, localField: '_id', foreignField: 'fee_assign_id', as: 'pays' } },
      { $addFields: { paid: { $sum: '$pays.amount_paid' } } },
      { $group: {
        _id: null,
        records:    { $sum: 1 },
        total:      { $sum: '$net' },
        paid:       { $sum: '$paid' },
        balance:    { $sum: { $max: [0, { $subtract: ['$net', '$paid'] }] } },
        paid_count: { $sum: { $cond: [{ $eq: ['$status', 'paid'] }, 1, 0] } },
      } },
    ]),
  ]);

  // One query for this page's payments instead of one per row
  const ids  = rows.map((r) => r._id);
  const pays = ids.length
    ? await FeeCollect.find({ fee_assign_id: { $in: ids } }).sort({ paid_date: -1 }).lean()
    : [];
  const byAssign = new Map();
  for (const p of pays) {
    const key = String(p.fee_assign_id);
    if (!byAssign.has(key)) byAssign.set(key, []);
    byAssign.get(key).push(p);
  }

  const data = rows.map((a) => {
    const payments  = byAssign.get(String(a._id)) || [];
    const totalPaid = payments.reduce((s, p) => s + p.amount_paid, 0);
    const netAmount = a.amount - (a.discount || 0) + (a.fine || 0) + (a.carry_forward || 0);
    return {
      ...a.toObject(),
      payments,
      total_paid: totalPaid,
      net_amount: netAmount,
      balance:    Math.max(0, netAmount - totalPaid),
    };
  });

  const s = summaryAgg[0] || {};
  return {
    data, total, page, limit,
    summary: {
      records:       s.records || 0,
      total_amount:  round2(s.total),
      total_paid:    round2(s.paid),
      total_balance: round2(s.balance),
      paid_count:    s.paid_count || 0,
    },
  };
};

// ─── Collect fee payment ──────────────────────────────────────────────────────
const collectFee = async (feeAssignId, paymentData, schoolId, collectedBy) => {
  const assign = await FeeAssign.findOne({ _id: feeAssignId, school_id: schoolId });
  if (!assign) throw Object.assign(new Error('Fee assignment not found'), { statusCode: 404 });
  if (assign.status === 'paid') throw Object.assign(new Error('Fee already fully paid'), { statusCode: 400 });

  const existing  = await FeeCollect.aggregate([
    { $match: { fee_assign_id: ObjId(feeAssignId) } },
    { $group: { _id: null, total: { $sum: '$amount_paid' } } },
  ]);
  const alreadyPaid = existing[0]?.total || 0;
  const netAmount   = assign.amount - (assign.discount || 0) + (assign.fine || 0) + (assign.carry_forward || 0);
  const balance     = Math.max(0, netAmount - alreadyPaid);

  const amountToPay = Number(paymentData.amount_paid);
  if (amountToPay > balance) throw Object.assign(new Error(`Amount ₹${amountToPay} exceeds balance ₹${balance}`), { statusCode: 400 });
  if (amountToPay <= 0)      throw Object.assign(new Error('Amount must be greater than 0'), { statusCode: 400 });

  const receipt_no = await genReceiptNo(schoolId);
  // full = one payment clears the fee, final = clears what was left after earlier
  // instalments, partial = leaves a balance
  const paymentType = amountToPay >= balance - 0.001 ? (alreadyPaid > 0 ? 'final' : 'full') : 'partial';

  const collection = await FeeCollect.create({
    school_id:      schoolId,
    fee_assign_id:  feeAssignId,
    amount_paid:    amountToPay,
    paid_date:      paymentData.paid_date || new Date(),
    payment_method: paymentData.payment_method || 'cash',
    transaction_id: paymentData.transaction_id || uuidv4(),
    receipt_no,
    note:           paymentData.note,
    collected_by:   collectedBy,
    gateway:        paymentData.gateway || 'manual',
    payment_type:   paymentType,
    created_by:     collectedBy,
  });

  // Log transaction
  await Transaction.create({
    school_id:   schoolId,
    type:        'income',
    description: `Fee collection - ${receipt_no}`,
    amount:      amountToPay,
    date:        new Date(),
    reference:   receipt_no,
    category:    'fee',
    created_by:  collectedBy,
  });

  const updatedAssign = await FeeAssign.findById(feeAssignId)
    .populate({ path: 'student_id', populate: { path: 'user_id', select: 'name email' } })
    .populate({ path: 'fee_master_id', populate: ['fee_group_id', 'fee_type_id'] });

  return { collection, assign: updatedAssign, receipt_no, balance: Math.max(0, balance - amountToPay) };
};

// ─── Payment history (admin) — date range, method, type, class, search ───────
const getPayments = async (schoolId, query) => {
  const { page, limit, skip } = paginate(query);
  const tz   = await getSchoolTz(schoolId);
  const base = await paymentBase(schoolId, query, tz);

  const [rows, counted] = await Promise.all([
    FeeCollect.aggregate([...base, { $sort: { paid_date: -1, _id: -1 } }, { $skip: skip }, { $limit: limit }]),
    FeeCollect.aggregate([...base, { $count: 'n' }]),
  ]);

  const data = await FeeCollect.populate(rows, [
    { path: 'fee_assign_id', populate: [
      { path: 'student_id', populate: [
        { path: 'user_id', select: 'name email' },
        { path: 'class_setup_id', populate: ['class_id', 'section_id'] },
      ] },
      { path: 'fee_master_id', populate: ['fee_group_id', 'fee_type_id'] },
    ] },
    { path: 'collected_by', select: 'name' },
  ]);

  return { data, total: counted[0]?.n || 0, page, limit };
};

// ─── Collection report: totals, method/type split, day- or month-wise timeline ─
const getCollectionReport = async (schoolId, query) => {
  const tz      = await getSchoolTz(schoolId);
  const groupBy = query.group_by === 'month' ? 'month' : 'day';

  const today = dayString(new Date(), tz);
  const from  = query.from || query.to || today;
  const to    = query.to   || query.from || today;

  const base    = await paymentBase(schoolId, { ...query, from, to }, tz);
  const keyExpr = groupBy === 'month' ? { $substrBytes: ['$day', 0, 7] } : '$day';

  const [r] = await FeeCollect.aggregate([
    ...base,
    { $facet: {
      totals: [{ $group: { _id: null, total: { $sum: '$amount_paid' }, count: { $sum: 1 } } }],
      by_method: [
        { $group: { _id: '$payment_method', total: { $sum: '$amount_paid' }, count: { $sum: 1 } } },
        { $sort: { total: -1 } },
      ],
      by_type: [
        { $group: { _id: { $ifNull: ['$payment_type', 'unspecified'] }, total: { $sum: '$amount_paid' }, count: { $sum: 1 } } },
        { $sort: { total: -1 } },
      ],
      timeline: [
        { $group: { _id: { key: keyExpr, method: '$payment_method' }, total: { $sum: '$amount_paid' }, count: { $sum: 1 } } },
      ],
    } },
  ]);

  // Fold (bucket, method) rows into one row per bucket: { key, total, count, cash, upi, ... }
  const rows = new Map();
  for (const t of r.timeline) {
    const key    = t._id.key;
    const method = t._id.method || 'other';
    const row    = rows.get(key) || { key, total: 0, count: 0 };
    row.total += t.total;
    row.count += t.count;
    row[method] = round2((row[method] || 0) + t.total);
    rows.set(key, row);
  }
  // Include days/months with no collection so gaps are visible
  const keys = groupBy === 'month' ? eachMonth(from, to) : eachDay(from, to);
  const timeline = keys
    ? keys.map((key) => {
        const row = rows.get(key);
        return row ? { ...row, total: round2(row.total) } : { key, total: 0, count: 0 };
      })
    : [...rows.values()].sort((a, b) => a.key.localeCompare(b.key)).map((row) => ({ ...row, total: round2(row.total) }));

  const t = r.totals[0] || { total: 0, count: 0 };
  return {
    range:     { from, to, group_by: groupBy, timezone: tz },
    totals:    { total: round2(t.total), count: t.count, average: t.count ? round2(t.total / t.count) : 0 },
    by_method: r.by_method.map((m) => ({ method: m._id, total: round2(m.total), count: m.count })),
    by_type:   r.by_type.map((m) => ({ type: m._id, total: round2(m.total), count: m.count })),
    timeline,
  };
};

// ─── Today's collection (school's local date) with yesterday / month-to-date ──
const totalsFor = async (schoolId, from, to, tz) => {
  const base = await paymentBase(schoolId, { from, to }, tz);
  const [r] = await FeeCollect.aggregate([
    ...base,
    { $facet: {
      totals: [{ $group: { _id: null, total: { $sum: '$amount_paid' }, count: { $sum: 1 } } }],
      by_method: [
        { $group: { _id: '$payment_method', total: { $sum: '$amount_paid' }, count: { $sum: 1 } } },
        { $sort: { total: -1 } },
      ],
    } },
  ]);
  return {
    total:     round2(r.totals[0]?.total),
    count:     r.totals[0]?.count || 0,
    by_method: r.by_method.map((m) => ({ method: m._id, total: round2(m.total), count: m.count })),
  };
};

const getTodaySummary = async (schoolId) => {
  const tz        = await getSchoolTz(schoolId);
  const now       = new Date();
  const date      = dayString(now, tz);
  const yesterday = dayString(new Date(now.getTime() - 86400000), tz);
  const monthFrom = `${date.slice(0, 7)}-01`;

  const [today, prev, month] = await Promise.all([
    totalsFor(schoolId, date, date, tz),
    totalsFor(schoolId, yesterday, yesterday, tz),
    totalsFor(schoolId, monthFrom, date, tz),
  ]);

  return {
    date, timezone: tz, today,
    yesterday: { total: prev.total,  count: prev.count },
    month:     { total: month.total, count: month.count },
  };
};

// ─── Fee Report ───────────────────────────────────────────────────────────────
const getFeeReport = async (schoolId, query) => {
  const [summary, monthlyCollection, defaulters] = await Promise.all([
    FeeAssign.aggregate([
      { $match: { school_id: ObjId(schoolId) } },
      { $group: { _id: '$status', count: { $sum: 1 }, total_amount: { $sum: '$amount' } } },
    ]),
    FeeCollect.aggregate([
      { $match: { school_id: ObjId(schoolId) } },
      { $group: {
        _id:   { year: { $year: '$paid_date' }, month: { $month: '$paid_date' } },
        total: { $sum: '$amount_paid' },
        count: { $sum: 1 },
      }},
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]),
    FeeAssign.find({ school_id: schoolId, status: { $in: ['unpaid', 'partial', 'overdue'] } })
      .populate({ path: 'student_id', populate: [
        { path: 'user_id', select: 'name email phone' },
        { path: 'class_setup_id', populate: ['class_id', 'section_id'] },
      ]})
      .populate({ path: 'fee_master_id', populate: ['fee_group_id', 'fee_type_id'] })
      .sort({ due_date: 1 }).limit(100),
  ]);
  return { summary, monthlyCollection, defaulters };
};

const updateOverdue = async (schoolId) => {
  const result = await FeeAssign.updateMany(
    { school_id: schoolId, status: 'unpaid', due_date: { $lt: new Date() } },
    { $set: { status: 'overdue' } }
  );
  return result.modifiedCount;
};

// ─── Student: get my fees ─────────────────────────────────────────────────────
const getStudentFees = async (studentId, schoolId, query) => {
  const { page, limit, skip } = paginate(query);
  const filter = { student_id: studentId, school_id: schoolId };
  filter.status = query.status || { $nin: HIDDEN_FEE_STATUSES };

  const [assigns, total, summaryAgg] = await Promise.all([
    FeeAssign.find(filter)
      .populate({ path: 'fee_master_id', populate: ['fee_group_id', 'fee_type_id'] })
      .sort({ due_date: 1 }).skip(skip).limit(limit),
    FeeAssign.countDocuments(filter),
    FeeAssign.aggregate([
      { $match: { student_id: ObjId(studentId), school_id: ObjId(schoolId), status: { $nin: HIDDEN_FEE_STATUSES } } },
      { $group: {
        _id:            null,
        total_amount:   { $sum: { $add: ['$amount', '$carry_forward'] } },
        total_discount: { $sum: '$discount' },
        total_fine:     { $sum: '$fine' },
      }},
    ]),
  ]);

  const data = await Promise.all(assigns.map(async (a) => {
    const payments  = await FeeCollect.find({ fee_assign_id: a._id }).sort({ paid_date: -1 });
    const totalPaid = payments.reduce((s, p) => s + p.amount_paid, 0);
    const netAmount = a.amount - (a.discount || 0) + (a.fine || 0) + (a.carry_forward || 0);
    return { ...a.toObject(), payments, total_paid: totalPaid, net_amount: netAmount, balance: Math.max(0, netAmount - totalPaid) };
  }));

  const agg      = summaryAgg[0] || { total_amount: 0, total_discount: 0, total_fine: 0 };
  const paidAgg  = await FeeCollect.aggregate([
    { $match: { fee_assign_id: { $in: assigns.map(a => a._id) } } },
    { $group: { _id: null, total_paid: { $sum: '$amount_paid' } } },
  ]);
  const totalPaid = paidAgg[0]?.total_paid || 0;
  const netTotal  = agg.total_amount - (agg.total_discount || 0) + (agg.total_fine || 0);

  return {
    data, total, page, limit,
    summary: { total_amount: agg.total_amount, net_total: netTotal, total_paid: totalPaid, balance: Math.max(0, netTotal - totalPaid) },
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

module.exports = {
  getGroups, createGroup, updateGroup, deleteGroup,
  getTypes,  createType,  updateType,  deleteType,
  getMasters,createMaster,updateMaster,deleteMaster,
  bulkAssign, getAssignments, editAssignment,
  collectFee, getPayments,
  getFeeReport, updateOverdue,
  getCollectionReport, getTodaySummary,
  getStudentFees, getStudentPayments,
};
