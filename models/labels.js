var mongoose = require('mongoose');
var labelsSchema = new mongoose.Schema({
  labelName: { type: String, default: '' },
  isActive: { type: Boolean, default: true },
  deleted: { type: Boolean, default: false },
  createdDate: { type: Date, default: new Date() },
  updatedDate: { type: Date, default: new Date() }
});

module.exports = mongoose.model('Labels', labelsSchema);
