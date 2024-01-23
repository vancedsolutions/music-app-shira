var mongoose = require('mongoose');
var bankDetailsSchema = new mongoose.Schema({
  streetAddress: { type: String, default: '' },
  aptNumber: { type: String, default: '' },
  city: { type: String, default: '' },
  state: { type: String, default: '' },  
  zipcode: { type: String, default: '' },
  bankName: { type: String, default: '' },
  routingNumber: { type: String, default: '' },
  accountNumber: { type: String, default: '' }
});

module.exports = mongoose.model('BankDetails', bankDetailsSchema);
