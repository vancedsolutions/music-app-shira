var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var campaignStatsSchema = new mongoose.Schema({
  date: { type: Date, default: new Date() },
  userId: [{ type: Schema.ObjectId, ref: 'Users', default: [] }],
  campaignId: { type: Schema.ObjectId, ref: 'Campaign' },
  viewCount: { type: Number, default: 0 },
  clickUserId: [{ type: Schema.ObjectId, ref: 'Users', default: [] }],
  clickCount: { type: Number, default: 0 }
});

module.exports = mongoose.model('CampaignStats', campaignStatsSchema);
