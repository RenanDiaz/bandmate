const mongoose = require("mongoose");

const bandSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    genre: { type: String, required: true },
    yearFormed: { type: Number, required: true },
    active: { type: Boolean, default: true },
    type: { type: String, enum: ["cover", "original", "tribute"] },
  },
  { timestamps: true }
);

const Band = mongoose.model("Band", bandSchema);

module.exports = Band;
