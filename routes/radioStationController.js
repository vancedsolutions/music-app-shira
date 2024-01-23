var RadioStation = require('../models/radioStations');
var RadioStationStats = require('../models/radioStationStats');
var Settings = require('../models/settings');
var promise = require('bluebird');
const AWS = require('aws-sdk')
var Config = require('../config/config');
var Busboy = require('busboy');

//API to create a Radio station
exports.createRadioStation = function (req, res) {
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
  //Reading a image file posted from front end
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
  //Reading fields posted from front end
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
    //Function to upload the radio image on Amazon S3
    var uploadRadioImage = new promise(function(f, r) {
      var file = body.files.find(function(f) {
        return f.fieldname == "radioImage";
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
          Key: 'radio/'+file.newfilename,
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

    //Function to save radio station info to DB
    function addRadio() {
      var objRadio = {
        title: body.fields.title,
        titleHebrew: body.fields.titleHebrew,
        link: body.fields.link,
        id : body.fields.id
      };
      
      console.log('objRadio',objRadio)
      if(imageS3Url != '') {
        objRadio.imageurl = imageS3Url;
      }

      var radioStationID = objRadio.id
      delete objRadio.id;
  RadioStation.findOne({
    _id: radioStationID
  })
  .then(function(s) {
    if (!s) {      
          var dataObj = new RadioStation(objRadio);
      dataObj.save()
      .then((stations) => {
        res.json({
          success: true,
          message: "Radio station created successfully.",
          stations: stations
        });
      })
    } else {
      RadioStation.findOneAndUpdate({_id: 
        radioStationID
      }, { 
            $set: objRadio
      })
      .then((stations) => {
        res.json({
          success: true,
          message: "Radio station updated successfully.",
          stations: stations
        });
      })
    }
  })
    };
    
    promise.all([uploadRadioImage])
    .then(function(data) {
      addRadio()
    });
  } 
};

//Api to update a radio station records
exports.updateRadioStation = function(req, res) {
  var radioID = req.body.id;  
  RadioStation.findOneAndUpdate({
    _id: radioID
  }, {$set:{ 
    isActive: req.body.isActive
  }},{ 
    new: true 
  })
  .then((stations) => {
    if(stations) {
      res.json({
        success: true
      });
    } else {
      res.json({
        success: false
      });
    }
  })
};


//Api to get radio stations listing for admin dasboard
exports.fetchRadioStations = function(req, res) {
  Settings.findOne({}, {
    'fieldsPerPage': 1
  })
  .then(function(fields) {
    var page = req.query.page ? req.query.page : 1
    let limit = fields.fieldsPerPage;
    skip = page - 1
    skip = skip * limit
    RadioStation.count({
      deleted: false
    })
    .then(function(count) {
      let radioStationCount = count
      RadioStation.find({
        deleted: false
      })
      .skip(skip)
      .limit(limit)
      .sort({createdDate: -1})
      .then(function(stations) {
        return res.json({
          success: true,
          message: "Stations found.",
          count: radioStationCount,
          limit: limit,
          stations: stations
        });
      })
    })
  })
};


//Api to get radio stations listing for mobile app
exports.fetchActiveRadioStations = function(req, res) {
  RadioStation.find({ 
    deleted: false, 
    isActive: true 
  }, {
    title: 1,
    titleHebrew: 1,
    link: 1,
    imageurl: 1
  })
  .sort({title: 1})
  .then(function(stations) {
    if(stations.length > 0) {
      res.json({
        success: true,
        message: "Stations found.",
        stations: stations
      });
    } else {
      res.json({
        success: true,
        message: "No stations found.",
        tags: []
      });
    }
  })
};

//Api to like a radio station
exports.likeRadioStation = function (req, res) {
  var stationId = req.params['id']
  var userId = req.params['uid']  
  RadioStationStats.findOneAndUpdate({
    userId: userId,
    radioStationId: stationId
  }, {
    userId: userId,
    radioStationId: stationId,
    like: 1
  }, {
    new: true,
    upsert: true
  })
  .then(function(like) {
    res.json({
      success: true,
      message: "Radio Station liked successfully."
    });
  })
}

//Api to unlike a radio station
exports.unlikeRadioStations = function (req, res) {
  var stationId = req.params['id']
  var userId = req.params['uid']
  RadioStationStats.findOneAndUpdate({
    userId: userId,
    radioStationId: stationId
  }, {
    userId: userId,
    radioStationId: stationId,
    like: 0
  }, {
    new: true,
    upsert: true
  })
  .then(function(unlike) {
    res.json({
      success: true,
      message: "Radio Station unliked successfully."
    });
  })
};

//Api to get users current like/unlike station for a specific station
exports.getRadioStationStatus = function (req, res) {
  var stationId = req.params['id']
  var userId = req.params['uid']
  RadioStationStats.findOne({
    userId: userId,
    radioStationId: stationId
  })
  .then(function(rs) {
    if(rs) {
      res.json({
        success: true,
        message: "success",
        status: rs.like
      });
    } else {
      res.json({
        success: true,
        message: "success",
        status: -1
      });
    }
  })
}

//Api to delete a radio station from admin dashboard
exports.deleteRadioStation = function(req, res) {
  var id = req.params.id;
    RadioStation.update({
      _id: id
    }, {
      $set: {
        deleted: true
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
        message: "Radio station deleted.",
    });
    }  
  });
};