var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var artistPaymentsSchema = new mongoose.Schema({
  month: { type: Number, default: 0 },
  year: { type: Number, default: 0 },
  totalRevenue: { type: Number, default: 0 },
  totalPaidStreams: { type: Number, default: 0 },
  totalFreeStreams: { type: Number, default: 0 },
  artists: [],
  recipients: []
});
module.exports = mongoose.model('ArtistPayments', artistPaymentsSchema);
