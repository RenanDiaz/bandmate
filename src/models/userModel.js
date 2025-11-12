const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true },
    firstname: { type: String, required: true },
    lastname: { type: String, required: true },
    nickname: { type: String },
    password: { type: String, required: true },
    failedLoginAttempts: { type: Number, default: 0 },
    locked: { type: Boolean, default: false },
    trialExpirationDate: { type: Date },
    emailConfirmed: { type: Boolean, default: false },
    forcePasswordChange: { type: Boolean, default: false },
    roles: [String],
  },
  { timestamps: true }
);

const User = mongoose.model("User", UserSchema);

module.exports = User;
