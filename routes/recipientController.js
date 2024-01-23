var Recipient = require('../models/recipients');
var User = require('../models/users');
var Artist = require('../models/artist');
var Config = require('../config/config');
var stripe = require("stripe")(Config.config().stripe_key);
var EmailService = require('../service/email')
var Promise = require('bluebird');

//API to create a recipient
exports.createRecipient = function (req, res) {
  var extAccount = req.body.account
  stripe.accounts.create({
    type: 'custom',
    country: 'US'          
  }, function(err, account) {
    if(account) {
      var recipient = new Recipient({
        name: req.body.recipientName,
        bankName: req.body.bankName
      })
      recipient.stripe_account_id = account.id
      stripe.accounts.createExternalAccount(
        account.id,
        { external_account: extAccount.id },
        function(err, bank_account) {
          if(bank_account) {
            recipient.account = bank_account
            recipient.save()
            return res.json({
              success: true,
              message: "Recipient saved successfully.",
              recipient: recipient
            });
          } else {
            res.status(403).send({
              success: false,
              message: "Error in processing the request."
            });
          }
        }
      );
    }
  });
}

//API to update a recipient
exports.updateRecipient = function (req, res) {
  var id = req.body.id;
  Recipient.findOne({
    _id: id
  })
  .then((recipient) => {
    if (!recipient) {
      return res.json({
        success: false,
        message: "No recipient found."
      });
    } else {
      if(!req.body.account) {
        recipient.bankName = req.body.bankName;
        recipient.name = req.body.recipientName;
        recipient.save();
        return res.json({
          success: true,
          message: "Changes saved successfully."
        });
      } else {
        recipient.bankName = req.body.bankName;
        recipient.name = req.body.recipientName;
        recipient.account = req.body.account;
        recipient.stripe_account_id = account.id;
        recipient.save();
        return res.json({
          success: true,
          message: "Changes saved successfully."
        });
      }
    }
  })
}

//Api to delete a Artist
exports.deleteRecipient = function(req, res) {
  var id = req.params.id;
  Recipient.update({
    _id: id
  }, {
    $set: {
      deleted : true
    }
  }, function (err, doc) {
    if(err){
      res.status(403).send({
        success: false,
        message: "Error in processing the request."
      });
    } else {
      return res.json({
        success: true,
        message: "Recipient deleted.",
      });
    }  
  });
};

//Api to get list of recipient for admin dasboard.
exports.fetchRecipients = function(req, res) {
  Recipient.find({
    deleted: false    
  },{name:1, bankName:1, account:1, email:1})
  .then(function(recipients) {
    res.json({
      success: true,
      message: "Recipients Lists.",
      recipients: recipients
    });
  })
  .catch(function(err) {
    res.status(403).send({
      success: false,
      message: "Error in processing the request."
    });
  }) 
};

//API to send invitation to a recipient.
exports.sendInvitation = function(req, res) {
  const { email, password, id } = req.body
  return Promise.all([
    User.findOne({email: { $regex: email , $options: 'i' }}),
    Artist.findOne({emailAddress: { $regex: email , $options: 'i' }, _id: {$ne: id}}),
    Recipient.findOne({email: { $regex: email , $options: 'i' }})
  ])
  .spread((user, artist, recipient) => {
    if(!user && !artist && !recipient) {
      Recipient.findOneAndUpdate({
        _id: id 
      }, { 
        $set: req.body 
      })
      .then((recp) => {
        req.body.name = recp.name
        req.body.emailAddress = recp.email
        req.body.link = Config.config().siteUrl + "/login"
        EmailService.sendInvitation(req.body)
        return res.json({
          success: true,
          message: "Invitation sent."
        });
      });
    } else {
      res.status(403).send({
        success: false,
        message: "Email already in use."
      });
    }
  })
}