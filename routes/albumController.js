var Album = require('../models/albums');
var Song = require('../models/songs');
var Artist = require('../models/artist');
var UserRecommendationStats = require('../models/userRecommendationStats');
var Promise = require('bluebird');
var mongoose = require('mongoose');
const AWS = require('aws-sdk')
var Config = require('../config/config');
var promise = require('bluebird');
var Busboy = require('busboy');
var Tags =require('../models/tags');
// var parseMs = require('parse-ms');
var shortid = require('shortid');
var Utils = require('../service/utils');
var User = require('../models/users');
var _ = require('lodash');
var json2csv = require('json2csv');
var fs = require('fs');
var moment = require('moment');
//Function to format string to display total duration
function formatString(duration) {
  var str = [];
  if(duration.days > 0 && duration.hours > 0) {
    str.push(duration.days + 'd')
    str.push(duration.hours + 'h')
  } else if(duration.hours > 0 && duration.minutes > 0) {
    str.push(duration.hours + 'h')
    str.push(duration.minutes + 'm')
  } else if(duration.minutes > 0) {
    str.push(duration.minutes + 'm')
    str.push(duration.seconds + 's')
  } else if(duration.seconds > 0) {
    str.push(duration.seconds + 's')
  }
  return str.join(' ') 
}

//API to create a Album from dashboard
exports.createAlbum = function (req, res) {
  var aws = Config.config().aws;
  var albumArtworkS3Url = ''; 
  var tagsArr = [];
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
  // Getting posted files from front end
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
  // Getting fields values posted from front end
  busboy.on('field', function(fieldname, val, fieldnameTruncated, valTruncated, encoding, mimetype) {
    body.fields[fieldname] = val;
  });

  busboy.on('finish', function() {
    // calling the function to perform process to save record in db.
    onFinish()
  });

  busboy.on('error', function(err) {
    console.log('error', error)
  });

  req.pipe(busboy);
  function onFinish() {
    //Function to upload the album artwork on Amazon S3
    var uploadAlbumArtwork = new promise(function(f, r) {
      var file = body.files.find(function(f) {
        return f.fieldname == "artwork";
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
          Key: body.fields.artist+'/'+file.newfilename,
          Body: file.buffer,
          ContentType: file.mimetype,
          ACL: 'public-read'
        };
        s3.upload(data, function(err, resp) {
          if (err) {
            r(err);
          } else {
            albumArtworkS3Url = resp.Location;
            f(resp.Location);
          }
        })
      }
    }); 
    //Function to Add album
    function addAlbum() {
      var _shortid = shortid.generate();
      var objAlbum = {
        title: body.fields.title,
        titleHebrew: body.fields.titleHebrew,
        artist: body.fields.artist,
        creationDate: body.fields.creationDate,
        isExclusive: body.fields.isExclusive,
        isNewRelease: body.fields.isNewRelease,
        isPremium: body.fields.isPremium,
        premiumDays:parseInt(body.fields.premiumDays || 0),
        tags: tagsArr,
        language: body.fields.language,
        shortid: _shortid,
        shareUrl: Config.config().siteUrl+"/album/"+_shortid+".html",
        createdDate: new Date(),
        updatedDate: new Date()
      };
      var creationDate = objAlbum.creationDate;
      if(!creationDate){
        creationDate = new Date();
      }
      if(objAlbum.isPremium === 'true'){
        var expiryDays = Config.config().premium_expiry_days;
        if(objAlbum.premiumDays > 0){
          objAlbum.premiumExpDate = moment(new Date(creationDate)).add(objAlbum.premiumDays, 'd');
        } else{
          objAlbum.premiumDays = expiryDays;
          objAlbum.premiumExpDate = moment(new Date(creationDate)).add(expiryDays, 'd');
        }
      }
      if(albumArtworkS3Url != '') {
        objAlbum.artwork = albumArtworkS3Url;
      }

      var title = objAlbum.title;
      title={ $regex: "^" + title + "$", $options: 'i' }
      Album.findOne({ 
        title: title, 
        artist: body.fields.artist,
        deleted: false,
        isActive: true
      }, function(err, album) {      
        if(album) {
          res.status(403).send({
            success: false,
            message: "Album name already exists."
          });
        } else {
          var newAlbum = new Album(objAlbum);
          newAlbum
          .save()
          .then(function(album) {
            if(album) {
              Artist.findOne({
                _id: body.fields.artist
              })
              .then(function(artist) {
                Album.find({
                  artist: artist._id,
                  deleted: false,
                  isActive: true
                })
                .then(function(albums) {
                  artist.albumCount = albums.length
                  artist.save()
                  Utils.generateSharePage('album', album.title, album.artwork, album._id, album.shortid)
                  res.json({
                    success: true,
                    message: "Album added successfully."
                  });
                })
              })              
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
        }
      });
    };

    var promiseArray = [];

    if(body.files.length > 0) {
      for(var i = 0; i < body.files.length; i++) {
        if(body.files[i].fieldname == "artwork") {
          promiseArray.push(uploadAlbumArtwork)
        }
      }
    }
    
    if(promiseArray.length > 0) {
      promise.all(promiseArray)
      .then(function(data) {
        processTags();
      });
    } else {
      processTags();
    }
    // Function to Register new Tags if any
    function processTags() {
      var tags = JSON.parse(body.fields.tags);
      if(tags.length > 0) {
        var networkPromise = [];
        //Saving all the new tags in DB.
        tags.forEach(function(tag) {
          if (!mongoose.Types.ObjectId.isValid(tag.value)) {
            networkPromise.push(new promise(function(resolve, reject) {
              Tags.findOneAndUpdate({
                tagName: tag.value,
                deleted: false,
                createdDate: new Date(),
                updatedDate: new Date()
              }, {
                $set : {
                  tagName: tag.value
                }
              }, {
                new: true,
                upsert: true
              })
              .then(function(t) {
                resolve(t._id.toString())                  
              })
            }))
          } else {
            tagsArr.push(tag.value)
          }
        })
        if(networkPromise.length > 0) {
          promise.all(networkPromise)          
          .then(function(data) {
            tagsArr = tagsArr.concat(data);
            addAlbum();
          })
        } else {
          addAlbum();
        }
      }
    } 
  } 
};

//API to update an Album from dashboard
exports.updateAlbum = function(req, res) {  
  var aws = Config.config().aws;
  var albumArtworkS3Url = ''; 
  var tagsArr = [];
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
  // Getting posted files from front end
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
    //Function to upload the album artwork on Amazon S3
    var uploadAlbumArtwork = new Promise(function(f, r) {
      var file = body.files.find(function(f) {
        return f.fieldname == "artwork";
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
          Key: body.fields.artist+'/'+file.newfilename,
          Body: file.buffer,
          ContentType: file.mimetype,
          ACL: 'public-read'
        };

        s3.upload(data, function(err, resp) {
          if (err) {
            r(err);
          } else {
            albumArtworkS3Url = resp.Location;
            f(resp.Location);
          }
        })
      }
    }); 

    function addAlbum() {
      var _shortid = shortid.generate();
      var objAlbum = {        
        title: body.fields.title,
        titleHebrew: body.fields.titleHebrew,      
        creationDate: body.fields.creationDate,
        isExclusive: body.fields.isExclusive,
        isNewRelease: body.fields.isNewRelease,
        isPremium: body.fields.isPremium,
        premiumDays:parseInt(body.fields.premiumDays || 0),
        tags: tagsArr,
        updatedDate: new Date(),
        language: body.fields.language
      };

      var creationDate = objAlbum.creationDate;
      if(!creationDate){
        creationDate = new Date();
      }
      
      if(objAlbum.isPremium){
        var expiryDays = Config.config().premium_expiry_days;
        if(objAlbum.premiumDays > 0){
          objAlbum.premiumExpDate = moment(new Date(creationDate)).add(objAlbum.premiumDays, 'd');
        } else{
          objAlbum.premiumDays = expiryDays;
          objAlbum.premiumExpDate = moment(new Date(creationDate)).add(expiryDays, 'd');
        }
      }
      if(albumArtworkS3Url != '') {
        objAlbum.artwork = albumArtworkS3Url;
      }

      if(body.fields.shortid === "") {
        objAlbum.shortid = _shortid;
      }

      if(body.fields.shareUrl === "") {
        objAlbum.shareUrl = Config.config().siteUrl+"/album/"+_shortid+".html"
      }
      
      var title = body.fields.title;
      title={ $regex: "^" + title + "$", $options: 'i' }
      Album.findOne({ 
        title: title,
        artist: body.fields.artist,
        deleted: false,
        isActive: true,
        _id: {
          $ne: body.fields.id
        }
      }, function(err, album) {      
        if(album) {
          res.status(403).send({
            success: false,
            message: "Album name already exists."
          });
        } else {
          Album.findOneAndUpdate({
            _id: body.fields.id
          }, {
            $set: objAlbum      
          }, {
            new: true
          })
          .then(function(album) {
            if(album) {
              //updated album count in artist record.
              var updateSongs = [];
              var expiryDays = Config.config().premium_expiry_days;
              album.songs.forEach((item) => {
                updateSongs.push(new Promise(function(resolve, reject){
                  Song.findOne({_id:item},{isPremium:1, creationDate:1})
                  .then(function(song){
                    if(album.isPremium){
                      song.isPremium = true;
                      song.premiumDays = expiryDays;
                      song.premiumExpDate = moment(song.creationDate).add(expiryDays, 'd');
                    } else{
                      song.isPremium = false;
                    }
                    song.save();
                    resolve();
                  });
                }));
              });
              Promise.all(updateSongs)
              .then(function(){
                console.log("album song updated")
                Artist.findOne({
                  _id: album.artist
                })
                .then(function(artist) {
                  Album.find({
                    artist: artist._id,
                    deleted: false,
                    isActive: true
                  })
                  .then(function(albums) {
                    artist.albumCount = albums.length;
                    artist.save();
                    //Generate/Update the artist share html page.
                    Utils.generateSharePage('album', album.title, album.artwork, album._id, album.shortid)
                    res.json({
                      success: true,
                      message: "Album updated successfully."
                    });
                  })
                })
              })     
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
        }
      })
    };

    var promiseArray = [];

    if(body.files.length > 0) {
      for(var i = 0; i < body.files.length; i++) {
        if(body.files[i].fieldname == "artwork") {
          promiseArray.push(uploadAlbumArtwork)
        }
      }
    }
    if(promiseArray.length > 0) {
      promise.all(promiseArray)
      .then(function(data) {
        processTags()
      });
    } else {
      processTags()
    }
    // Function to add new tags if any
    function processTags() {
      var tags = JSON.parse(body.fields.tags);
      if(tags.length > 0) {
        var networkPromise = [];
        tags.forEach(function(tag) {
          if (!mongoose.Types.ObjectId.isValid(tag.value)) {
            networkPromise.push(new Promise(function(resolve, reject) {
              Tags.findOneAndUpdate({
                tagName: tag.value
              }, {
                $set : {
                  tagName: tag.value,
                  deleted: false,
                  isActive: true,
                  createdDate: new Date(),
                  updatedDate: new Date()
                }
              }, {
                new: true,
                upsert: true
              })
              .then(function(t) {
                resolve(t._id.toString())
              })
            }))
          } else {
            tagsArr.push(tag.value)
          }
        })
        if(networkPromise.length > 0) {
          Promise.all(networkPromise)          
          .then(function(data) {
            tagsArr = tagsArr.concat(data);
            addAlbum();
          })
        } else {
          addAlbum();
        }
      }
    }
  }  
};

//API to Update Album Songs in bulk from dashboard
exports.updateAlbumSongs = function(req, res) {
  var albumID = req.params.id
  delete req.body.id
  Album.findOneAndUpdate({
    _id: albumID
  }, { 
    $set: req.body
  },{ 
    new: true 
  })
  .then((album) => {
    exports.updateArtistAlbumCount(album.artist);
    exports.activeAlbumSongs(albumID, album.isActive);
          res.json({
            success: true,
            message: "Album updated successfully.",
            album: album
          });
  })  
};

//Api to delete a Album by id from dashboard
exports.deleteAlbum = function(req, res) {
  Album.findOneAndUpdate({
    _id: req.params.id
  }, {
    $set: {
      deleted: true
    }
  },{
    new: true
  })
  .then(function(album){
    Artist.findOne({
      _id: album.artist
    })
    .then(function(artist) {
      Album.find({
        artist: artist._id,
        deleted: false,
        isActive: true
      })
      .then(function(albums) {
        artist.albumCount = albums.length
        artist.save()
        return res.json({
          success: true,
          message: "Album deleted."
        });
      })
    })
  })
};

//Api to fetch Albums by artist ID
exports.fetchAlbum = function(req, res) {
  var artistId = req.params.artistId
  Album.find({
    artist: artistId,
    deleted: false 
  },{
    title:1,
    titleHebrew:1,
    name:1,
    songs:1,
    tags:1,
    shareUrl:1,
    shortid:1,
    isActive:1,
    artwork:1,
    artist:1,
    totalDuration:1,
    songCount:1, 
    isPremium:1,
    isNewRelease: 1,
    isExclusive: 1,
    creationDate: 1
  })
  .populate('songs')
  .populate('tags')
  .sort({createdDate: -1})
  .then(function(albums) {
    res.json({
      success: true,
      message: "Albums found.",
      albums: albums
    });
  })
};

//API to add a single song to an album from dashboard
exports.addSongToAlbum = function(req, res) {
  var albumId = req.params.id
  var songId = req.params.songId
  Album.findOneAndUpdate({
    _id: albumId
  }, { 
    $push: { songs: songId }
  },{ 
    new: true
  })
  .then((album) => {
    if (!album) {
      res.status(403).send({
        success: false,
        message: "No album found."
      });
    } else {
      //Function to add album in songs collection to which the song is attached
      var updateSongsInfo = new Promise(function(f, r) {
        /* Song.findOneAndUpdate({
          _id: songId
        }, { 
          $push: { albums: albumId }
        },{
          new: true
        })
        .then((song) => {
          f(song)
        }) */
        Song.findOne({_id: songId})
        .then((song) => {
          if(album.isPremium){
            var expiryDays = Config.config().premium_expiry_days;
            song.isPremium = true;
            song.premiumDays = expiryDays;
            song.premiumExpDate = moment(song.creationDate).add(expiryDays, 'd');
          } else{
            song.isPremium = false;
          }
          song.albums.push(albumId);
          song.save();
          f(song)
        })
      })
      //Function to update total duration of all songs attached to an album
      var updateAlbumInfo = new Promise(function(f, r) {
        Album.findOne({
          _id: albumId
        })
        .populate('songs', 'duration_seconds')
        .then((album1) => {
          if(album1) {
            var albumsongs = album1.songs;
            var duration = 0
            albumsongs.forEach(function(s) {
              duration += s.duration_seconds
            })
            var durationMS = (duration*1000);
            var result = formatString(durationMS);
            album.songCount = albumsongs.length
            album.totalDuration = result
            album.save()
            f(album)
          }
        });        
      })
    
      Promise.all([updateSongsInfo, updateAlbumInfo])
      .then(function(result) {
        res.json({
          success: true,
          message: "Album updated successfully.",
          album: album
        });
      })
    }
  })
};

//Remove a song from album
exports.removeSongFromAlbum = function(req, res) {
  var albumId = req.params.id
  var songId = req.params.songId
  Album.findOneAndUpdate({
    _id: albumId
  }, { 
    $pull: { songs: songId }
  },{ 
    new: true 
  })
  .then((album) => {
    if (!album) {
      res.status(403).send({
        success: false,
        message: "No album found."
      });
    } else {
      //Function to remove album refrence from the songs collection
      var updateSongsInfo = new Promise(function(f, r) {
        Song.findOneAndUpdate({
          _id: songId
        }, { 
          $pull: { albums: albumId }
        },{
          new: true
        })
        .then((song) => {
          f(song)
        })
      })
      
      //Function to update total duration of all songs attached to an album
      var updateAlbumInfo = new Promise(function(f, r) {
        Album.findOne({
          _id: albumId
        })
        .populate('songs', 'duration_seconds')
        .then((album1) => {
          if(album1) {
            var albumsongs = album1.songs;
            var duration = 0
            albumsongs.forEach(function(s) {
              duration += s.duration_seconds
            })
            var durationMS = (duration*1000);
            var result = formatString(durationMS);
            album.songCount = albumsongs.length
            album.totalDuration = result
            album.save()
            f(album)
          }
        });        
      })
    
      Promise.all([updateSongsInfo, updateAlbumInfo])
      .then(function(result) {
        res.json({
          success: true,
          message: "Album updated successfully.",
          album: album
        });
      })
    }
  })
};

// API to get the new Released Albums 
exports.getNewReleaseAlbums = function (req, res) {
  var userId = req.headers['userid']
  if(userId) {
    var page = req.query["page"] ? req.query["page"] : 1
    let limit = Config.config().allApiLimit;
    let skip = 0;
    skip = page - 1
    skip = skip * limit
    Album.find({
      deleted: false,
      isActive: true,
      isNewRelease: true
    })
    .populate('artist', 'name nameHebrew avatar songCount albumCount shareUrl isPremium')
    .populate('tags', null, { isActive: true, deleted: false })
    .populate({
      path: 'songs',
      model: 'Songs',
      match: {
        isActive: true,
        deleted: false
      },
      populate:[{
        path: 'artist',
        model: 'Artists',
        select: {
          _id: 1, name:1, nameHebrew:1, avatar:1, songCount:1, albumCount:1, shareUrl:1, isPremium:1
        }
      },
      {
        path: 'ft_artist',
        model: 'Artists',
        select: {
          _id: 1, name:1, nameHebrew:1, avatar:1, songCount:1, albumCount:1, shareUrl:1, isPremium:1
        }
      }, {
        path: 'tags',
        model: 'Tags'
      }, {
        path: 'genres',
        model: 'Genres'
      }, {
        path: 'albums',
        model: 'Albums',
        select: {
          _id: 1, title: 1, titleHebrew: 1, artwork:1, songCount:1, totalDuration:1, shareUrl:1, isPremium:1
        }
      }]
    }) 
    .sort({createdDate: -1, updatedDate: -1})
    .skip(skip)
    .limit(limit)
    .lean()
    .then(function(albums) {
      return res.json({
        success: true,
        message: "New Release albums listing",
        albums: albums
      });
    })
  } else {
    return res.json({
      success: false,
      message: "Unauthorized access"      
    });
  }
};

// API to get the Songs of an Album by album id
exports.getAlbumSongs = function (req, res) {
  var userId = req.headers['userid']
  if(userId) {
    var id = req.params.id
    Album.findOne({
      deleted: false,
      isActive: true,
      _id: id
    }, {songs: 1})
    .populate({
        path: 'songs',
        model: 'Songs',
        match: {
          isActive: true,
          deleted: false
        },
        populate:[{
          path: 'artist',
          model: 'Artists',
          select: {
            _id: 1, name:1, nameHebrew:1, avatar:1, songCount:1, albumCount:1, shareUrl:1, isPremium:1
          }
        },
        {
          path: 'ft_artist',
          model: 'Artists',
          select: {
            _id: 1, name:1, nameHebrew:1, avatar:1, songCount:1, albumCount:1, shareUrl:1, isPremium:1
          }
        }, {
          path: 'tags',
          model: 'Tags'
        }, {
          path: 'genres',
          model: 'Genres'
        }, {
          path: 'albums',
          model: 'Albums',
          select: {
            _id: 1, title: 1, titleHebrew: 1, artwork:1, songCount:1, totalDuration:1, shareUrl:1, isPremium:1
          }
        }]
      })    
    .then(function(album) {
      return res.json({
        success: true,
        message: "Album songs listing",
        songs: album.songs
      });
    })
    .catch(function(err) {
      res.status(403).send({
        success: false,
        message: "Error in fetching artist albums."
      });
    })
  } else {
    return res.json({
      success: false,
      message: "Unauthorized access"      
    });
  }
};

// API to give Recommended Albums listing based on the users intrest
exports.getRecommendedAlbums = function (req, res) {
  var userId = req.headers['userid']
  var page = req.query["page"] ? req.query["page"] : 1
  let limit = Config.config().allApiLimit;
  let skip = 0;
  skip = page - 1
  skip = skip * limit
  User.findOne({
    _id: userId
  })  
  .then(function(user) {
    if(user) {
      getRecommendedData(user)
    } else {
      res.json({
        success: false,
        message: "Invalid user."
      });
    }
  })
  .catch(function(err) {
    res.json({
      success: false,
      message: "Error in fetching data.",
      err: err
    });
  })

  function getRecommendedData(user) {
    var rec_genres = [];
    var rec_tags = [];
    UserRecommendationStats.findOne({
      userId: user._id
    })
    .then(function(userRS) {
      if(userRS) {
        if(userRS.genres.length > 0) {
          userRS.genres = _.orderBy(userRS.genres, ['count'],['desc']).slice(0,2);
        }
        if(userRS.tags.length > 0) {
          userRS.tags = _.orderBy(userRS.tags, ['count'],['desc']).slice(0,2);
        }
        userRS.genres.forEach(function(g) {
          if(g.count > 0) {
          rec_genres.push(g.id.toString())
          }
        })
        userRS.tags.forEach(function(t) {
          if(t.count > 0) {
          rec_tags.push(t.id.toString())
          }
        })
      }

      rec_genres = _.union(rec_genres, user.preferences.genres)      
    
      var finalResult = []
      var result = []
      var query = {
        deleted: false,
        isActive: true,
        streamedCount : {$gt:0}
      }
      if(user.isVocalOnly !== "") {
        query.genres = mongoose.Types.ObjectId(user.isVocalOnly)
      } else {
        query["$and"] = [{
          genres: {
            $in: rec_genres
          }
        }, {
          genres: {
            $nin: user.blockedGenres
          }
        }]
      }

      if(rec_tags.length > 0) {
        query = {
          deleted: false,
          isActive: true,
          streamedCount : {$gt:0}
        }
        if(user.isVocalOnly !== "") {
          query.genres = mongoose.Types.ObjectId(user.isVocalOnly)
        } else {
          query["$and"] = [{
            genres: {$in: rec_genres,$nin: user.blockedGenres}},
            {tags: {$in: rec_tags}}
          ]
        }
      }

      Song.find(query, {_id:1})
      .sort({streamedCount: -1})
      .limit(500)
      .then(function(songs) {
        var sIds = []
        songs.forEach(function(s) {
          sIds.push(mongoose.Types.ObjectId(s._id))
        })
        if(sIds.length > 0) {
          Album.aggregate([
            { $match: { songs: { $in: sIds } } },
            { $project: { count: { $size: { "$setIntersection": [ sIds , '$songs' ] } }} },
            { $sort: { count: -1 } }, 
          ])
          .then(function(albums) {
            let albumIds = []
            _.forEach(albums, function(a) {
              if(a.count >= 2) {
                albumIds.push(a._id)
              }
            })
              Album.find({
              _id: {
                $in: albumIds
              },
                deleted: false,
                isActive: true,
              }, {
                _id: 1, 
                title: 1,
                titleHebrew: 1, 
                artwork: 1, 
                artist: 1,
                shareUrl:1,
              songs: 1,
              isPremium: 1
              })
              .populate('artist', 'name nameHebrew avatar songCount albumCount shareUrl isPremium')
              .populate({
                path: 'songs',
                model: 'Songs',
                match: {
                  isActive: true,
                  deleted: false
                },
                populate:[{
                  path: 'artist',
                  model: 'Artists',
                  select: {
                    _id: 1, name:1, nameHebrew:1, avatar:1, songCount:1, albumCount:1, shareUrl:1, isPremium:1
                  }
                },
                {
                  path: 'ft_artist',
                  model: 'Artists',
                  select: {
                    _id: 1, name:1, nameHebrew:1, avatar:1, songCount:1, albumCount:1, shareUrl:1, isPremium:1
                  }
                },
                {
                  path: 'albums',
                  model: 'Albums',
                  select: {
                  _id: 1, title: 1, titleHebrew: 1, artwork:1, songCount:1, totalDuration:1, shareUrl:1, isPremium: 1
                  }
                },
                {
                  path: 'tags',
                  model: 'Tags'
                },
                {
                  path: 'genres',
                  model: 'Genres'
                }]
              })
              .populate('tags', null, { isActive: true, deleted: false })
            .skip(skip)
            .limit(limit)
            .lean()
            .then(function(albumsResult) {
              return res.json({
                success: true,
                message: "Albums listing",
                albums: albumsResult
              });
              })
              .catch(function(err) {
              return res.json({
                success: true,
                message: "Albums listing",
                albums: []
              });
            })
          })
        } else {
          return res.json({
            success: true,
            message: "Albums listing",
            albums: []
          });
        }
      })
    })          
  } 
}

// API to get all details of a Album
exports.getAlbumDetail = function (req, res) {
  var albumId = req.params['id']
  Album.findOne({
    _id: albumId
  })
  .populate('artist', 'name nameHebrew avatar songCount albumCount shareUrl isPremium', { isActive: true, deleted: false })
  .populate({
    path: 'songs',
    model: 'Songs',
    match: {
      isActive: true,
      deleted: false
    },
    populate:[{
      path: 'artist',
      model: 'Artists',
      select: {
        _id: 1, name:1, nameHebrew:1, avatar:1, songCount:1, albumCount:1, shareUrl:1, isPremium:1
      }
    },
    {
      path: 'ft_artist',
      model: 'Artists',
      select: {
        _id: 1, name:1, nameHebrew:1, avatar:1, songCount:1, albumCount:1, shareUrl:1, isPremium:1
      }
    }, {
      path: 'tags',
      model: 'Tags'
    }, {
      path: 'genres',
      model: 'Genres'
    }, {
      path: 'albums',
      model: 'Albums',
      select: {
        _id: 1, title: 1, titleHebrew: 1, artwork:1, songCount:1, totalDuration:1, shareUrl:1, isPremium:1
      }
    }]
  })
  .then(function(album) {
    if(album) {
      res.json({
        success: true,
        message: "Album found",
        album: album
      });
    } else {
      res.json({
        success: false,
        message: "No album found"
      });
    }
  })
}

// API to get all recently played song Albums
exports.getRecentlyPlayedAlbums = function (req, res) {
  var userId = req.headers['userid']
  var page = req.query['page'] ? req.query['page'] : 1;
  let limit = Config.config().allApiLimit;
  let skip = 0;
  skip = page - 1
  skip = skip * limit
  if(userId) {
    User.findOne({
      _id: userId
    })
    .then(function(user) {
      if(user) {
        getRecentlyPlayedAlbumList(user)
      } else {
        res.json({
          success: false,
          message: "Invalid user."
        });
      }
    })
    .catch(function(err) {
      con
      res.json({
        success: false,
        message: "Error in fetching data."
      });
    })
    function getRecentlyPlayedAlbumList(user) {
      var finalResult = [];
      Utils.saveUserStats(userId);
      if(user && user.recentlyPlayed.length > 0) {
        var query = {
          _id: {
            $in: user.recentlyPlayed
          },
          genres: {
            $nin: user.blockedGenres
          },
          deleted: false,
          isActive: true
        }
        if(user.isVocalOnly !== "") {
          query.genres = mongoose.Types.ObjectId(user.isVocalOnly)
        }
        Song.distinct("_id", query)
        .then(function(songIds) {
          songIds = Utils.orderSongIdsResults(songIds, user.recentlyPlayed)
          if(songIds.length > 0) {
              var i = -1;
              var fetch = function() {
                i++;
                if (i < songIds.length) {
                  Album.find({
                    songs: songIds[i],
                    deleted: false,
                    isActive: true,
                  }, {
                    _id: 1, 
                    title: 1,
                    titleHebrew: 1, 
                    artwork: 1, 
                    artist: 1,
                    shareUrl:1,
                    isPremium:1
                  })
                  .populate('artist', 'name nameHebrew avatar songCount albumCount shareUrl isPremium')
                  .then(function(albums) {
                    if(albums.length > 0) {
                      albums.forEach(function(a) {
                        var d = -1
                        finalResult.forEach(function(aa, i) {
                          if(aa._id.toString() == a._id.toString()) {
                            d = i
                          }
                        })                        
                        if(d == -1) {
                          finalResult.push(a)
                        }
                      })
                    }
                    fetch()
                  })
                  .catch(function(err) {
                    fetch()
                  })
                } else {
                  finalResult = finalResult.slice(skip, skip + limit);
                  return res.json({
                    success: true,
                    message: "Recently played album listing",
                    albums: finalResult
                  });
                }
              }
              fetch()
            } else {
              return res.json({
                success: true,
                message: "No recently played songs found",
                songs: []
              });
            }
        })
      } else {
        return res.json({
          success: true,
          message: "No recently played songs found",
          songs: []
        });
      }
    } 
  } else {
    return res.json({
      success: false,
      message: "Unauthorized access"      
    });
  } 
};
//function to export albums inactive csv file
exports.getInactiveAlbumCsv = function(req, res) {
  var fields = ['title','titleHebrew','isExclusive','isNewRelease',
  'songCount','isActive','deleted', 'isPremium', 'createdDate','updatedDate']
  Album.find({isActive: false, deleted: false})
  .then(function(album) {
    if(album) {
      var result = json2csv({ data: album, fields: fields });
      fs.writeFile('inactive_albums.csv', result, function(err) {
        if (err) throw err;
        res.download('inactive_albums.csv')
        setTimeout(function() { 
          fs.unlinkSync('inactive_albums.csv')
        }, 500);
      });
    } else {
      res.status(403).send({
        success: false,
        message: "No Such Albums"
      });
    }
  })
};

exports.updateArtistAlbumCount = function(artistid) {
  Artist.findOne({
    _id: artistid
  })
  .then(function(artist) {
    if (artist) {
      Album.find({
        artist: artist._id,
        deleted: false,
        isActive: true
      })
      .then(function(albums) {
        artist.albumCount = albums.length
        artist.save();
      })
    }
  })
}

exports.activeAlbumSongs = function(albumid, isActive) {
  Song.update({
    albums: albumid
  }, {
    $set: {
      isActive: isActive
    }
  }, {
    multi: true
  })
  .then(function(songs) {
  })
} 