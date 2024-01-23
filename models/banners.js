var mongoose = require('mongoose');
var bannersSchema = new mongoose.Schema({
  imageUrl: { type: String, default: '' },
  recid: { type: String, default: '' },  
  type: { type: String, default: '' },
  order: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
  deleted:{ type: Boolean, default: false },
  createdDate:{ type: Date, default: new Date() },
  updatedDate:{ type: Date, default: new Date() }
});

module.exports = mongoose.model('Banners', bannersSchema);
