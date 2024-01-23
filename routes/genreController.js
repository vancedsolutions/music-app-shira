var Genre = require('../models/genres');
var Songs = require('../models/songs');
var AWS = require('aws-sdk')
var Config = require('../config/config');
var Promise = require('bluebird');
var Settings = require('../models/settings');
var User = require('../models/users');
var mongoose = require('mongoose');
var Artist = require('../models/artist');
var Album = require('../models/albums');
var _ = require('lodash');
var Playlist = require('../models/playlists');

//03-12-2020
exports.fetchSpecificGenre = function (req, res) {
  // Filter data for Pagination
  var genreId=req.params.id;
  User.distinct("_id", {
      role: { $in: ["admin", "superadmin"] }
  }).then(function(users){
      Settings.findOne({}, {
          'fieldsPerPage': 1
      }).then(function (fields) {
              var page = req.query.page ? req.query.page : 'ok'
              //Send the data for mobile app
              if (page !== "all") {
                  let limit = fields.fieldsPerPage;
                  skip = page - 1
                  skip = skip * limit
                  Genre.count({
                      deleted: false,_id:genreId
                  })
                      .then(function (count) {
                          let genreCount = count
                          Genre.find({
                              deleted: false,_id:genreId
                          })
                              .lean()
                              .populate({
                                  path: 'playlists',
                                  match: { deleted: false,createdBy: {
                                      $in: users
                                   }}                                    
                              })
                              .sort({ title: 1 })
                              .then(function (genres) {
                                  var genrePromise = [];
                                  if (genres.length > 0) {
                                      //Function for counting the genres used in songs
                                      genres.forEach(function (g) {
                                          genrePromise.push(new Promise(function (resolve, reject) {
                                              Songs.count({ genres: g._id }).then(function (songCount) {
                                                  g.songsCount = songCount;
                                                  resolve(g);
                                              })
                                          }))
                                      })
                                      Promise.all(genrePromise)
                                          .then(function (result) {
                                              res.json({
                                                  success: true,
                                                  message: "Genres found.",
                                                  genreCount: genreCount,
                                                  genres: result,
                                                  limit: limit
                                              });
                                          })
                                          .catch(function (err1) {
                                              res.json({
                                                  success: true,
                                                  message: "No Genres found.",
                                                  genres: []
                                              });
                                          })
                                  } else {
                                      res.json({
                                          success: true,
                                          message: "No Genres found.",
                                          genres: []
                                      });
                                  }
                              })
                      })
              } else {
                  //Send the data for admin dashboard
                  Genre.find({ deleted: false })
                      .sort({ title: 1 })
                      .then(function (genres) {
                          var genrePromise = [];
                          if (genres.length > 0) {
                              //Function for counting the genres used in songs
                              genres.forEach(function (g) {
                                  g = g.toJSON();
                                  genrePromise.push(new Promise(function (resolve, reject) {
                                      Songs.count({ genres: g._id }).then(function (songCount) {
                                          g.songsCount = songCount;
                                          resolve(g);
                                      })
                                  }))
                              })
                              Promise.all(genrePromise)
                                  .then(function (result) {
                                      res.json({
                                          success: true,
                                          message: "Genres found.",
                                          genres: result
                                      });
                                  })
                                  .catch(function (err1) {
                                      res.json({
                                          success: true,
                                          message: "No Genres found.",
                                          genres: []
                                      });
                                  })
                          } else {
                              res.json({
                                  success: true,
                                  message: "No Genres found.",
                                  genres: []
                              });
                          }
                      })
              }
          }).catch(error=>{
            res.json({
              success: true,
              message: "Settings error.",
              genres: []
            });
          })
  }).catch(error=>{
    res.json({
      success: true,
      message: "No user found.",
      genres: []
    });
  })
  

};

