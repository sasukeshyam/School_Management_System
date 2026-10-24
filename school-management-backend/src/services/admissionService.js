const mongoose  = require('mongoose');
const Admission = require('../models/Admission');
const School    = require('../models/School');
const Session   = require('../models/Session');
const User      = require('../models/User');
const { Student } = require('../models/Student');
const { Role, UserRole } = require('../models/Role');
const { paginate } = require('../utils/pagination');
const nodemailer = require('nodemailer');

// ─── Generate admission number ─────────────────────────────────────────────────
const genAdmissionNo = async (schoolId) => {
  const year  = new Date().getFullYear();
  const count = await Admission.countDocuments({ school_id: schoolId, status: 'approved' });
  return `ADM-${year}-${String(count + 1).padStart(4, '0')}`;
};

// ─── Send welcome email ───────────────────────────────────────────────────────
const sendWelcomeEmail = async ({ to, studentName, schoolName, schoolId, email, password, admissionNo }) => {
  try {
    const transporter = nodemailer.createTransport({
      host:   process.env.MAIL_HOST,
      port:   Number(process.env.MAIL_PORT) || 587,
      secure: false,
      auth:   { user: process.env.MAIL_USER, pass: process.env.MAIL_PASS },
    });

    await transporter.sendMail({
      from:    `"${schoolName}" <${process.env.MAIL_FROM || process.env.MAIL_USER}>`,
      to,
      subject: `Admission Approved — ${schoolName}`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
        <div style="background:#4f46e5;padding:30px;border-radius:12px 12px 0 0;text-align:center;">
            <h1 style="color:white;margin:0;font-size:24px;">🎉 Admission Approved!</h1>
            <p style="color:rgba(255,255,255,0.8);margin-top:8px;">${schoolName}</p>
        </div>
        <div style="border:1px solid #e5e7eb;border-top:none;padding:30px;border-radius:0 0 12px 12px;">
            <p>Dear <strong>${studentName}</strong>,</p>
            <p>Congratulations! Your admission application has been <strong style="color:#16a34a;">approved</strong>.</p>

            <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:20px;margin:20px 0;">
            <h3 style="margin:0 0 15px;color:#374151;">Your Login Credentials</h3>
            <table style="width:100%;border-collapse:collapse;">
                <tr><td style="padding:8px 0;color:#6b7280;">Admission No</td><td style="font-weight:bold;">${admissionNo}</td></tr>
                <tr><td style="padding:8px 0;color:#6b7280;">School ID</td><td style="font-weight:bold;font-family:monospace;">${schoolId}</td></tr>
                <tr><td style="padding:8px 0;color:#6b7280;">Email</td><td style="font-weight:bold;">${email}</td></tr>
                <tr><td style="padding:8px 0;color:#6b7280;">Password</td><td style="font-weight:bold;">${password}</td></tr>
            </table>
            </div>

            <p style="color:#ef4444;font-size:14px;">⚠️ Please change your password after first login.</p>
            <p style="color:#6b7280;font-size:13px;">Login at your school portal and use the above credentials.</p>
        </div>
        </div>`,
    });
    return true;
  } catch (err) {
    console.error('Welcome email failed:', err.message);
    return false;
  }
};

// ─── Submit admission (public) ────────────────────────────────────────────────
const submitAdmission = async (data) => {
  const school = await School.findById(data.school_id);
  if (!school || !school.is_active) {
    throw Object.assign(new Error('School not found or inactive'), { statusCode: 404 });
  }

  // Get current session
  const session = await Session.findOne({ school_id: data.school_id, is_current: true });

  const admission = await Admission.create({
    ...data,
    session_id: session?._id || null,
    status:     'pending',
    applied_at: new Date(),
  });

  return admission;
};

// ─── Get all admissions (admin) ───────────────────────────────────────────────
const getAdmissions = async (schoolId, query) => {
  const { page, limit, skip, sort } = paginate(query);
  const filter = { school_id: schoolId };
  if (query.status) filter.status = query.status;
  if (query.search) {
    filter.$or = [
      { student_name:   { $regex: query.search, $options: 'i' } },
      { guardian_email: { $regex: query.search, $options: 'i' } },
      { guardian_phone: { $regex: query.search, $options: 'i' } },
      { admission_number: { $regex: query.search, $options: 'i' } },
    ];
  }

  const [data, total] = await Promise.all([
    Admission.find(filter)
      .populate('reviewed_by', 'name')
      .sort({ applied_at: -1 }).skip(skip).limit(limit),
    Admission.countDocuments(filter),
  ]);

  // Count by status
  const [pending, approved, rejected] = await Promise.all([
    Admission.countDocuments({ school_id: schoolId, status: 'pending' }),
    Admission.countDocuments({ school_id: schoolId, status: 'approved' }),
    Admission.countDocuments({ school_id: schoolId, status: 'rejected' }),
  ]);

  return { data, total, page, limit, counts: { pending, approved, rejected } };
};

// ─── Get one admission ────────────────────────────────────────────────────────
const getAdmission = async (id, schoolId) => {
  return Admission.findOne({ _id: id, school_id: schoolId }).populate('reviewed_by', 'name');
};

// ─── Approve admission ────────────────────────────────────────────────────────
const approveAdmission = async (id, schoolId, reviewedBy) => {
  const admission = await Admission.findOne({ _id: id, school_id: schoolId });
  if (!admission)            throw Object.assign(new Error('Admission not found'), { statusCode: 404 });
  if (admission.status !== 'pending') throw Object.assign(new Error('Admission already processed'), { statusCode: 400 });

  const school  = await School.findById(schoolId);
  const session = await Session.findOne({ school_id: schoolId, is_current: true });

  // Generate admission number
  const admissionNo = await genAdmissionNo(schoolId);
  const password    = 'Student@123456';

  // 1. Create User account
  const existingUser = await User.findOne({ email: admission.guardian_email, school_id: schoolId });
  let user = existingUser;
  if (!user) {
    user = await User.create({
      school_id:     schoolId,
      name:          admission.student_name,
      email:         admission.guardian_email,
      password_hash: password,
      phone:         admission.guardian_phone || admission.father_phone || admission.mother_phone,
      is_active:     true,
    });
  }

  // // 2. Create Student profile
  // const student = await Student.create({
  //   school_id:       schoolId,
  //   session_id:      session?._id,
  //   user_id:         user._id,
  //   admission_no:    admissionNo,
  //   dob:             admission.dob,
  //   gender:          admission.gender,
  //   blood_group:     admission.blood_group,
  //   religion:        admission.religion,
  //   address:         admission.address,
  //   father_name:     admission.father_name,
  //   father_phone:    admission.father_phone,
  //   mother_name:     admission.mother_name,
  //   mother_phone:    admission.mother_phone,
  //   status:          'active',
  //   enrollment_date: new Date(),
  // });

  // 2. Create Student profile — auto-generate roll number
  const studentCount = await Student.countDocuments({ school_id: schoolId });
  const rollNumber   = String(studentCount + 1).padStart(3, '0');

  const student = await Student.create({
    school_id:       schoolId,
    session_id:      session?._id,
    user_id:         user._id,
    admission_no:    admissionNo,
    roll_number:     rollNumber,
    dob:             admission.dob,
    gender:          admission.gender,
    blood_group:     admission.blood_group || '',
    religion:        admission.religion    || '',
    address:         admission.address     || '',
    father_name:     admission.father_name || '',
    father_phone:    admission.father_phone|| '',
    mother_name:     admission.mother_name || '',
    mother_phone:    admission.mother_phone|| '',
    status:          'active',
    enrollment_date: new Date(),
  });

  // 3. Assign student role
  const studentRole = await Role.findOne({ slug: 'student', school_id: schoolId });
  if (studentRole) {
    await UserRole.findOneAndUpdate(
      { user_id: user._id, school_id: schoolId },
      { user_id: user._id, role_id: studentRole._id, school_id: schoolId, assigned_by: reviewedBy },
      { upsert: true, new: true }
    );
  }

  // 4. Update admission record
  await Admission.findByIdAndUpdate(id, {
    status:           'approved',
    reviewed_at:      new Date(),
    reviewed_by:      reviewedBy,
    student_id:       student._id,
    admission_number: admissionNo,
  });

  // 5. Send welcome email
  await sendWelcomeEmail({
    to:          admission.guardian_email,
    studentName: admission.student_name,
    schoolName:  school?.name || 'EduCore School',
    schoolId:    schoolId.toString(),
    email:       admission.guardian_email,
    password,
    admissionNo,
  });

  return { admission, student, user, admissionNo };
};

// ─── Reject admission ─────────────────────────────────────────────────────────
const rejectAdmission = async (id, schoolId, reviewedBy, reason) => {
  const admission = await Admission.findOne({ _id: id, school_id: schoolId });
  if (!admission)            throw Object.assign(new Error('Admission not found'), { statusCode: 404 });
  if (admission.status !== 'pending') throw Object.assign(new Error('Admission already processed'), { statusCode: 400 });

  return Admission.findByIdAndUpdate(id, {
    status:           'rejected',
    rejection_reason: reason || 'Application rejected',
    reviewed_at:      new Date(),
    reviewed_by:      reviewedBy,
  }, { new: true });
};

// ─── Get all active schools (for public apply page) ───────────────────────────
const getActiveSchools = async () => {
  return School.find({ is_active: true, is_deleted: false })
    .select('_id name address email phone')
    .sort({ name: 1 });
};

// ─── Bulk approve admissions ──────────────────────────────────────────────────
const bulkApprove = async (ids, schoolId, reviewedBy) => {
  const results = { approved: [], failed: [] }
  for (const id of ids) {
    try {
      const result = await approveAdmission(id, schoolId, reviewedBy)
      results.approved.push({ id, admissionNo: result.admissionNo })
    } catch (err) {
      results.failed.push({ id, reason: err.message })
    }
  }
  return results
}

module.exports = {
  submitAdmission,
  getAdmissions,
  getAdmission,
  approveAdmission,
  rejectAdmission,
  getActiveSchools,
  bulkApprove,
};