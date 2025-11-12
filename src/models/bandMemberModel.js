const mongoose = require("mongoose");

const bandMemberSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    band: { type: mongoose.Schema.Types.ObjectId, ref: "Band", required: true },
    instruments: [{ type: String, required: true }],
    dateJoined: { type: Date, required: true },
    dateLeft: { type: Date },
  },
  { timestamps: true }
);

bandMemberSchema.index({ user: 1, band: 1 }, { unique: true });

const BandMember = mongoose.model("BandMember", bandMemberSchema);

module.exports = BandMember;
