var mongoose = require('mongoose');
var campaignSchema = new mongoose.Schema({
  advertisor : {
    primaryaddress: {
      state: {type: String, default: '' },
      city: {type: String, default: '' },
      streetAddress: {type: String, default: '' },
      aptNumber:{type: String, default:''},
      zip: {type: String, default: '' },
    },
    name: {type: String, default: '' },
    email: {type: String, default: '' },
    billingAddress: {
      state: {type: String, default: '' },
      city: {type: String, default: '' },
      streetAddress: {type: String, default: '' },
      aptNumber:{type: String, default:''},
      zip: {type: String, default: '' },
    },
    isDifferentBillingAddress : {type: Boolean, default: false },
    updatedDate: {type: Date, default: new Date()},
    customerId : { type: String, default: '' }
  },
  ads: {
    adFormat: { type: String, default: '' },
    adFileUrl: { type: String, default: '' },
    adArtworkUrl: { type: String, default: '' },
    isActive: { type: Boolean, default: true },
    deleted: { type: Boolean, default: false },
    updatedDate: { type: Date, default: new Date()},
    createDate: { type: Date, default: new Date() },
    adDuration: { type: Number, default: 0 },
    redirectUrl: { type: String, default: '' }
  },
  campaign: {
    startDate: {type: Date, default: '' },
    endDate: {type: Date, default: '' },
    impressionCount: {type: Number, default: 0 },
    isOverAge: { type: Boolean, default: false },
    overAgeCap: { type: Number, default: 0 },
    amount: {type: Number, default: 0 },
    payment : {},
    viewCount: {type: Number, default: 0 },
    clickCount: {type: Number, default: 0 },
    amountPerImpression: {type: Number, default: 0 },
    createDate: {type: Date, default: new Date() },
    updatedDate: {type: Date, default: new Date() }
  }
});
module.exports = mongoose.model('Campaign', campaignSchema);
