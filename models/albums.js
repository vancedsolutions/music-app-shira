var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var albumsSchema = new mongoose.Schema({
  title: { type: String, default: '' },
  titleHebrew : {type: String, default: ''},
  language:{ type: String, default:''},
  creationDate: { type: Date, default: new Date() },
  artwork: { type: String, default: 'https://s3-us-west-1.amazonaws.com/shiralidevelopment/ic_place_logo.png' },
  isExclusive: { type: Boolean, default: false },
  isNewRelease: { type: Boolean, default: false },  
  artist: { type: Schema.ObjectId, ref: 'Artists', index: true }, 
  tags: [{ type: Schema.ObjectId, ref: 'Tags', index: true }],
  songs: [{ type: Schema.ObjectId, ref: 'Songs', index: true }],
  songCount: { type: Number, default: 0 },
  totalDuration: { type: String, default: '' },
  shortid: { type: String, default: '' },
  shareUrl: { type: String, default: '' },
  isActive: { type: Boolean, default: true },
  deleted: { type: Boolean, default: false }, 
  isPremium: { type: Boolean, default: false },
  premiumDays:{type:Number, default:0},
  premiumExpDate:{type:Date}, 
  createdDate: { type: Date, default: new Date() },
  updatedDate: { type: Date, default: new Date() }
});

module.exports = mongoose.model('Albums', albumsSchema);
