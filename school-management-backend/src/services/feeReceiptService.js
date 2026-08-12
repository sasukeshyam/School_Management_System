const { FeeCollect, FeeAssign } = require('../models/Fee');
const { Student } = require('../models/Student');
const nodemailer  = require('nodemailer');

// ─── Generate PDF receipt ────────────────────────────────────────────────────
const generateReceiptPDF = async (paymentId, schoolId) => {
  const payment = await FeeCollect.findById(paymentId)
    .populate({
      path: 'fee_assign_id',
      populate: [
        { path: 'student_id', populate: { path: 'user_id', select: 'name email phone' } },
        { path: 'fee_master_id', populate: ['fee_group_id', 'fee_type_id'] },
      ]
    })
    .populate('collected_by', 'name')

  if (!payment) throw new Error('Payment not found')

  const assign  = payment.fee_assign_id
  const student = assign?.student_id
  const user    = student?.user_id

  // Generate HTML receipt
  const html = `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  body { font-family: Arial, sans-serif; margin: 0; padding: 20px; color: #333; }
  .header { text-align: center; border-bottom: 2px solid #4f46e5; padding-bottom: 20px; margin-bottom: 20px; }
  .header h1 { color: #4f46e5; margin: 0; font-size: 24px; }
  .header p { margin: 5px 0; color: #666; }
  .receipt-no { background: #4f46e5; color: white; padding: 8px 16px; border-radius: 6px; display: inline-block; font-weight: bold; font-size: 14px; }
  .section { margin-bottom: 20px; }
  .section h3 { color: #4f46e5; border-bottom: 1px solid #e5e7eb; padding-bottom: 8px; }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 8px 12px; border-bottom: 1px solid #f3f4f6; }
  td:first-child { color: #666; width: 40%; }
  td:last-child { font-weight: 500; }
  .amount-row td { background: #f0fdf4; font-size: 18px; font-weight: bold; color: #16a34a; }
  .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #666; font-size: 12px; }
  .status-paid { background: #dcfce7; color: #16a34a; padding: 4px 12px; border-radius: 20px; font-weight: bold; }
</style>
</head>
<body>
  <div class="header">
    <h1>EduCore School Management</h1>
    <p>Fee Payment Receipt</p>
    <div class="receipt-no">${payment.receipt_no}</div>
  </div>

  <div class="section">
    <h3>Student Information</h3>
    <table>
      <tr><td>Student Name</td><td>${user?.name || '—'}</td></tr>
      <tr><td>Email</td><td>${user?.email || '—'}</td></tr>
      <tr><td>Phone</td><td>${user?.phone || '—'}</td></tr>
      <tr><td>Admission No</td><td>${student?.admission_no || '—'}</td></tr>
    </table>
  </div>

  <div class="section">
    <h3>Payment Details</h3>
    <table>
      <tr><td>Fee Type</td><td>${assign?.fee_master_id?.fee_type_id?.name || '—'}</td></tr>
      <tr><td>Fee Group</td><td>${assign?.fee_master_id?.fee_group_id?.name || '—'}</td></tr>
      <tr><td>Payment Date</td><td>${new Date(payment.paid_date).toLocaleDateString('en-IN', { day:'numeric',month:'long',year:'numeric' })}</td></tr>
      <tr><td>Payment Method</td><td>${payment.payment_method?.toUpperCase()}</td></tr>
      ${payment.transaction_id ? `<tr><td>Transaction ID</td><td>${payment.transaction_id}</td></tr>` : ''}
      <tr><td>Collected By</td><td>${payment.collected_by?.name || 'System'}</td></tr>
      <tr><td>Status</td><td><span class="status-paid">PAID</span></td></tr>
    </table>
  </div>

  <div class="section">
    <table>
      <tr><td>Total Fee Amount</td><td>${fmtCurrency(assign?.amount)}</td></tr>
      ${assign?.discount ? `<tr><td>Discount Applied</td><td>- ${fmtCurrency(assign.discount)}</td></tr>` : ''}
      <tr class="amount-row"><td>Amount Paid</td><td>${fmtCurrency(payment.amount_paid)}</td></tr>
    </table>
  </div>

  <div class="footer">
    <p>This is a computer-generated receipt and does not require a signature.</p>
    <p>Thank you for your payment!</p>
  </div>
</body>
</html>`;

  return { html, payment, student, user };
};

