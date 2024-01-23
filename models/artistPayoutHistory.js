var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var artistPayoutHistorySchema = new mongoose.Schema({
  artist: { type: Schema.ObjectId, ref: 'Artists' },  
  type: { type: String, default: '' },  
  perPaidStreamRate: { type: Number, default: 0 },
  perFreeStreamRate: { type: Number, default: 0 },
  payout: {},
  songsPaid: [],
  month: { type: Number, default: 0 },
  year: { type: Number, default: 0 },  
  payoutDate: { type: Date, default: new Date() },
  payoutBy: { type: Schema.ObjectId, ref: 'Users' }
});
module.exports = mongoose.model('ArtistPayoutHistory', artistPayoutHistorySchema);
