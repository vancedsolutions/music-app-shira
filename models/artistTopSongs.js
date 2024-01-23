var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var artistTopSongsSchema = new mongoose.Schema({
	artistId: { type: Schema.ObjectId, ref: 'Artists', index: true },
  artistName: { type: String, default: '' },
  streamedCount: { type: Number, default: 0 },
  startDate: { type: Date, default: new Date()},
  endDate: { type: Date, default: new Date()}
});
module.exports = mongoose.model('ArtistTopSongs', artistTopSongsSchema);