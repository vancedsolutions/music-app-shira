var Banner = require('../models/banners');
var promise = require('bluebird');
var mongoose = require('mongoose');
const AWS = require('aws-sdk')
var Config = require('../config/config');
var Busboy = require('busboy');

//API to create a Album
exports.createBanner = function (req, res) {
  var aws = Config.config().aws;
  var imageS3Url = '';
  var body = {
    fields: {},
    files: []
  };
  //Parsing incoming form data
  var busboy = new Busboy({
    headers: req.headers,
    limits: {
      fileSize: 100 * 1024 * 1024
    }
  });

  busboy.on('file', function(fieldname, file, filename, encoding, mimetype) {
    if(file) {
      var buffer = new Buffer('');
      var type = mimetype.split('/')[1];
      var newfilename = (filename.substr(0, filename.lastIndexOf('.')) || filename) + '_' + Date.now().toString() + '.' + type;    
      
      file.on('data', function(data) {
        buffer = Buffer.concat([buffer, data]);
      });

      file.on('limit', function() {
        reject('Error: File size cannot be more than 20 MB');
      });

      file.on('end', function() {
        var objFile = {
          fieldname: fieldname,
          buffer: buffer,
          filename: filename,
          newfilename: newfilename,
          encoding: encoding,
          mimetype: mimetype
        };
        body.files.push(objFile);
      });
    }
  });

  busboy.on('field', function(fieldname, val, fieldnameTruncated, valTruncated, encoding, mimetype) {
    body.fields[fieldname] = val;
  });

  busboy.on('finish', function() {
    onFinish()
  });

  busboy.on('error', function(err) {
    console.log('error', error)
  });

  req.pipe(busboy);
  function onFinish() {
    //Function to upload the banner image on Amazon S3
    var uploadBannerImage = new promise(function(f, r) {
      var file = body.files.find(function(f) {
        return f.fieldname == "bannerImage";
      })
      if(file) {
        AWS.config.update({
          accessKeyId: aws.key,
          secretAccessKey:  aws.secret,
          region: aws.region
        });      
        var s3 = new AWS.S3({
          params: {
            Bucket: aws.bucket
          }
        });
        var data = {
          Key: 'banner/'+file.newfilename,
          Body: file.buffer,
          ContentType: file.mimetype,
          ACL: 'public-read'
        };
        s3.upload(data, function(err, resp) {
          if (err) {
            r(err);
          } else {
            imageS3Url = resp.Location;
            f(imageS3Url);
          }
        })
      }
    }); 

    //Function to save banner into DB
    function addBanner() {
      var objBanner = {
        recid: body.fields.recid,
        order: body.fields.order,
        type: body.fields.type,
        isActive: true,
        deleted: false,
        createdDate: new Date(),
        updatedDate: new Date()
      };
      
      if(imageS3Url != '') {
        objBanner.imageUrl = imageS3Url;
      }

      var newBanner = new Banner(objBanner);
      newBanner
      .save()
      .then(function(banner) {
        if(banner) {
          res.json({
            success: true,
            message: "Album added successfully."
          });             
        } else {
          res.status(403).send({
            success: false,
            message: "Error in processing your request."
          });
        }
      })
      .catch(function(err) {
        res.status(403).send({
          success: false,
          message: "Error in processing your request."
        });
      })
    };
    
    promise.all([uploadBannerImage])
    .then(function(data) {
      addBanner()
    });
  } 
};

//Api to fetch banners for admin dashboard
exports.fetchBanners = function(req, res) {
  let page = req.query["page"] ? req.query["page"] : 1
  let limit = Config.config().allApiLimit;
  let skip = 0;
  skip = page - 1
  skip = skip * limit
  Banner.count({
    deleted: false,
    isActive: true 
  })
  .then(function(bannerCount) {
    Banner.find({
      deleted: false,
      isActive: true
    })
    .sort({createdDate: -1})
    .skip(skip)
    .limit(limit)
    .lean()
    .then(function(banners) {
      res.json({
        success: true,
        message: "Banners found.",
        banners: banners,
        limit: limit,
        count: bannerCount
      });
    })
  })
};

//API to update a Banner
exports.updateBanner = function(req, res) {  
  var aws = Config.config().aws;
  var imageS3Url = '';
  var body = {
    fields: {},
    files: []
  };
  //parsing incoming form data
  var busboy = new Busboy({
    headers: req.headers,
    limits: {
      fileSize: 100 * 1024 * 1024
    }
  });

  busboy.on('file', function(fieldname, file, filename, encoding, mimetype) {
    if(file) {
      var buffer = new Buffer('');
      var type = mimetype.split('/')[1];
      var newfilename = (filename.substr(0, filename.lastIndexOf('.')) || filename) + '_' + Date.now().toString() + '.' + type;    
      
      file.on('data', function(data) {
        buffer = Buffer.concat([buffer, data]);
      });

      file.on('limit', function() {
        reject('Error: File size cannot be more than 20 MB');
      });

      file.on('end', function() {
        var objFile = {
          fieldname: fieldname,
          buffer: buffer,
          filename: filename,
          newfilename: newfilename,
          encoding: encoding,
          mimetype: mimetype
        };
        body.files.push(objFile);
      });
    }
  });

  busboy.on('field', function(fieldname, val, fieldnameTruncated, valTruncated, encoding, mimetype) {    
    body.fields[fieldname] = val;
  });

  busboy.on('finish', function() {
    onFinish()
  });

  busboy.on('error', function(err) {
    console.log('error', error)
  });

  req.pipe(busboy);

  function onFinish() {
    //Function to upload the banner image on Amazon S3
    var uploadBannerImage = new promise(function(f, r) {
      var file = body.files.find(function(f) {
        return f.fieldname == "bannerImage";
      })
      if(file) {
        AWS.config.update({
          accessKeyId: aws.key,
          secretAccessKey:  aws.secret,
          region: aws.region
        });      
        var s3 = new AWS.S3({
          params: {
            Bucket: aws.bucket
          }
        });
        var data = {
          Key: 'banner/'+file.newfilename,
          Body: file.buffer,
          ContentType: file.mimetype,
          ACL: 'public-read'
        };
        s3.upload(data, function(err, resp) {
          if (err) {
            f('');
          } else {
            imageS3Url = resp.Location;
            f(imageS3Url);
          }
        })
      } else {
        f('');
      }
    }); 

    function editBanner() {
      var objBanner = {
        recid: body.fields.recid,
        order: body.fields.order,
        type: body.fields.type,        
        updatedDate: new Date()
      };

      if(imageS3Url != '') {
        objBanner.imageUrl = imageS3Url;
      }
      
      Banner.findOneAndUpdate({
        _id: body.fields.id
      }, {
        $set: objBanner      
      }, {
        new: true
      })
      .then(function(banner) {
        if(banner) {
          res.json({
            success: true,
            message: "Banner updated successfully."
          });             
        } else {
          res.status(403).send({
            success: false,
            message: "Error in processing your request."
          });
        }
      })
      .catch(function(err) {
        res.status(403).send({
          success: false,
          message: "Error in processing your request."
        });
      })
    };

    promise.all([uploadBannerImage])
    .then(function(data) {
      editBanner()
    });    
  }  
};

//API to update a Banner deleted, isActive status
exports.updateBannerStatus = function(req, res) {
  var id = req.body.id
  delete req.body.id
  Banner.findOneAndUpdate({
    _id: id
  }, { 
    $set: req.body
  },{ 
    new: true 
  })
  .then((banner) => {
    res.json({
      success: true,
      message: "Changes saved successfully."
    });
  })  
}