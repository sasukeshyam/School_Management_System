const mongoose = require('mongoose');
const auditPlugin = require('../utils/baseSchema');

const schoolSchema = new mongoose.Schema({
  name:         { type: String, required: true, trim: true },
  address:      { type: String, trim: true },
  phone:        { type: String, trim: true },
  email:        { type: String, lowercase: true, trim: true },
  logo:         { type: String },
  tagline:          { type: String, trim: true },
  registration_no:  { type: String, trim: true },
  established_year: { type: Number, min: 1800, max: 2100 },
  website:      { type: String },
  currency:     { type: String, default: 'INR' },
  timezone:     { type: String, default: 'Asia/Kolkata' },
  subscription: { type: String, enum: ['free', 'basic', 'premium', 'enterprise'], default: 'free' },
  is_active:    { type: Boolean, default: true },
});

schoolSchema.plugin(auditPlugin);

module.exports = mongoose.model('School', schoolSchema);
