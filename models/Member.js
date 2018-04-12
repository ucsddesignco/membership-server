const mongoose = require('mongoose');

const { Schema } = mongoose;

const memberSchema = new Schema({
  email: { type: String, lowercase: true, unique: true, required: true },
  qrUrl: String,
  emailSent: { type: Boolean, default: false },
});

module.exports = mongoose.model('member', memberSchema);
