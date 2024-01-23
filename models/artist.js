var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var _ = require('lodash');
var bcryptSync = require('bcrypt-nodejs')
var Bluebird = require('bluebird')
const bcrypt = Bluebird.promisifyAll(bcryptSync)

var artistSchema = new mongoose.Schema({
  name:{ type: String, default: '' },
  nameHebrew : {type: String, default: ''},
  labels: [{ type: Schema.ObjectId, ref: 'Labels' }],
  emailAddress: { type: String, default: '' },
  password: { type: String },
  phoneNumber: {type: String, default:''},
  royaltyCost:{ type: Number, default: 0 },
  avatar: { type: String, default: 'https://s3-us-west-1.amazonaws.com/shiralidevelopment/profile-empty-state.png' },
  genres:[{ type: Schema.ObjectId, ref: 'Genres' }],
  tags: [{ type: Schema.ObjectId, ref: 'Tags', index: true }],
  relatedSongs: [{ type: Schema.ObjectId, ref: 'Songs', index: true }],
  relatedArtists: [{ type: Schema.ObjectId, ref: 'Artists' }],
  bankAccount: {
    streetAddress: { type: String, default: '' },
    aptNumber: { type: String, default: '' },
    city: { type: String, default: '' },
    state: { type: String, default: '' },  
    zipcode: { type: String, default: '' },
    bankName: { type: String, default: '' },
    account: {}
  },
  stripe_account_id:{ type: String, default: '' },
  songCount: { type: Number, default: 0 },
  albumCount: { type: Number, default: 0 },
  shortid: { type: String, default: '' },
  shareUrl: { type: String, default: '' },
  isActive: { type: Boolean, default: true },
  isPremium: { type: Boolean, default: false },
  deleted: { type: Boolean, default: false },
  createdDate:{ type: Date, default: new Date() },
  updatedDate: { type: Date, default: new Date() },
  language: {type: String, default: 'english'},
});

artistSchema.pre('findOneAndUpdate', function (next) {
  const password = _.get(this._update, '$set.password', false)
  if (password) {
    const SALT_FACTOR = 5
    return bcrypt.genSaltAsync(SALT_FACTOR)
      .then((salt) => {
        return bcrypt.hashAsync(password, salt, null)
      })
      .then((hash) => {
        this._update.password = hash
        return next()
      })
      .catch((err) => next(err))
  } else {
    return next()
  }
})

artistSchema.methods.comparePassword = function(password, cb) {
  bcrypt.compare(password, this.password, function(err, isMatch) {
    if (err) return cb(err);
    cb(null, isMatch);
  });
};

//https://shiralidevelopment.s3-us-west-1.amazonaws.com/artist/1512023300556.png
module.exports = mongoose.model('Artists', artistSchema);
