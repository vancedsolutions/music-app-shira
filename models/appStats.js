var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var appStatSchema = new mongoose.Schema({
  createdDate: { type: Date, default: new Date() },
  androidDownloads: { type: Number, default: 0 },
  iosDownloads: { type: Number, default: 0 }
});

module.exports = mongoose.model('AppStats', appStatSchema);
