var mongoose = require('mongoose');
var genresSchema = new mongoose.Schema({
  title: { type: String, default: '' },
  titleHebrew: { type: String, default: '' },
  language: {type: String, default:'english'},
  icon: { type: String, default: 'https://s3-us-west-1.amazonaws.com/shiralidevelopment/ic_place_logo.png' },  
  isActive: { type: Boolean, default: true },
  deleted: { type: Boolean, default: false },
  createdDate: { type: Date, default: new Date() },
  updatedDate: { type: Date, default: new Date() }
});

module.exports = mongoose.model('Genres', genresSchema);