//03-12-2020
exports.playlistUpdateInGenre = function(req, res) {
  var id=req.params.id;
  console.log(id)
  // Genre.find({deleted:false},{_id:1}).skip(9).limit(9).then(function(dgenre){
  //     res.json({msg:'success',mdata:dgenre})
  // }).catch(err=>{
  //     res.json({msg:err});
  // })
  var songQuery = {
      deleted: false,
      isActive: true
  }
  songQuery.genres = {$in:[mongoose.Types.ObjectId(id)]}
  console.log(songQuery)
  User.distinct("_id", {
      role: { $in: ["admin", "superadmin"] }
  }).then(function(users){
      Songs.distinct("_id", songQuery)
      .then(function(songIds) {
         
          var query = {
              createdBy: {
                  $in: users
              },
              songs: {
                  $in: songIds
              },
              deleted: false,
              isActive: true
          }
          Playlist.find(query,{_id:1})
                  .then(function(playlists){
                      playlists.forEach(function(p){
                          console.log(p);
                          Genre.update({_id:{$in:[id]},deleted:false,playlists:{$nin:[p._id]}},{
                                          $push: { playlists: p._id }
                                      }).then(function(data){
                                          console.log(data);
                                      });
                      })
                      res.json({
                          msg:'success',
                          mdata:playlists
                      })
                  }).catch(error=>{
                      res.json({
                          msg:'failure',
                          mdata:error
                      })
                  })
                  // getPlaylist(query, u);
      }).catch((error)=>{
          res.json({
              msg:'failure',
              mdatae:error
          })
      })
  }).catch(error=>{
      console.log(error);
      res.json({msg:error})
  })
};
//API to create a genre
exports.createGenre = function (req, res) {
  var info = req.body;
  var portfolioInfo = info;
  var originalBlob = portfolioInfo.files;  
  var aws = Config.config().aws;
  if ( originalBlob && originalBlob !=='' && typeof(originalBlob !== "number" && originalBlob !== null)) {
    var regex       = /^data:.+\/(.+);base64,(.*)$/;
    var matches     = originalBlob.match(regex);
    var base64Data  = matches && matches.length && matches[2] ? matches[2] : '';
    var buf         = new Buffer(base64Data, 'base64');
    var newName     = (new Date()).valueOf();
    var newfilename = newName +'.png';   
    // upload the image to Amazon S3
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
    s3.upload({
      Body: buf,
      Key: 'genre/'+newfilename,
      ACL: 'public-read'
    }, function(err, data1) {
      if (err) {
        console.log(err)
      }
      if(data1) {
        portfolioInfo.image = data1.Location
        add(portfolioInfo)
      } else {
        console.log("else")
      }
    })
  } 
  // Function to Add Information of the Genre
  function add(portfolioInfo){
    var dataObj = {
      "title":portfolioInfo.name,
      "titleHebrew": portfolioInfo.name_hebrew,
      "icon": portfolioInfo.image,
      "language": portfolioInfo.language,
    }
    
    var genreObj = new Genre(dataObj);
    genreObj
    .save()
    .then(function(genre) {
      if(genre) {
        res.json({
          success: true,
          message: "Genre created."
        });
      }
    })
    .catch(function(err) {
      res.json({
        success: false,
        message: "Error in creating Genre."
      });
    })
  };
}

//Api to update a genre record
exports.updateGenre = function(req, res) {  
  var genreID = req.body.id;
  var genreInfo = req.body;
  var portfolioInfo = genreInfo;
  var originalBlob = portfolioInfo.files;  
  var aws = Config.config().aws;
  if ( originalBlob && originalBlob !=='' && typeof(originalBlob !== "number" && originalBlob !== null) && originalBlob.search('https://shiralidevelopment.s3-us-west-1.amazonaws.com') === -1) {
    var regex       = /^data:.+\/(.+);base64,(.*)$/;
    var matches     = originalBlob.match(regex);
    var base64Data  = matches && matches.length && matches[2] ? matches[2] : '';
    var buf         = new Buffer(base64Data, 'base64');
    var newName     = (new Date()).valueOf();
    var newfilename = newName +'.png';   
    //Upload the new file to amazon S3
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
    s3.upload({
      Body: buf,
      Key: 'genre/'+newfilename,
      ACL: 'public-read'
    }, function(err, data1) {
      if (err) {
        console.log(err)
      }
      if(data1) {
        portfolioInfo.image = data1.Location
        update(portfolioInfo)
      } else {

      }
    })
  } else {
    portfolioInfo.image = portfolioInfo.files;
    update(portfolioInfo)
  }
  // Update the information of genre
  function update(portfolioInfo){
    var obj = {
      icon: portfolioInfo.image,
       language: portfolioInfo.language
      }
    if(portfolioInfo.language === "hebrew"){
      obj.titleHebrew = portfolioInfo.name_hebrew;
    } else {
      obj.title = portfolioInfo.name;
  }
    obj.createdDate = new Date()
    obj.updatedDate = new Date()
    Genre.findOneAndUpdate({
      _id: genreID
    }, { 
      $set: obj
    },{ 
      new: true 
    })
    .then((genre) => {
      if (!genre) {
        return res.json({
          success: false,
          message: "No artist found."
        });
      }
      return res.json({
        success: true,
        message: "Changes saved successfully.",
        genre: genre
      });
    })
  };
}

