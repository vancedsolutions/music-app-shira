var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var applogsSchema = new mongoose.Schema({
  deviceType: { type: String, default: '' }, 
  createdDate: { type: Date, default: new Date() },
  userId: { type: Schema.ObjectId, ref: 'Users', index: true }, 
  songId: { type: Schema.ObjectId, ref: 'Songs', index: true },
  tags: [{ type: Schema.ObjectId, ref: 'Tags' }],
  genres: [{ type: Schema.ObjectId, ref: 'Genres' }],
  eventType: { type: String, default: '' }, 
});

module.exports = mongoose.model('AppLogs', applogsSchema);
