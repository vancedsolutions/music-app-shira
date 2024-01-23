var Labels = require('../models/labels');
var Artists = require('../models/artist');
var Config = require('../config/config');
var Promise = require('bluebird');
var Settings = require('../models/settings');

//API to create a Label
exports.createLabel = function (req, res) {
  var labelObj = new Labels(req.body);
  labelObj
  .save()
  .then(function(label) {
    if(label) {
      res.json({
        success: true,
        message: "Label created."
      });
    }
  })
  .catch(function(err) {
    res.status(403).send({
      success: false,
      message: "Error in processing the request."
    });
  })
};

//Api to update a label record
exports.updateLabel = function(req, res) {
  var labelID = req.body.id;  
  Labels.findOneAndUpdate({
    _id: labelID
  }, {$set:{ 
    labelName: req.body.labelName
  }},{ 
    new: true 
  })
  .then((label) => {
    if (!label) {
      return res.json({
        success: false,
        message: "No label found."
      });
    }
    return res.json({
      success: true,
      message: "Changes saved successfully.",
      label: label
    });
  })
};

//Api to update/Active a label record
exports.patchLabel = function(req, res) {
  var labelID = req.body.id;
  delete req.body.id;
  Labels.findOneAndUpdate({
    _id: labelID
  }, { 
    $set: req.body
  },{ 
    new: true 
  })
  .then((label) => {
    if (!label) {
      return res.json({
        success: false,
        message: "No label found."
      });
    }
    return res.json({
      success: true,
      message: "Changes saved successfully.",
      label: label
    });
  })
};

//Api to delete a Label
exports.deleteLabel = function(req, res) {
  var id = req.params.id;
  Labels.update({
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
        message: "Label deleted."
      });
    }  
  });
};

//Api to get Label listing
exports.fetchLabel = function(req, res) {
  //Filter data for pagination
  Settings.findOne({},{
    'fieldsPerPage':1
  })
  .then(function(fields) {
    var page = req.query.page ? req.query.page : 'all'
    if(page !== "all") {
      Labels.count({ 
        deleted: false 
      })
      .then(function(labelCount) {
        let limit = fields.fieldsPerPage;
        skip = page - 1
        skip = skip * limit
        Labels.find({ 
          deleted: false 
        })
        .skip(skip)
        .limit(limit)
        .lean()
        .sort({createdDate: -1})
        .then(function(labels) {
          var labelsPromise = [];
          if(labels.length > 0) {
            labels.forEach(function(l) {
              //l = l.toJSON();
              labelsPromise.push(new Promise(function(resolve, reject) {
                Artists.count({labels: l._id}).then(function(artistCount) {
                  l.artistCount = artistCount;
                  resolve(l);
                })
              }))
            })
            Promise.all(labelsPromise)
            .then(function(result) {
              res.json({
                success: true,
                message: "Labels found.",
                labels: result,
                count: labelCount,
                limit: limit,
              });
            })
            .catch(function(err1) {
              res.json({
                success: true,
                message: "No Labels found.",
                labels: []
              });
            })
          } else {
            res.json({
              success: true,
              message: "No Labels found.",
              labels: []
            });
          }
        })
      })
    } else {
      Labels.find({ 
        deleted: false 
      })
  .sort({createdDate: -1})
  .then(function(labels) {
    var labelsPromise = [];
    if(labels.length > 0) {
      labels.forEach(function(l) {
        l = l.toJSON();
        labelsPromise.push(new Promise(function(resolve, reject) {
          Artists.count({labels: l._id}).then(function(artistCount) {
            l.artistCount = artistCount;
            resolve(l);
          })
        }))
      })
      Promise.all(labelsPromise)
      .then(function(result) {
    res.json({
      success: true,
      message: "Labels found.",
          labels: result
    });
  })
      .catch(function(err1) {
        res.json({
          success: true,
          message: "No Labels found.",
          labels: []
        });
      })
    } else {
      res.json({
        success: true,
        message: "No Labels found.",
        labels: []
      });
    }
  })
    }
  })
};

//Api to get active label for dashboard
exports.fetchActiveLabel = function(req, res) {
  Labels.find({ deleted: false, isActive: true })
  .sort({createdDate: -1})
  .then(function(labels) {
    if(labels.length > 0) {
      res.json({
        success: true,
        message: "Labels found.",
        labels: labels
      });
    } else {
      res.json({
        success: true,
        message: "No Labels found.",
        labels: []
      });
    }
  })
};
