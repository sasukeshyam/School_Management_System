const mongoose = require('mongoose');
const auditPlugin = require('../utils/baseSchema');
const S = mongoose.Schema.Types.ObjectId;

const admissionSchema = new mongoose.Schema({
  // Which school
  school_id:        { type: S, ref: 'School', required: true, index: true },
  session_id:       { type: S, ref: 'Session' },

  // Student details
  student_name:     { type: String, required: true, trim: true },
  dob:              { type: Date,   required: true },
  gender:           { type: String, required: true, enum: ['male','female','other'] },
  blood_group:      { type: String, enum: ['A+','A-','B+','B-','AB+','AB-','O+','O-',''] },
  religion:         { type: String, trim: true },
  address:          { type: String, trim: true },

  // Parent/Guardian details
  father_name:      { type: String, trim: true },
  father_phone:     { type: String, trim: true },
  mother_name:      { type: String, trim: true },
  mother_phone:     { type: String, trim: true },
  guardian_name:    { type: String, trim: true },
  guardian_email:   { type: String, required: true, lowercase: true, trim: true },
  guardian_phone:   { type: String, trim: true },
  relation:         { type: String, trim: true }, // Father / Mother / Guardian

  // Academic
  class_applying_for: { type: String, required: true, trim: true }, // e.g. "Class 6"
  previous_school:    { type: String, trim: true },
  previous_class:     { type: String, trim: true },

  // Application status
  status:             { type: String, enum: ['pending','approved','rejected'], default: 'pending', index: true },
  rejection_reason:   { type: String, trim: true },
  applied_at:         { type: Date, default: Date.now },
  reviewed_at:        { type: Date },
  reviewed_by:        { type: S, ref: 'User' },

  // Created after approval
  student_id:         { type: S, ref: 'Student', default: null },
  admission_number:   { type: String, trim: true },
});

admissionSchema.plugin(auditPlugin);
module.exports = mongoose.model('Admission', admissionSchema);