const fmtCurrency = (amount) => `₹${(amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

// ─── Send overdue email reminders ─────────────────────────────────────────────
const sendOverdueReminders = async (schoolId) => {
  const { FeeAssign } = require('../models/Fee')
  const School  = require('../models/School')

  const school   = await School.findById(schoolId)
  const overdue  = await FeeAssign.find({
    school_id: schoolId,
    status:    { $in: ['unpaid', 'partial'] },
    due_date:  { $lt: new Date() },
  }).populate({ path: 'student_id', populate: { path: 'user_id', select: 'name email' } })
    .populate({ path: 'fee_master_id', populate: ['fee_type_id', 'fee_group_id'] })

  if (!overdue.length) return { sent: 0 }

  const transporter = nodemailer.createTransport({
    host:   process.env.MAIL_HOST,
    port:   Number(process.env.MAIL_PORT) || 587,
    secure: false,
    auth:   { user: process.env.MAIL_USER, pass: process.env.MAIL_PASS },
  })

  let sent = 0
  for (const assign of overdue) {
    const email = assign.student_id?.user_id?.email
    if (!email) continue

    const netAmount = assign.amount - (assign.discount || 0) + (assign.fine || 0)

    await transporter.sendMail({
      from:    `"${school?.name || 'EduCore'}" <${process.env.MAIL_FROM || process.env.MAIL_USER}>`,
      to:      email,
      subject: `Fee Payment Reminder - ${assign.fee_master_id?.fee_type_id?.name}`,
      html: `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
  <div style="background:#4f46e5;padding:20px;border-radius:8px 8px 0 0;text-align:center;">
    <h2 style="color:white;margin:0;">Fee Payment Reminder</h2>
  </div>
  <div style="border:1px solid #e5e7eb;border-top:none;padding:20px;border-radius:0 0 8px 8px;">
    <p>Dear <strong>${assign.student_id?.user_id?.name}</strong>,</p>
    <p>This is a reminder that your fee payment is <strong style="color:#ef4444;">overdue</strong>.</p>
    <table style="width:100%;border-collapse:collapse;margin:15px 0;">
      <tr style="background:#f9fafb;">
        <td style="padding:10px;border:1px solid #e5e7eb;">Fee Type</td>
        <td style="padding:10px;border:1px solid #e5e7eb;font-weight:bold;">${assign.fee_master_id?.fee_type_id?.name}</td>
      </tr>
      <tr>
        <td style="padding:10px;border:1px solid #e5e7eb;">Amount Due</td>
        <td style="padding:10px;border:1px solid #e5e7eb;font-weight:bold;color:#ef4444;">${fmtCurrency(netAmount)}</td>
      </tr>
      <tr style="background:#f9fafb;">
        <td style="padding:10px;border:1px solid #e5e7eb;">Due Date</td>
        <td style="padding:10px;border:1px solid #e5e7eb;">${new Date(assign.due_date).toLocaleDateString('en-IN')}</td>
      </tr>
    </table>
    <p>Please clear your dues as soon as possible to avoid any late fees.</p>
    <p>If you have already made the payment, please ignore this email.</p>
    <p style="color:#666;font-size:12px;margin-top:20px;">This is an automated reminder from ${school?.name || 'EduCore'}.</p>
  </div>
</div>`,
    })
    sent++
  }

  return { sent, total: overdue.length }
}

module.exports = { generateReceiptPDF, sendOverdueReminders }