//API to Update Genre
exports.patchGenre = function(req, res) {
  var genreID = req.params.id
  delete req.body.id
  Genre.findOneAndUpdate({
    _id: genreID
  }, { 
    $set: req.body
  },{ 
    new: true 
  })
  .then((genre) => {
    if (!genre) {
      res.json({
        success: false,
        message: "No playlist found."
      });
    } else {
      res.json({
        success: true,
        message: "Genre updated successfully.",
        genre: genre
      });
    }
  })
};

//Api to delete a genre
exports.deleteGenre = function(req, res) {
  var id = req.params.id;
  Genre.update({
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
        message: "Genre deleted."
      });
    }  
  });
};

//Api to get genres listing
exports.fetchGenres = function(req, res) {
  // Filter data for Pagination
  Settings.findOne({},{
    'fieldsPerPage':1
  })
  .then(function(fields) {
    var page = req.query.page ? req.query.page : 'all'
    //Send the data for mobile app
    if(page !== "all") {
      let limit = fields.fieldsPerPage;
      skip = page - 1
      skip = skip * limit
      Genre.count({
        deleted: false
      })
      .then(function(count) {
        let genreCount = count
        Genre.find({
          deleted: false
        })
        .skip(skip)
        .limit(limit)
        .lean()
        .sort({title:1})
        .then(function(genres) {
          var genrePromise = [];
          if(genres.length > 0) {
             //Function for counting the genres used in songs
            genres.forEach(function(g) {
              genrePromise.push(new Promise(function(resolve, reject) {
                Songs.count({genres: g._id}).then(function(songCount) {
                  g.songsCount = songCount;
                  resolve(g);
                })
              }))
            })
            Promise.all(genrePromise)
            .then(function(result) {
              res.json({
                success: true,
                message: "Genres found.",
                genreCount: genreCount,
                genres: result,
                limit: limit
              });
            })
            .catch(function(err1) {
              res.json({
                success: true,
                message: "No Genres found.",
                genres: []
              });
            })
          } else {
            res.json({
              success: true,
              message: "No Genres found.",
              genres: []
            });
          }    
        })  
      })
    } else {
      //Send the data for admin dashboard
  Genre.find({deleted: false})
  .sort({title:1})
  .then(function(genres) {
    var genrePromise = [];
    if(genres.length > 0) {
      //Function for counting the genres used in songs
      genres.forEach(function(g) {
        g = g.toJSON();
        genrePromise.push(new Promise(function(resolve, reject) {
          Songs.count({genres: g._id}).then(function(songCount) {
            g.songsCount = songCount;
            resolve(g);
          })
        }))
      })
      Promise.all(genrePromise)
      .then(function(result) {
    res.json({
      success: true,
      message: "Genres found.",
          genres: result
    });
  })  
      .catch(function(err1) {
        res.json({
          success: true,
          message: "No Genres found.",
          genres: []
        });
      })
    } else {
      res.json({
        success: true,
        message: "No Genres found.",
        genres: []
      });
    }    
  })  
    }
  })
};

//Api to get Active genres for mobile app
exports.fetchActiveGenres = function(req, res) {
  var userId = req.headers['userid']
  if(userId) {    
    User.findOne({
      _id: userId
    })
    .then(function(user) {
      if(user) {
        var query = {
          _id: {
            $nin: user.blockedGenres
          },
          deleted: false,
          isActive: true
        }
        if(user.isVocalOnly !== "") {
          query._id = mongoose.Types.ObjectId(user.isVocalOnly)
        }
        if(req.query.setting == "true") {
          query = {            
            deleted: false,
            isActive: true
          }
        }
        Genre.find(query)
        .sort({title: 1})
        .then(function(genres) {
          if(genres.length > 0) {
            res.json({
              success: true,
              message: "Genres found.",
              genres: genres
            });
          } else {
            res.json({
              success: true,
              message: "No Genres found.",
              genres: []
            });
          }    
        })  
      } else {
        return res.json({
          success: false,
          message: "User not found"
        });
      }
    })
  } else {
    //send the list of active genres for admin dashboard
    Genre.find({            
      deleted: false,
      isActive: true
    })
    .sort({title:1})
    .then(function(genres) {
      if(genres.length > 0) {
        res.json({
          success: true,
          message: "Genres found.",
          genres: genres
        });
      } else {
        res.json({
          success: true,
          message: "No Genres found.",
          genres: []
    });
  }
    })
  }
};

//Api for mobile app to get the latest artist/songs/albums by genre id
exports.findLatestByGenres = function(req, res) {
  let genreId =  req.params['id'];
  let getArtistsCount = new Promise(function(f, r) {
    Songs.distinct("artist", {
      genres: genreId,
      deleted: false,
      isActive: true
    })
    .then(function(artistIds) {
      Artist.count({
        _id: {
          $in: artistIds
        },
        deleted: false,
        isActive: true
      })
      .then(function(artistCount) {
        f(artistCount);
      })
    })
  });

  let getArtists = new Promise(function(f, r) {
    Songs.distinct("artist", {
      genres: genreId,
      deleted: false,
      isActive: true
    })
    .then(function(artistIds) {
      Artist.find({
        _id: {
          $in: artistIds
        },
        deleted: false,
        isActive: true
      },{
        _id: 1, 
        name: 1, 
        nameHebrew: 1,
        avatar: 1, 
        songCount: 1,
        albumCount: 1,
        shareUrl:1,
        isPremium: 1
      })
      .sort({createdDate: -1})
      .limit(5)
      .then(function(artists) {
        f(artists);
      })
    })
  });

  let getSongsCount = new Promise(function(f, r) {
    Songs.count({
      deleted: false,
      isActive: true, 
      genres: genreId
    })
    .then(function(songsCount) {
      f(songsCount);
    })
  })

  let getSongs = new Promise(function(f, r) {
    Songs.find({
      deleted: false,
      isActive: true, 
      genres: genreId
    },{
      _id: 1,
      title: 1,
      titleHebrew:1,
      artwork:1,
      duration_seconds: 1,
      streamedCount: 1,
      artist: 1,
      ft_artist:1,          
      albums: 1,
      tags: 1,
      genres: 1,
      shareUrl:1,
      isPremium: 1
    })
    .populate('artist', 'name nameHebrew avatar songCount albumCount shareUrl isPremium')
    .populate('ft_artist', 'name nameHebrew avatar songCount albumCount shareUrl isPremium')
    .populate('tags', 'tagName')
    .populate('genres', 'title titleHebrew icon')
    .populate('albums', 'title titleHebrew artwork songCount totalDuration shareUrl isPremium')
    .sort({createdDate: -1})
    .limit(5)
    .then(function(songs) {
      f(songs);
    })
  })

  let getAlbumsCount = new Promise(function(f, r) {
    Songs.distinct("albums", {
      genres: genreId,
      deleted: false,
      isActive: true
    })
    .then(function(albumIds) {
      Album.count({
        _id: {
          $in: albumIds
        },
        deleted: false,
        isActive: true
      })
      .then(function(albumsCount) {
        f(albumsCount)
      })
    })
  })

  let getAlbums = new Promise(function(f, r) {
    Songs.distinct("albums", {
      genres: genreId,
      deleted: false,
      isActive: true
    })
    .then(function(albumIds) {
      Album.find({
        _id: {
          $in: albumIds
        },
        deleted: false,
        isActive: true
      },{
        _id: 1,
        title: 1,
        titleHebrew: 1,
        artwork: 1,
        songCount: 1,
        totalDuration: 1,
        shareUrl: 1,
        isPremium: 1
      })
      .sort({createdDate: -1})
      .limit(5)
      .then(function(albums) {
        f(albums)
      })
    })
  })

  Promise.all([getArtists, getSongs, getAlbums, getArtistsCount, getSongsCount, getAlbumsCount])
  .then(function(data){
    res.json({
      success: true,
      message: 'Listing by genre',
      artists: data[0],
      songs: data[1],
      albums: data[2],
      artistCount: data[3],
      songCount: data[4],
      albumCount: data[5]
    })
  })
}

//Api for mobile app to get the latest Songs by genre id
exports.findLatestSongByGenre = function(req, res) {
  let genreId = req.params['id'];
  let page = req.query.page ? req.query.page : 1;
  let limit = 30;
  skip = page - 1;
  skip = skip * limit;
  Songs.count({
    deleted: false,
    isActive: true,
    genres: genreId
  })
  .then(function(count) {
    let songCount = count;
    Songs.find({
      deleted: false,
      isActive: true,
      genres: genreId
    },{
      _id: 1,
      title: 1,
      titleHebrew:1,
      artwork:1,
      duration_seconds: 1,
      streamedCount: 1,
      artist: 1,
      ft_artist:1,          
      albums: 1,
      tags: 1,
      genres: 1,
      shareUrl:1,
      isPremium: 1
    })
    .populate('artist', 'name nameHebrew avatar songCount albumCount shareUrl isPremium')
    .populate('ft_artist', 'name nameHebrew avatar songCount albumCount shareUrl isPremium')
    .populate('tags', 'tagName')
    .populate('genres', 'title titleHebrew icon')
    .populate('albums', 'title titleHebrew artwork songCount totalDuration shareUrl isPremium')
    .sort({title: 1})
    .skip(skip)
    .limit(limit)
    .lean()
    .then(function(songs) {
      res.json({
        success: true,
        message: "Songs list.",
        count: songCount,
        songs: songs
      });
    })
  })
}

//Api for mobile app to get the latest Artists by genre id
exports.findLatestArtistByGenre = function(req, res) {
  let genreId = req.params['id'];
  let page = req.query.page ? req.query.page : 1;
  let limit = 30;
  skip = page - 1;
  skip = skip * limit;
  Songs.distinct("artist", {
    genres: genreId,
    deleted: false,
    isActive: true
  })
  .then(function(artistIds) {
    Artist.count({
      deleted: false,
      isActive: true,
      _id: {
        $in: artistIds
      }
    })
    .then(function(count) {
      let artistCount = count;
      Artist.find({
        deleted: false,
        isActive:true,
        _id: {
          $in: artistIds
        }
      },{
        _id: 1, 
        name: 1, 
        nameHebrew: 1,
        avatar: 1, 
        songCount: 1,
        albumCount: 1,
        shareUrl:1,
        isPremium: 1
      })
      .sort({name: 1})
      .skip(skip)
      .limit(limit)
      .lean()
      .then(function(artists) {
        res.json({
          success: true,
          message: "Artists list.",
          count: artistCount,        
          artists: artists
        });
      })
    })
  })
}

//Api for mobile app to get the latest Albums by genre id
exports.findLatestAlbumByGenre = function(req, res) {
  let genreId = req.params['id'];
  let page = req.query.page ? req.query.page : 1;
  let limit = 30;
  skip = page - 1;
  skip = skip * limit;
  Songs.distinct("albums", {
    genres: genreId,
    deleted: false,
    isActive: true
  })
  .then(function(albumIds) {
    Album.count({
      _id: {
        $in: albumIds
      },
      deleted: false,
      isActive: true
    })
    .then(function(count) {
      let albumCount = count;
      Album.find({
        _id: {
          $in: albumIds
        },
        deleted: false,
        isActive: true
      },{
        _id: 1,
        title: 1,
        titleHebrew: 1,
        artwork: 1,
        songCount: 1,
        totalDuration: 1,
        shareUrl: 1,
        isPremium: 1
      })
      .sort({title: 1})
      .skip(skip)
      .limit(limit)
      .lean()
      .then(function(albums){
        res.json({
          success: true,
          message: "Albums list.",
          count: albumCount,
          album: albums
        });
      })
    })
  })
}