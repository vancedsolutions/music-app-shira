var User = require('../models/users');
var Artist = require('../models/artist');
var Recipient = require('../models/recipients');
var Tags = require('../models/tags');
var Labels = require('../models/labels');
var Album = require('../models/albums');
var Campaign = require('../models/campaigns');
var Payment = require('../models/payments');
var SongStats = require('../models/songStates');
var Song = require('../models/songs');
var Settings = require('../models/settings');
var ArtistPayoutHistory = require('../models/artistPayoutHistory');
var Playlist = require('../models/playlists');
var Promise = require('bluebird');
var Mongoose = require('mongoose');
var _ = require('lodash');
var Config = require('../config/config');
var stripe = require("stripe")(Config.config().stripe_key);
const AWS = require('aws-sdk')
var moment = require('moment');
var Utils = require('../service/utils');
var shortid = require('shortid');
var EmailService = require('../service/email')
var json2csv = require('json2csv');
var fs = require('fs');
var Genre = require('../models/genres');
var ArtistPayments = require('../models/artistPayments');

//API to create an Artist record
exports.createArtist = function (req, res) {
  var labels = req.body.labels;  
  var labelArr = [];
  var info = req.body;
  var avatarS3Url = '';
  var originalBlob = info.files;  
  var aws = Config.config().aws;
  if(labels.length > 0) {
    var promiseArr = [];
    // Function to create a new label if any 
    labels.forEach(function(label) {
      if (!Mongoose.Types.ObjectId.isValid(label.value)) {
        promiseArr.push(new Promise(function(resolve, reject) {
          Labels.findOneAndUpdate({
            labelName: label.value
          }, {
            $set : {
              labelName: label.value,
              deleted: false,
              isActive: true,
              createdDate: new Date(),
              updatedDate: new Date()
            }
          }, {
            new: true,
            upsert: true
          })
          .then(function(l) {
            resolve(l._id.toString())
          })
        }))
      } else {
        labelArr.push(label.value)
      }
    })
    if(promiseArr.length > 0) {
      Promise.all(promiseArr)
      .then(function(data) {
        labelArr = labelArr.concat(data);
         saveInfo();
      })
    } else {
      saveInfo();
    } 
  } else {
    saveInfo();
  }
  // Function to Save artist profile picture on Amazon s3 bucket
  function saveInfo() {
    if (originalBlob && originalBlob !== '' && typeof(originalBlob !== "number" && originalBlob !== null) && originalBlob.search('https://shiralidevelopment.s3-us-west-1.amazonaws.com') === -1) {
      var regex       = /^data:.+\/(.+);base64,(.*)$/;
      var matches     = originalBlob.match(regex);
      var base64Data  = matches && matches.length && matches[2] ? matches[2] : '';
      var buf         = new Buffer(base64Data, 'base64');
      var newName     = (new Date()).valueOf();
      var newfilename = newName +'.png';   
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
        Key: 'artist/'+newfilename,
        ACL: 'public-read'
      }, function(err, data1) {
        if (err) {
          console.log(err)
        }
        if(data1) {
          avatarS3Url = data1.Location
          Info();
        }
      })
    } else {
      avatarS3Url = originalBlob
      Info();
    }
  // Function to Save all Information of Artist
    function Info() {
      if(req.body.artistId !== undefined) {
        var _shortid = shortid.generate()
        var objArtist = {
          name: req.body.name,
          labels: labelArr,
          nameHebrew: req.body.name_Hebrew,
          emailAddress: (req.body.emailAddress != undefined ? req.body.emailAddress : ''),
          phoneNumber: (req.body.phoneNumber != undefined ? req.body.phoneNumber : ''),
          royaltyCost: (req.body.royaltyCost != undefined ? req.body.royaltyCost : 0),
          avatar: avatarS3Url,
          isPremium: req.body.isPremium
        };
        if(req.body.shortid === "") {
          objArtist.shortid = _shortid;
        }
        if(req.body.shareUrl === "") {
          objArtist.shareUrl = Config.config().siteUrl+"/artists/"+_shortid+".html"
        }
        Artist.findOneAndUpdate({
          _id: req.body.artistId
        }, { 
          $set: objArtist
        },{ 
          new: true,
          upsert: true
        })
        .then((artist) => {
          if (!artist) {
            return res.json({
              success: false,
              message: "No artist found."
            });
          } else {
            Utils.generateSharePage('artists', artist.name, artist.avatar, artist._id, artist.shortid)
            return res.json({
              success: true,
              message: "Changes saved successfully.",
              artist: artist
            });
          }
        })    
      } else {
        var _shortid = shortid.generate();
        var artistObj = new Artist({
          name: req.body.name,
          labels: labelArr,
          nameHebrew: req.body.artistNameHebrew,
          isPremium: req.body.isPremium,
          emailAddress: (req.body.emailAddress != undefined ? req.body.emailAddress : ''),
          phoneNumber: (req.body.phoneNumber != undefined ? req.body.phoneNumber : ''),
          royaltyCost: (req.body.royaltyCost != undefined ? req.body.royaltyCost : 0),
          avatar: avatarS3Url,
          shortid: _shortid,
          shareUrl: Config.config().siteUrl+"/artists/"+_shortid+".html",
          createdDate: new Date(),
          updatedDate: new Date()
        })

        artistObj
        .save()
        .then((artist) => {
          if (!artist) {
            return res.json({
              success: false,
              message: "No artist found."
            });
          } else {
            Utils.generateSharePage('artists', artist.name, artist.avatar, artist._id, artist.shortid)
            return res.json({
              success: true,
              message: "Artist Created successfully.",
              artist: artist
            });
          }
        }) 
      }
    }  
  }
};

// API to update Music Info of an artist
exports.addMusicInfo = function (req, res) {
  var tags = req.body.tags;  
  var tagsArr = [];
  if(tags.length > 0) {
    var promiseArr = [];
    // Function to add new tag or update associated tags
    tags.forEach(function(tag) {
      if (!Mongoose.Types.ObjectId.isValid(tag.value)) {
        promiseArr.push(new Promise(function(resolve, reject) {
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
    if(promiseArr.length > 0) {
      Promise.all(promiseArr)
      .then(function(data) {
        tagsArr = tagsArr.concat(data);
        saveInfo();
      })
    } else {
      saveInfo();
    }
  }

  function saveInfo() {
    var obj = {
      genres: req.body.genres,
      tags: tagsArr
    }
    if(req.body.relatedArtists.length > 0) {
      obj.relatedArtists = req.body.relatedArtists
    } else {
      obj.relatedArtists = []
    }
    if(req.body.relatedSongs.length > 0) {
      obj.relatedSongs = req.body.relatedSongs
    } else {
      obj.relatedSongs = []
    }
    obj.updatedDate = new Date()
    Artist.findOneAndUpdate({
      _id: req.body.artistId
    }, obj,{ 
      new: true 
    })
    .then((artist) => {
      if (!artist) {
        return res.json({
          success: false,
          message: "No artist found."
        });
      } else {
        return res.json({
          success: true,
          message: "Changes saved successfully.",
          artist: artist
        });
      }
    })
  }
};

// API to update Bank Info of an Artist
exports.addBankInfo = function (req, res) {
  var id = req.body.id;
  delete req.body.id;
  Artist.findOne({
    _id: id
  })
  .then((artist) => {
    if (!artist) {
      return res.json({
        success: false,
        message: "No artist found."
      });
    } else {
      if(artist.stripe_account_id === "" && req.body.account) {
        // Stripe api to create artist's account
        stripe.accounts.create({
          type: 'custom',
          country: 'US'          
        }, function(err, account) {
          if(account) {
            artist.stripe_account_id = account.id
            stripe.accounts.createExternalAccount(
              account.id,
              { external_account: req.body.account.id },
              function(err, bank_account) {
                if(bank_account) {
                  artist.bankAccount.bankName = req.body.bankName
                  artist.bankAccount.account = bank_account
                  artist.updatedDate = new Date()
                  artist.save()
                  return res.json({
                    success: true,
                    message: "Changes saved successfully.",
                    artist: artist
                  });
                }
              }
            );
          }
        });
      } else {
        artist.bankAccount.bankName = req.body.bankName
        artist.bankAccount.account = req.body.account
        artist.updatedDate = new Date()
        artist.save()
        return res.json({
          success: true,
          message: "Changes saved successfully.",
          artist: artist
        });
      }     
    }
  })
};

// API to update Address info of an Artist
exports.addAddressInfo = function (req, res) {
  var id = req.body.id;
  delete req.body.id;
  Artist.findOne({
    _id: id
  })
  .then((artist) => {
    if (!artist) {
      return res.json({
        success: false,
        message: "No artist found."
      });
    } else {     
      artist.bankAccount.streetAddress = req.body.streetAddress
      artist.bankAccount.state = req.body.state
      artist.bankAccount.city = req.body.city
      artist.bankAccount.aptNumber = req.body.aptNumber
      artist.bankAccount.zipcode = req.body.zipcode
      artist.updatedDate = new Date()
      artist.save()
    return res.json({
      success: true,
      message: "Changes saved successfully.",
      artist: artist
    });
       
    }
  })
};

//Api to update an Artist record
exports.updateArtist = function(req, res) {
  var artistId = req.params.id;
  var isActive = req.body.isActive;
  Artist.findOneAndUpdate({
    _id: artistId
  }, { 
    $set: {
      isActive: isActive,
      updatedDate: new Date()
    }
  },{ 
    new: true 
  })
  .then((artist) => {
    if (!artist) {
      return res.json({
        success: false,
        message: "No artist found."
      });
    } else {
      var updateArtistSongActiveStatus = new Promise(function(f, r) {
        Song.update({
          artist: artistId
        }, { 
          $set: {
            isActive: isActive
          } 
        },{
          multi: true
        })
        .then((songs) => {
          f(songs)
        })
      })
      
      var updateArtistActiveStatus = new Promise(function(f, r) {
        Album.update({
          artist: artistId
        }, { 
          $set: {
            isActive: isActive
          }
        },{
          multi: true
        })
        .then((albums) => {
          f(albums)
        })
      })
    
      Promise.all([updateArtistSongActiveStatus, updateArtistActiveStatus])
      .then(function(result) {
    return res.json({
      success: true,
      message: "Changes saved successfully.",
      artist: artist
    });
  })
    }
  })
};

//Api to delete an Artist
exports.deleteArtist = function(req, res) {
  var artistId = req.params.id;
  Artist.findOneAndUpdate({
    _id: artistId
  }, { 
    $set: {
      deleted: false
    } 
  },{ 
    new: true 
  })
  .then((artist) => {
    if (!artist) {
      return res.json({
        success: false,
        message: "No artist found."
      });
    }
    return res.json({
      success: true,
      message: "Artists deleted successfully.",
      artist: artist
    });
  })
};

//Api to mark an Artist active/inactive
exports.updateActiveStatus = function(req, res) {
  var artistId = req.params.id;
  var isActive = req.params.isActive;
  Artist.findOneAndUpdate({
    _id: artistId
  }, { 
    $set: {
      isActive: isActive
    } 
  },{ 
    new: true 
  })
  .then((artist) => {
    if (!artist) {
      return res.json({
        success: false,
        message: "No artist found."
      });
    } else {      
      var updateArtistSongActiveStatus = new Promise(function(f, r) {
        Song.update({
          artist: artistId
        }, { 
          $set: {
            isActive: isActive
          } 
        },{
          multi: true
        })
        .then((songs) => {
          f(songs)
        })
      })
      
      var updateArtistActiveStatus = new Promise(function(f, r) {
        Album.update({
          artist: artistId
        }, { 
          $set: {
            isActive: isActive
    }
        },{
          multi: true
        })
        .then((albums) => {
          f(albums)
        })
      })
    
      Promise.all([updateArtistSongActiveStatus, updateArtistActiveStatus])
      .then(function(result) {
    return res.json({
      success: true,
      message: "Changes Saved successfully.",
      artist: artist
    });
  })
    }    
  })
};

//Api to get Artist listing
exports.fetchDetail = function(req, res) {
  var id = req.params.id;
  Artist.findOne({
    _id: id
  })
  .populate('tags','_id', { isActive: true, deleted: false })
  .populate('genres','_id', { isActive: true, deleted: false })
  .populate('labels','_id', { isActive: true, deleted: false })
  .populate({
    path: 'relatedSongs',
    model: 'Songs',
    match: {
      isActive: true,
      deleted: false,
    },
    select: {
      _id: 1, title:1, artwork:1, artist: 1, albums: 1
    },
    populate:[{
      path: 'artist',
      model: 'Artists',
      select: {
        _id: 1, name:1
      }
    }, {
      path: 'albums',
      model: 'Albums',
      select: {
        _id: 1, title: 1
      }
    }]
  })
  .populate('relatedArtists','_id name avatar', { isActive: true, deleted: false })
  .then(function(artist) {
    if(artist) {
      res.json({
        success: true,
        message: "Artists found.",
        artist: artist
      });
    } else {
      res.status(403).send({
        success: false,
        message: "Error in fetching the artist detail."
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

//Api to get detail of an Artist 
exports.fetchArtistDetail = function(req, res) {
  var id = req.params.id;
  var yesterday = moment().add(-24, 'h')
  var sDate = yesterday 
  var eDate = moment()
  var getArtistDetail = new Promise(function(f, r) {
    Artist.findOne({
      _id: id,
      deleted: false,
      isActive: true
    })
    .populate('genres','_id title titleHebrew icon', { isActive: true, deleted: false })
    .populate('relatedArtists', 'name nameHebrew avatar songCount albumCount shareUrl isPremium')
    .then(function(artist) {
      f(artist)
    })
  })
  // Function to get Count of New Released Album of an Artist
  var getArtistNewReleasedAlbumCount = new Promise(function(f, r) {
    Album.count({
      artist: id,
      deleted: false,
      isActive: true,
      isNewRelease: true
    })
    .then(function(newReleaseAlbumCount) {
      f(newReleaseAlbumCount)
    })
  })
  // Function to get New Released Albums of an Artist
  var getArtistNewReleasedAlbums = new Promise(function(f, r) {
    Album.find({
      artist: id,
      deleted: false,
      isActive: true,
      isNewRelease: true
    })
    .populate('artist', 'name nameHebrew avatar songCount albumCount shareUrl isPremium')
    .populate('songs', 'title titleHebrew song_original_fileurl artwork duration duration_seconds shareUrl isPremium')
    .sort({createdDate: -1, updatedDate: -1})
    .limit(10)
    .then(function(NewReleasedAlbums) {
      f(NewReleasedAlbums)
    })
  })
  // Function to get Albums Count of an Artist
  var getArtistAlbumsCount = new Promise(function(f, r) {
    Album.count({
      artist: id,
      deleted: false,
      isActive: true      
    })
    .then(function(albumsCount) {
      f(albumsCount)
    })
  })
  // Function to get Albums listing of an Artist
  var getArtistAlbums = new Promise(function(f, r) {
    Album.find({
      artist: id,
      deleted: false,
      isActive: true      
    }, {
      _id:1,
      title: 1,
      titleHebrew:1,
      artwork:1,
      shareUrl:1,
      isPremium:1
    })
    .sort({createdDate: -1, updatedDate: -1})
    .limit(4)
    .then(function(albums) {
      f(albums)
    })
  })
  // Function to get Popular Songs Count of an Artist
  var getArtistPopularSongsCount = new Promise(function(f, r) {
    var yesterday = moment().add(-24, 'h')
    var sDate = new Date(yesterday) 
    var eDate = new Date(moment())
    SongStats.find({
      updatedDate: {
        $gte: sDate,
        $lte: eDate
      },
      streamedCount: {
        $gt: 0
      }      
    })
    .sort({streamedCount: -1})
    .then(function(songIds) {
      if(songIds.length > 0) {
        var sids = [];
        songIds.forEach(function(s) {
          if(sids.indexOf(s.songId) == -1) {
            sids.push(s.songId)
          }
        })
        Song.count({
          _id: {
            $in: sids
          },
          artist: id,
          deleted: false,
          isActive: true
        })
        .then(function(popularSongsCount) {
          f(popularSongsCount)
        })
      } else {
        f(0)
      }
    })
  })
  // Function to get Popular songs listing of an Artist
  var getArtistPopularSongs = new Promise(function(f, r) {
    var yesterday = moment().add(-24, 'h')
    var sDate = new Date(yesterday) 
    var eDate = new Date(moment())
    SongStats.find({
      updatedDate: {
        $gte: sDate,
        $lte: eDate
      },
      streamedCount: {
        $gt: 0
      }      
    })
    .sort({streamedCount: -1})
    .then(function(songIds) {
      if(songIds.length > 0) {
        var sids = [];
        songIds.forEach(function(s) {
          if(sids.indexOf(s.songId) == -1) {
            sids.push(s.songId)
          }
        })
        Song.find({
          _id: {
            $in: sids
          },
          artist: id,
          deleted: false,
          isActive: true
        })
        .populate('artist', 'name nameHebrew avatar songCount albumCount shareUrl isPremium')
        .populate('ft_artist', 'name nameHebrew avatar songCount albumCount shareUrl isPremium')
        .populate('tags', 'tagName')
        .populate('genres', 'title titleHebrew icon')
        .populate('albums', 'title titleHebrew artwork songCount totalDuration shareUrl isPremium')
        .limit(5)
        .then(function(popularSongs) {
          f(popularSongs)
        })
      } else {
        f([])
      }
    })
  })
  // Function to get popular playlist count of an Artist
  var getArtistPopularPlaylistCount = new Promise(function(f, r) {
    var yesterday = moment().add(-24, 'h')
    var sDate = new Date(yesterday) 
    var eDate = new Date(moment())
    User.distinct("_id", {
      role: { $in: ["admin", "superadmin"] }
    })
    .then(function(users) {
      SongStats.find({
        updatedDate: {
          $gte: sDate,
          $lte: eDate
        },
        streamedCount: {
          $gt: 0
        }      
      })
      .then(function(songIds) {
        if(songIds.length > 0) {
          var sids = [];
          songIds.forEach(function(s) {
            if(sids.indexOf(s.songId) == -1) {
              sids.push(s.songId)
            }
          })
          Song.distinct("_id", {
            _id: {
              $in: sids
            },
            artist: id,
            deleted: false,
            isActive: true
          })
          .then(function(sIds) {
            Playlist.count({
              songs: {
                $in: sIds
              },
              createdBy: {
                $in: users
              },
              deleted: false,
              isActive: true
            })
            .then(function(popularPlaylistCount) {
              f(popularPlaylistCount)
            })
          })
        } else {
          f(0)
        }
      })
    })
  })
  // Function to get popular playlist of an Artist
  var getArtistPopularPlaylist = new Promise(function(f, r) {
    var yesterday = moment().add(-24, 'h')
    var sDate = new Date(yesterday) 
    var eDate = new Date(moment())
    User.distinct("_id", {
      role: { $in: ["admin", "superadmin"] }
    })
    .then(function(users) {
      SongStats.find({
        updatedDate: {
          $gte: sDate,
          $lte: eDate
        },
        streamedCount: {
          $gt: 0
        }      
      })
      .then(function(songIds) {
        if(songIds.length > 0) {
          var sids = [];
          songIds.forEach(function(s) {
            if(sids.indexOf(s.songId) == -1) {
              sids.push(s.songId)
            }
          })
          Song.distinct("_id", {
            _id: {
              $in: sids
            },
            artist: id,
            deleted: false,
            isActive: true
          })
          .then(function(sIds) {
            Playlist.find({
              songs: {
                $in: sIds
              },
              createdBy: {
                $in: users
              },
              deleted: false,
              isActive: true
            })
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
                  _id: 1, title: 1, titleHebrew: 1, artwork:1, songCount:1, totalDuration:1, shareUrl:1, isPremium:1
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
            .limit(4)
            .then(function(popularPlaylist) {
              f(popularPlaylist)
            })
          })
        } else {
          f([])
        }
      })
    })
  })

  // Function to get Artist songs list
  var getArtistSongs = new Promise(function(f, r) {      
    Song.distinct("_id", {
      artist: id,
      deleted: false,
      isActive: true
    })
    .then(function(songIds) {
      f(songIds)
    })
  })

  // Function to get Artist songs unique genres
  var getArtistGenres = new Promise(function(f, r) {      
    Song.distinct("genres", {
      artist: id,
      deleted: false,
      isActive: true
    })
    .then(function(genreIds) {
      if(genreIds.length > 0) {
        var gids = [];
        genreIds.forEach(function(g) {
          if(gids.indexOf(g) == -1) {
            gids.push(g)
          }
        });
        Genre.find({
          _id: {
            $in : gids
          },
          deleted: false,
          isActive: true
        }, {
          _id: 1,
          title: 1,
          titleHebrew: 1,
          icon: 1
        })
        .then(function(genres) {
          f(genres)
        })
      } else {
        f([]);
      }      
    })
  })

  // Execute all the promise functions above
  Promise.all([getArtistDetail, getArtistNewReleasedAlbums, getArtistAlbums, 
    getArtistPopularSongs, getArtistPopularPlaylist, getArtistNewReleasedAlbumCount,
    getArtistAlbumsCount, getArtistPopularSongsCount, getArtistPopularPlaylistCount, getArtistSongs, getArtistGenres])
  .then(function(result) {
    var _artist = null
    if(result[0]) {
      _artist = result[0];
      _artist = _artist.toJSON();
        _artist.genres = result[10];
      }
    res.json({
      success: true,
      message: "Artist detail.",
      artist: _artist,
      NewReleasedAlbums: result[1],
      albums: result[2],
      popularSongs: result[3],
      popularPlaylist: result[4],
      NewReleasedAlbumsCount: result[5],
      albumsCount: result[6],
      popularSongsCount: result[7],
      popularPlaylistCount: result[8],
      artistSongs: result[9]
    });
  })
};

// API to get Artists Popular songs with paggination
exports.fetchArtistPopularSongs = function(req,res) {
  var userId = req.headers['userid']
  var id = req.params.id;
  var yesterday = moment().add(-24, 'h')
  var sDate = new Date(yesterday) 
  var eDate = new Date(moment())
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
  SongStats.find({
    updatedDate: {
      $gte: sDate,
      $lte: eDate
    },
    streamedCount: {
      $gt: 0
    }      
  })
  .sort({streamedCount: -1})
  .then(function(songIds) {
    if(songIds.length > 0) {
      var sids = [];
      songIds.forEach(function(s) {
        if(sids.indexOf(s.songId) == -1) {
          sids.push(s.songId)
        }
      })
          var query = {
        _id: {
          $in: sids
        },
        artist: id,
        deleted: false,
        isActive: true
          }
          if(user.isVocalOnly !== "") {
            query.genres = Mongoose.Types.ObjectId(user.isVocalOnly)
          } else {
            query.genres= { $nin: user.blockedGenres }
          }
          Song.find(query)
      .populate('artist', 'name nameHebrew avatar songCount albumCount shareUrl isPremium')
      .populate('ft_artist', 'name nameHebrew avatar songCount albumCount shareUrl isPremium')
      .populate('tags', 'tagName')
      .populate('genres', 'title titleHebrew icon')
      .populate('albums', 'title titleHebrew artwork songCount totalDuration shareUrl isPremium')
      .skip(skip)
      .limit(limit)
      .lean()
      .then(function(popularSongs) {
        res.json({
          success: true,
          message: "Popular songs listing.",
          songs: popularSongs
        });
      })
    } else {
      res.json({
        success: false,
        message: "Popular songs listing not found.",
        songs: []
      });
    }
  })
    }
  })
}

// API to get Artist's Popular Playlist with paggination
exports.fecthArtistPopularPlayLists = function(req, res) {
  var userId = req.headers['userid']
  var id = req.params.id;
  var yesterday = moment().add(-24, 'h')
  var sDate = new Date(yesterday) 
  var eDate = new Date(moment())
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
  User.distinct("_id", {
    role: { $in: ["admin", "superadmin"] }
  })
  .then(function(users) {
    SongStats.find({
      updatedDate: {
        $gte: sDate,
        $lte: eDate
      },
      streamedCount: {
        $gt: 0
      }      
    })
    .then(function(songIds) {
      if(songIds.length > 0) {
        var sids = [];
        songIds.forEach(function(s) {
          if(sids.indexOf(s.songId) == -1) {
            sids.push(s.songId)
          }
        })
            var query = {
          _id: {
            $in: sids
          },
          artist: id,
          deleted: false,
          isActive: true
            }
            if(user.isVocalOnly !== "") {
              query.genres = Mongoose.Types.ObjectId(user.isVocalOnly)
            } else {
              query.genres= { $nin: user.blockedGenres }
            }
            Song.distinct("_id", query)
        .then(function(sIds) {
          Playlist.find({
            songs: {
              $in: sIds
            },
            createdBy: {
              $in: users
            },
            deleted: false,
            isActive: true
          })
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
                _id: 1, title: 1, titleHebrew: 1, artwork:1, songCount:1, totalDuration:1, shareUrl:1, isPremium:1
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
          .skip(skip)
          .limit(limit)
          .lean()
          .then(function(popularPlaylist) {
            res.json({
              success: true,
              message: "Popular playlist listing.",
              playlists: popularPlaylist
            });          
          })
        })
      } else {
        res.json({
          success: false,
          message: "Popular playlist listing not found.",
          playlists: []
        });
      }
    })
  })
    }
  })
}

// API to get Artist's New Releases Albums with paggination
exports.getArtistNewReleaseAlbums = function (req, res) {
  var id = req.params.id
  var page = req.query["page"] ? req.query["page"] : 1
  let limit = 10;
  let skip = 0;
  skip = page - 1
  skip = skip * limit
  Album.find({
    artist: id,
    deleted: false,
    isActive: true,
    isNewRelease: true
  })
  .populate('artist', 'name nameHebrew avatar songCount albumCount shareUrl isPremium')
  .populate('songs', null, { isActive: true, deleted: false })
  .populate('tags', null, { isActive: true, deleted: false })
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
};

//Api to get Artist listing to display on dashboard side
exports.fetchArtists = function(req, res) {
  Settings.findOne({},{
    'fieldsPerPage':1
  })
  .then(function(fields) {
    var page = req.query.page ? req.query.page : 'all'
    if(page !== "all") {
      let limit = fields.fieldsPerPage;
      skip = page - 1
      skip = skip * limit
      var term = req.query.term
      var start = req.query.start
      var query = {
        deleted: false
      }

      if(term !== undefined && term !== "") {
        query.name = {$regex: term, $options: 'i'}
      }

      if(start !== undefined && start !== "all" && start !== "none") {
        query.name = {$regex: '^'+ start, $options: 'i'}
      }

      if(start !== undefined && start === 'none') {
        query.name = { $regex: '^[0-9]', $options: 'i' }    
      }

      Artist.count(query)
      .then(function(count) {
        let artistCount = count
        var getArtistsList = new Promise(function(f, r) {
          Artist.find(query,{
            name:1,
            shortid:1,
            isActive:1
          })
          .skip(skip)
          .limit(limit)
          .sort({'name':1})
          .lean()
          .then(function(artists) {
            artists.limit = limit
            artists.count = artistCount
            f(artists)
          })
          .catch(function(err) {
            r(err)
          })
        })
        // Function to get Active Artists count
        var getActiveArtistsList = new Promise(function(f, r) {
          Artist.count({
            isActive: true,
            deleted: false
          })
          .then(function(count) {
            f(count)
          })
          .catch(function(err) {
            r(0)
          })
        })
        //Function to get Non Active Artists count
        var getNotActiveArtistsList = new Promise(function(f, r) {
          Artist.count({
            isActive: false,
            deleted: false
          })
          .then(function(count) {
            f(count)
          }) 
          .catch(function(err) {
            r(0)
          })
        })
        // Execute all the promise functions above
        Promise.all([getArtistsList, getActiveArtistsList, getNotActiveArtistsList])
        .then(function(data) {
          res.json({
            success: true,
            message: "Artists found.",
            artists: data[0],
            limit: data[0].limit,
            count: data[0].count,
            activeArtists: data[1],
            notActiveArtists: data[2]
          });
        })
        .catch(function(err) {
          res.status(403).send({
            success: false,
            message: "Error in fetching artists."
          });
        })
      })
    } else {
      var getArtistsList = new Promise(function(f, r) {
        var term = req.query.term
        var start = req.query.start
        var query = {
          deleted: false
        }
        if(term !== undefined && term !== "") {
          query.name = {$regex: term, $options: 'i'}
        }

        if(start !== undefined && start !== "all" && start !== "none") {
          query.name = {$regex: '^'+ start, $options: 'i'}
        }

        if(start !== undefined && start === 'none') {
          query.name = { $regex: '^[0-9]', $options: 'i' }    
        }

        Artist.find(query)
        .then(function(artists) {
          f(artists)
        })
        .catch(function(err) {
          r(err)
        })
      })
      //Function to get active artist count
      var getActiveArtistsList = new Promise(function(f, r) {
        Artist.count({
          isActive: true,
          deleted: false
        })
        .then(function(count) {
          f(count)
        })
        .catch(function(err) {
          r(0)
        })
      })
      //Function to get inactive artist count
      var getNotActiveArtistsList = new Promise(function(f, r) {
        Artist.count({
          isActive: false,
          deleted: false
        })
        .then(function(count) {
          f(count)
        }) 
        .catch(function(err) {
          r(0)
        })
      })
      // Execute all the promise functions above
      Promise.all([getArtistsList, getActiveArtistsList, getNotActiveArtistsList])
      .then(function(data) {
        res.json({
          success: true,
          message: "Artists found.",
          artists: data[0],
          activeArtists: data[1],
          notActiveArtists: data[2]
        });
      })
      .catch(function(err) {
        res.status(403).send({
          success: false,
          message: "Error in fetching artists."
        });
      })
    }
  })
}

//Api to get Artist listing
exports.fetchArtistslist = function(req, res) {
  Settings.findOne({},{
    'fieldsPerPage':1
  })
  .then(function(fields) {
    var page = req.query.page ? req.query.page : 'all'
    let limit = fields.fieldsPerPage;  
    let skip = page !== "all" ? (page - 1) : page
    skip = skip * limit
    var term = req.query.term
    var start = req.query.start
    if(term === 'undefined') {
      term = '';
    }
    var query = {
      deleted: false
    }
    if(term !== "") {
      query.name = {$regex: _.get(req,"query.term"), $options: 'i'}
    }
    if(_.get(req,"query.start") !== "all" && _.get(req,"query.start") !== "none") {
      query.name = {$regex: '^'+ _.get(req,"query.start"), $options: 'i'}
    }
    if(_.get(req,"query.start","") === 'none') {
      query.name = { $regex: '^[0-9]', $options: 'i' }    
    }
    
    Promise.all([
      Artist.count(query),
      Artist.find(query,{name:1,isActive:1, shortid:1}).skip(skip).limit(limit).sort({name:1}).lean(),
      Artist.count({isActive: true,deleted: false}),
      Artist.count({isActive: false,deleted: false})
    ])
    .spread((artistCount,Artists,activeArtists,notActiveArtists) =>{
      res.json({
        success: true,
        message: "Artists found.",
        artists:Artists,
        limit: limit,
        count: artistCount,
        activeArtists: activeArtists,
        notActiveArtists: notActiveArtists
      });
    })
  })
}

//Api to get Artist albums listing
exports.fetchArtistAlbums = function(req, res) {
  var id = req.params.id
  var page = req.query["page"] ? req.query["page"] : "all" 
  if(page !== "all") {
  let limit = Config.config().allApiLimit;
  let skip = 0;
  skip = page - 1
  skip = skip * limit
  Album.find({
    artist: id,
    deleted: false,
    isActive: true      
  }, {
    _id:1,
    title: 1,
    titleHebrew: 1,
    artwork: 1,
    isExclusive: 1,
    isNewRelease: 1,
    isPremium:1,
    artist:1,
    songCount: 1,
    totalDuration: 1,
    shareUrl:1
  })
  .populate('artist', 'name nameHebrew avatar songCount albumCount emailAddress phoneNumber shareUrl isPremium')
    .sort({createdDate: -1, updatedDate: -1})    
  .then(function(albums) {
      var albumsPromise = [];
      albums.forEach(function(a) {
        a = a.toJSON();
        albumsPromise.push(new Promise(function(resolve, reject) {
          Song.aggregate([
            {$project: {albums: 1, streamedCount: 1}},
            {$match: {albums: {$in: [a._id]}}},
            {$group:
              {_id: '0',
                totalStreamedCount:{$sum:'$streamedCount'}
              }
            }
          ])
          .then(function(songStremedCount) {
            a.songStremedCount = (songStremedCount.length > 0 ? songStremedCount[0].totalStreamedCount : 0)
            resolve(a);
          })
        }))
      })
      Promise.all(albumsPromise)
      .then(function(finalResult) {
        finalResult.sort(function(a, b) {
          return b.songStremedCount - a.songStremedCount
        })
        finalResult = finalResult.splice(skip, skip + limit);
    res.json({
      success: true,
      message: "Albums listing.",
          albums: finalResult
    });
  })
      .catch(function(err1) {
        albums = albums.splice(skip, skip + limit);
        res.json({
          success: true,
          message: "Albums listing.",
          albums: albums
    });
  })
    })
  } else {
    Album.find({
      artist: id,
      deleted: false,
      isActive: true,
    }, {
      title: 1,
      titleHebrew: 1,
      artwork: 1,
      isExclusive: 1,
      isNewRelease: 1,
      isPremium:1,
      artist:1,
      songCount: 1,
      totalDuration: 1,
      shareUrl:1
    })
    .populate('artist', 'name nameHebrew avatar songCount albumCount emailAddress phoneNumber shareUrl isPremium')
    .lean()
    .then(function(albums) {
      res.json({
        success: true,
        message: "Albums listing.",
        albums: albums
      });
    })
    .catch(function(err) {
      res.status(403).send({
        success: false,
        message: "Error in fetching artist albums."
      });
    })
  }
}

//Api to get Artist songs listing
exports.fetchArtistSongs = function(req, res) {
  var id = req.params.id
  Song.find({
    artist: id,
    deleted: false,
    isActive: true,
  }, {
    title: 1,
    titleHebrew: 1,
    artwork: 1,
    isExclusive: 1,
    isNewRelease: 1,
    artist:1,
    ft_artist: 1,
    tags:1,
    genres:1,
    albums:1,
    shareUrl:1,
    isPremium:1
  })
  .populate('artist', 'name nameHebrew avatar songCount albumCount shareUrl isPremium')
  .populate('ft_artist', 'name nameHebrew avatar songCount albumCount shareUrl isPremium')
  .populate('tags', 'tagName', { isActive: true, deleted: false })
  .populate('genres', 'title titleHebrew icon', { isActive: true, deleted: false })
  .populate('albums', 'title titleHebrew artwork shareUrl isPremium', { isActive: true, deleted: false })
  .then(function(songs) {
    res.json({
      success: true,
      message: "Songs listing.",
      songs: songs
    });
  })
  .catch(function(err) {
    res.status(403).send({
      success: false,
      message: "Error in fetching artist songs."
    });
  })
}

//Api to get artist payout payment details
exports.fetchArtistForPayment = function(req, res) {
  var filter = JSON.parse(req.params.filter)
  var _month = parseInt(filter.month)
  var _year = parseInt(filter.year)
  var term = filter.term
  var role = filter.role
  var userid = filter.id
  
  let songsList = [];
  let finalSongs = [];
  let page = parseInt(filter.page || 1);
  let startInd = parseInt(page -1);
  if(term === undefined || term === "undefined") {
    term = ""
  }
  Settings.findOne({}, {
    'fieldsPerPage': 1
  })
  .then(function(fields) {
    let limit = fields.fieldsPerPage;
    ArtistPayments.findOne({
      month: _month,
      year: _year
      })
    .then(function(artistPayments) {
      if(artistPayments) {
        let artists = artistPayments.artists;
        let recipientsList = artistPayments.recipients;
        
        if(term !== "" && (role === "superadmin" || role === "admin")) {
          artists = artists.filter(function(e){ return (e.artistName.toLowerCase().toString().indexOf(term.toLowerCase().toString()) !== -1); });
          recipientsList = recipientsList.filter(function(e){ return (e.name.toLowerCase().toString().indexOf(term.toLowerCase().toString()) !== -1); });
              }
        if(role === "artist") {
          recipientsList = []
          artists = artists.filter(function(e){ return (e.artistId.toString() === userid.toString()); });
            }
        if(role === "recipient") {
          artists = []
          recipientsList = recipientsList.filter(function(e){ return (e.id.toString() === userid.toString()); });
          var recList = []
          artistPayments.artists.map(a => {
            a.songs.map(s => {
              s.perPaidStreamRate = a.perPaidStreamRate
              s.perFreeStreamRate = a.perFreeStreamRate
              recList.push(s);
            })
          })
          recList.map(r => {
            r.recipients.find(function(e){
              if(e.id && e.id.toString() === userid.toString()) {
                songsList.push(r);
                return true;
              } else{
                return false;
              }
            })
          });
          finalSongs = _.slice(songsList,startInd*limit, (startInd*limit + limit))
        }
        res.json({
          success: true,
          message: "Data found.",
          totalRevenue: artistPayments.totalRevenue,
          artists: artists,
          totalPaidStreams: artistPayments.totalPaidStreams,
          totalFreeStreams: artistPayments.totalFreeStreams,
          recipientsList: recipientsList,
          recipientSongs:finalSongs,
          limit: limit,
          count: _.size(songsList)
        });
      } else {
        res.json({
          success: true,
          message: "Data found.",
          totalRevenue: 0,
          artists: [],
          totalPaidStreams: 0,
          totalFreeStreams: 0,
          recipientsList: [],
          recipientSongs:[],
          limit: 0,
          count: 0
        });
        }
    })
  });
  
}

//Api to get Artist payout details
exports.fetchArtistPayoutDetail = function(req, res) {
  var filter = JSON.parse(req.params.filter)
  var _month = parseInt(filter.month)
  var _year = parseInt(filter.year)
  var artistId = req.params.id

  ArtistPayments.findOne({
                      month: _month,
    year: _year
                    })
  .then(function(artistPayments) {
    if(artistPayments) {
      let artists = artistPayments.artists;
      let songs = []
      let recipientsList = []
      artists = artists.filter(function(e){ return (e.artistId.toString() === artistId.toString()); });
      if(artists.length > 0) {
        songs = artists[0].songs
        recipientsList = artists[0].recipientsList
          }
                  res.json({
                    success: true,
                    message: "Data found.",
        payout: artists,
        songsList: songs,
        recipientsList: recipientsList
                  });
        } else {
          res.json({
            success: true,
            message: "Data found.",
        totalRevenue: 0,
        payout: [],
        songsList: [],
        recipientsList: [],
  });
    }
  })
}

// Api to transfer payout amount to artist bank account
exports.PayoutToArtist = function(req, res) {
  var months = [ "Jan", "Feb", "Mar", "Apr", "May", "June",
                "July", "Aug", "Sept", "Oct", "Nov", "Dec" ];              
  var payoutData = req.body
  var payoutPromise = [];
  var artistsArr = payoutData.artists
  var recipientsArr = payoutData.recipients

  artistsArr.forEach(function(payout) {
    payoutPromise.push(new Promise(function(resolve, reject) {
      var artistId = payout.artistId
      var adminId = payout.adminId
      var _month = payout.month
      var _year = payout.year
      var userType = payout.type
      var startmonth = months[_month - 1];
      const startdate = startmonth + ' ' + '01' + ', ' + _year
      var songList = []
      var payoutAmount = parseFloat(payout.totalPayout).toFixed(2)
      payoutAmount = payoutAmount * 100
      Artist.findOne({
        _id: artistId
      })
      .then(function(artist) {
        if(artist) {
          if(artist.bankAccount && artist.bankAccount.account) {
            stripe.transfers.create({
              amount: payoutAmount,
              currency: "usd",
              destination: artist.stripe_account_id
            }, function (err, transfer) {
              if(transfer) {
                const date = new Date();
                var endmonth = months[date.getMonth()];
                const enddate = endmonth + ' ' + date.getDate() + ', ' + date.getFullYear()
                EmailService.sendArtistPayedMail(artist, payout, startdate, enddate);
                var paidStreammedSongs = []
                var freeStreammedSongs = []
                SongStats.aggregate([
                  {$project: {songId: 1, paidPlantype: '$plantype', paidStreamedCount: '$streamedCount', month: {$month: '$createdDate'}, year: {$year: '$createdDate'}}},
                  {$match: {month: _month, year: _year, paidPlantype: 'paid'}}
                ])
                .then(function(resultPaid) {
                  var paidStreammedSongs = resultPaid
                  SongStats.aggregate([
                    {$project: {songId: 1, freePlantype: '$plantype', freeStreamedCount: '$streamedCount', month: {$month: '$createdDate'}, year: {$year: '$createdDate'}}},
                    {$match: {month: _month, year: _year, freePlantype: 'free'}}
                  ])
                  .then(function(resultFree) {
                    var freeStreammedSongs = resultFree   
                    var finalList = paidStreammedSongs.concat(freeStreammedSongs)
                    var listPromise = [];
                    if(finalList.length > 0) {
                      finalList.forEach(function(song) {
                        listPromise.push(new Promise(function(f, r) {
                          Song.findOne({_id: song.songId})
                          .populate('artist', 'name')
                          .then(function(s) {
                            if(s) {
                              song.artist = s.artist;
                              f(song);
                            }
                          })
                        }))
                      })
                      Promise.all(listPromise)
                      .then(function(result) {
                        songList = result
                        artistSongListPromise = []
                        var artistSongList = songList.filter(function(e){ return (e.artist._id.toString() === artistId.toString()); });
                        if(artistSongList.length > 0) {
                          artistSongList.forEach(function(song) {
                            artistSongListPromise.push(new Promise(function(ff, rr) {
                              SongStats.findOneAndUpdate({
                                _id: song._id
                              }, {$set: {
                                isPayout: true,
                                payoutDate: new Date()
                              }},{
                                new: true,
                                multi: true
                              })                          
                              .then(function(s) {
                                ff(s)
                              })
                            }))
                          })
                          Promise.all(artistSongListPromise)
                          .then(function(result) {
                            var payoutHistory = new ArtistPayoutHistory({
                              artist: artistId,
                              type: userType,
                              perPaidStreamRate: payout.perPaidStreamRate,
                              perFreeStreamRate: payout.perFreeStreamRate,
                              payout: transfer,
                              songsPaid: result,
                              month: _month,
                              year: _year,
                              payoutDate: new Date(),
                              payoutBy: adminId
                            })
                            payoutHistory.save();
                            resolve(payoutHistory)
                          });
                        } else {
                          ff([])
                        }
                      })                  
                    } else {
                      f([])
                    }
                  })      
                })
              } else {
                resolve({})
              }
            })
          } else {
            resolve({})
          }
        } else {
          resolve({})
        }
      })
    }))
  })

  recipientsArr.forEach(function(recipient) {
    payoutPromise.push(new Promise(function(resolve, reject) {
      var recipientId = recipient.id
      var adminId = recipient.adminId
      var _month = recipient.month
      var _year = recipient.year
      var userType = recipient.type
      var startmonth = months[_month - 1];
      const startdate = startmonth + ' ' + '01' + ', ' + _year
      var songList = []
      var payoutAmount = parseFloat(recipient.earning).toFixed(2)
      payoutAmount = payoutAmount * 100
      Recipient.findOne({
        _id: recipientId
      })
      .then(function(recipientUser) {
        if(recipientUser) {
          if(recipientUser.account) {
            stripe.transfers.create({
              amount: payoutAmount,
              currency: "usd",
              destination: recipientUser.stripe_account_id
            }, function (err, transfer) {
              if(transfer) {
                const date = new Date();
                var endmonth = months[date.getMonth()];
                const enddate = endmonth + ' ' + date.getDate() + ', ' + date.getFullYear()
                EmailService.sendArtistPayedMail(recipientUser, recipient, startdate, enddate);
                var payoutHistory = new ArtistPayoutHistory({
                  artist: recipientId,
                  type: userType,
                  perPaidStreamRate: 0,
                  perFreeStreamRate: 0,
                  payout: transfer,
                  songsPaid: [],
                  month: _month,
                  year: _year,
                  payoutDate: new Date(),
                  payoutBy: adminId
                })
                payoutHistory.save();
                resolve(payoutHistory)
              } else {
                resolve({})
              }
            })
          } else {
            resolve({})
          }
        } else {
          resolve({})
        }
      })
    }))
  })

  Promise.all(payoutPromise)
  .then(function(finalResult) {
    res.json({
      success: true,
      message: "Artist paid successfully."
    });
  })
  .catch(function(err) {
    res.status(403).send({
      success: false,
      message: "Error in processing the payout request."
    });
  })
}

//Api to get Artist payout details
exports.fetchRecipientPayoutDetail = function(req, res) {
  var filter = JSON.parse(req.params.filter)
  var _month = parseInt(filter.month)
  var _year = parseInt(filter.year)
  var recipientId = req.params.id
  var songList = []
  var songsArr = []
  ArtistPayoutHistory.findOne({
    month: _month,
    year: _year,
    artist: recipientId,
    type: 'recipient'
  })
  .then(function(payoutHistory) {
    if(payoutHistory) {
      getPayoutDetailForMonth(payoutHistory)
    } else {
      getPayoutDetailForMonth(null)
    }
  })

  function getPayoutDetailForMonth(history) {
    var getAdRevenueForMonth = new Promise(function(f, r) {
      Campaign.aggregate([
        {$project: {campaign:1, month: {$month: '$campaign.createDate'}, year: {$year: '$campaign.createDate'}}},
        {$match: {month: _month, year: _year}},
        {$group:
          {_id: '0',
            totalAdRevenue:{$sum:'$campaign.amount'}
          }
        }
      ])
      .then(function(result) {
        if(result.length > 0) {
          f(parseFloat(result[0].totalAdRevenue).toFixed(2))
        } else {
          f(0)
        }     
      })
    });

    // Function to get subscription revenue for the Month 
    var getSubscriptionRevenueForMonth = new Promise(function(f, r) {
      var month = _month - 1;
      var monthStartDate = moment([_year, month]).startOf('month').format('YYYY-MM-DD')
      var monthEndDate = moment([_year, month]).endOf('month').format('YYYY-MM-DD')
      monthStartDate = Utils.formatStartDate(new Date(monthStartDate))
      monthEndDate = Utils.formatEndDate(new Date(monthEndDate))
      Payment.distinct("userId", {
        paymentDate : {
          $gte: new Date(monthStartDate), 
          $lte: new Date(monthEndDate)
        }, 
        isRefunded : false
      })
      .then(function(userids) {
        Promise.all([
          User.aggregate([
            {$project: {_id: 1, subscribePlan: 1}},
            {$match: {_id: {$in: userids}, 'subscribePlan.planId': 'Shirali_Monthly_Subscription'}},
            {$group:
              {_id: '0',
                totalMonthlyRevenue:{ $sum:'$subscribePlan.amount' }
              }
            }
          ]),
          User.aggregate([
            {$project: {subscribePlan: 1}},
            {$match: {'subscribePlan.planId': 'Shirali_Yearly_Subscription', 'subscribePlan.subscriptionRenewDate': {$gte: new Date()}}},
        {$group:
          {_id: '0',
                totalYearlyRevenue:{$sum:'$subscribePlan.amount'}
          }
        }
      ])
        ])
        .spread(function(monthlyRevenue, yearlyRevenue) {
          let monthRevenue = (monthlyRevenue.length > 0 ? parseFloat(monthlyRevenue[0].totalMonthlyRevenue) : 0)
          let yearRevenue = (yearlyRevenue.length > 0 ? parseFloat(yearlyRevenue[0].totalYearlyRevenue) : 0)
          yearRevenue = parseFloat(yearRevenue/12)
          let totalSubscriptionRevenue = parseFloat(monthRevenue + yearRevenue).toFixed(2)
          f(totalSubscriptionRevenue)
        })
      })
    })

    var getArtistsForPayout = new Promise(function(f, r) {
      var paidStreammedSongs = []
      var freeStreammedSongs = []
      SongStats.aggregate([
        {$project: {songId: 1, paidPlantype: '$plantype', paidStreamedCount: '$streamedCount', month: {$month: '$createdDate'}, year: {$year: '$createdDate'}}},
        {$match: {month: _month, year: _year, paidPlantype: 'paid'}},
        {$group: {_id: '$songId', isPayout : { $first: '$isPayout' }, paidStreamedCount:{$sum:'$paidStreamedCount'}}}
      ])
      .then(function(resultPaid) {
        var paidStreammedSongs = resultPaid
        SongStats.aggregate([
          {$project: {songId: 1, freePlantype: '$plantype', freeStreamedCount: '$streamedCount', month: {$month: '$createdDate'}, year: {$year: '$createdDate'}}},
          {$match: {month: _month, year: _year, freePlantype: 'free'}},
          {$group: {_id: '$songId', isPayout : { $first: '$isPayout' }, freeStreamedCount:{$sum:'$freeStreamedCount'}}}
        ])
        .then(function(resultFree) {
          var freeStreammedSongs = resultFree   
          var finalList = _(paidStreammedSongs).concat(freeStreammedSongs).groupBy('_id').map(_.spread(_.assign)).value();
          var listPromise = [];
          if(finalList.length > 0) {
            finalList.forEach(function(song) {
              if (!song.hasOwnProperty('paidStreamedCount')) {
                song.paidStreamedCount = 0
              }
              if (!song.hasOwnProperty('freeStreamedCount')) {
                song.freeStreamedCount = 0
              }
              listPromise.push(new Promise(function(resolve, reject) {
                Song.findOne({
                  _id: song._id,
                  'recipients.id': recipientId})
                .populate('artist', 'name nameHebrew royaltyCost stripe_account_id')
                .populate('recipients.id', 'name stripe_account_id', { isActive: true, deleted: false })
                .then(function(s) {
                  if(s) {                    
                    song.artist = s.artist;
                    song.song_original_fileurl = s.song_original_fileurl;
                    song.artwork = s.artwork;
                    song.title = s.title;
                    song.titleHebrew = s.titleHebrew;
                    song.duration = s.duration;
                    song.recipients = s.recipients;
                    resolve(song);
                  } else {
                    resolve({});
                  }
                })
              }))
            })
            Promise.all(listPromise)
            .then(function(result) {
              result.forEach(function(r) {
                if(r.hasOwnProperty('_id')) {
                  songList.push(r)
                }
              })
              var tmp = {}            
              result.forEach(function (item) {
                if(item.artist) {              
                  var tempKey = item.artist._id;              
                  if (!tmp.hasOwnProperty(tempKey)) {
                    tmp[tempKey] = {}
                    tmp[tempKey].artistId = item.artist._id;
                    tmp[tempKey].artistName = item.artist.name;
                    tmp[tempKey].royaltyCost = item.artist.royaltyCost;
                    tmp[tempKey].stripe_account_id = item.artist.stripe_account_id;
                    tmp[tempKey].paidStreamedCount = (item.paidStreamedCount ? parseInt(item.paidStreamedCount) : 0);
                    tmp[tempKey].freeStreamedCount = (item.freeStreamedCount ? parseInt(item.freeStreamedCount) : 0);
                    tmp[tempKey].isPayout = item.isPayout;
                  } else {
                    tmp[tempKey].paidStreamedCount += (item.paidStreamedCount ? parseInt(item.paidStreamedCount) : 0);
                    tmp[tempKey].freeStreamedCount += (item.freeStreamedCount ? parseInt(item.freeStreamedCount) : 0);
                  }
                }
              });
              var results = Object.keys(tmp).map(function(key){
                return tmp[key];
              });
              f(results)
            })
            .catch(function(err1) {
              f([])
            })
          } else {
            f([])
          }
        })      
      })
    })

     var getRecipientDetail = new Promise(function(f, r) {
      Recipient.findOne({
        _id: recipientId
      }, {name: 1, stripe_account_id:1})
      .then(function(result) {
        f(result)   
      })
     })

    Promise.all([getAdRevenueForMonth, getSubscriptionRevenueForMonth, getArtistsForPayout, getRecipientDetail])
    .then(function(data) {
      var totalPaidStreams = 0;
      var totalFreeStreams = 0;
      var adsRevenue = parseFloat(data[0])
      var subscriptionRevenue = parseFloat(data[1])
      var streamStats = data[2]
      streamStats.forEach(function (item) {
        totalPaidStreams+= item.paidStreamedCount
        totalFreeStreams+= item.freeStreamedCount
      })
      Settings
      .findOne()
      .then(function(setting) {
        if(setting) {
          var adsPayoutPercentage = setting.AdRevenuePayoutPercentage
          var subsPayoutPercentage = setting.SubscriptionPayoutPercentage
          var artistSubsPoolRevenue = parseFloat((subscriptionRevenue * subsPayoutPercentage)/100);
          var artistAdsPoolRevenue = parseFloat((adsRevenue * adsPayoutPercentage)/100);
          var perPaidStreamRate = parseFloat(artistSubsPoolRevenue / totalPaidStreams).toFixed(3)
          var perFreeStreamRate = parseFloat(artistAdsPoolRevenue / totalFreeStreams).toFixed(3)
          streamStats.forEach(function (item) {
            var paidStreamRate = perPaidStreamRate
            var freeStreamRate = perFreeStreamRate
            if(paidStreamRate >= item.royaltyCost) {
              paidStreamRate = item.royaltyCost
            }
            if(freeStreamRate >= item.royaltyCost) {
              freeStreamRate = item.royaltyCost
            }                    
            var artistPaidPayout = parseFloat(paidStreamRate * item.paidStreamedCount)
            var artistFreePayout = parseFloat(freeStreamRate * item.freeStreamedCount)
            var totalPayout = parseFloat(artistPaidPayout + artistFreePayout).toFixed(2)
            item.perPaidStreamRate = parseFloat(perPaidStreamRate)
            item.perFreeStreamRate = parseFloat(perFreeStreamRate)
            item.totalPayout = parseFloat(totalPayout).toFixed(2)
            item.month = _month
            item.year = _year
            item.perPaidStreamRate = parseFloat(paidStreamRate)
            item.perFreeStreamRate = parseFloat(freeStreamRate)
          })
          
          if(streamStats.length > 0) {
            var i = -1;
            var fetch = function() {
              i++;
              if(i < streamStats.length) {
                var artist = streamStats[i]
                ArtistPayoutHistory.findOne({
                  month: _month,
                  year: _year,
                  artist: artist.artistId,
                  type: 'artist'
                })
                .then(function(payoutHistory) {
                  if(payoutHistory) {
                    artist.perPaidStreamRate = payoutHistory.perPaidStreamRate
                    artist.perFreeStreamRate = payoutHistory.perFreeStreamRate
                  }
                  var artistSongList = songList.filter(function(e){ return ( e.artist._id.toString() === artist.artistId.toString()); });
                  var recipientEarning = 0;
                  artistSongList.forEach(function(song) {
                    var songPaidEarning = (song.paidStreamedCount * artist.perPaidStreamRate)
                    var songFreeEarning = (song.freeStreamedCount * artist.perFreeStreamRate)
                    var songTotalEarning = (songPaidEarning + songFreeEarning)
                    if(song.recipients.length > 0) {
                      song.recipients.forEach(function(recipient) {
                        if(recipient.id.id === recipientId) {
                          recipientEarning += (songTotalEarning * recipient.percentage/100)
                          song.recipientPercentage = recipient.percentage
                          song.songTotalEarning = songTotalEarning
                          songsArr.push(song)
                        }                  
                      })
                    }
                  })
                  artist.totalRecipientEarning = recipientEarning
                  fetch()
                })
              } else {
                res.json({
                  success: true,
                  message: "Data found.",
                  isPayout: (history ? true : false),
                  artists: streamStats,
                  songsList: songsArr,
                  recipient: data[3]
                });
              }
            }
            fetch()
          } else {
            res.json({
              success: true,
              message: "Data found.",
              isPayout: (history ? true : false),
              artists: streamStats,
              songsList: songsArr,
              recipient: data[3]
            });
          }
        }
      })
    });
  }
}

//Api to get Artist as per the search term and return limited results
exports.fetchActiveArtists = function(req, res) {
  var term = req.params.term
  const options = []
  var query = {
    deleted: false,
    isActive: true
  }
  if(term !== undefined && term !== "") {
    query.name = {$regex: term, $options: 'i'}
  }
  Artist.find(query, {
    _id: 1,
    name: 1      
  })    
  .limit(10)
  .sort({'name':1})
  .lean()
  .then(function(artists) {
    _.forEach(artists, function(a) {
      options.push({
        value: a._id,
        label: a.name
      })
    })
    res.json({options});
  })
  .catch(function(err) {
    res.json({options});
  })
}

//function to export artist inactive csv file
exports.getInactiveArtistCsv = function(req, res) {
  var fields = ['name','nameHebrew','emailAddress','phoneNumber','royaltyCost',
  'songCount','albumCount','isActive','isPremium','deleted','createdDate','updatedDate']
  Artist.find({isActive: false, deleted: false})
  .then(function(artist) {
    if(artist) {
      var result = json2csv({ data: artist, fields: fields });
      fs.writeFile('inactive_artist.csv', result, function(err) {
        if (err) throw err;
        res.download('inactive_artist.csv')
        setTimeout(function(){ 
          fs.unlinkSync('inactive_artist.csv') 
        }, 500);
      });
    } else {
      res.status(403).send({
        success: false,
        message: "No Such artist"
      });
    }
  })
};

exports.updateArtistGenere = function(req, res) {
  let count = 0;
  Artist.find({
    deleted: false, 
    genres: []
           })
  .then(function(artists) {
    var index = -1;
    var fetchNext = function() {
      index++;
      if(index < artists.length) {
        let artist = artists[index];
        Song.distinct("genres", {
          artist: artist._id
          })
        .then(function(genres) {
          if(genres.length > 0) {
            count++;
            artist.genres = genres;
            artist.save();
          }
          fetchNext();
    })
      } else {
        res.json({
          message: count+ " Records updated successfully"
    })
      }
    }
    fetchNext();
  })
}

exports.updateArtistTags = function(req, res) {
  let count = 0;
  Artist.find({
    deleted: false, 
    tags: []
  })
  .then(function(artists) {
    var index = -1;
    var fetchNext = function() {
      index++;
      if(index < artists.length) {
        let artist = artists[index];
        Song.distinct("tags", {
          artist: artist._id
        })
        .then(function(tags) {
          if(tags.length > 0) {
            count++;
            artist.tags = tags;
            artist.save();
            }
          fetchNext();
          })
      } else {
        res.json({
          message: count+ " Records updated successfully"
    })
      }
    }
    fetchNext();
  })
}

exports.searchArtist = function (req, res) {
  let term = req.params.term
  if(term === 'undefined') {
    term = '';
  }
  Artist.find({
    deleted: false,
    isActive: true,
    name: { $regex: term, $options: 'i' }
  },{
    _id: 1, name: 1, avatar: 1
  })
  .limit(50)
  .then(function(artists) {
    const options = []
    for(var i =0; i < artists.length; i++) {
      options.push({
        value: artists[i]._id,
        label: artists[i].name,
        icon: artists[i].avatar
      })
    }
    res.json({options});
  })
  .catch(function(err) {
    console.log(err)
  })
}

exports.getArtistsListingV2 = function (req, res) {
  var userId = req.headers['userid']
  var term = req.query.term ? req.query.term : ""
  if(term != "") {
    term = term.toLowerCase()
  }
  if (userId) {
    User.findOne({
      _id: userId
    })
    .then(function(user) {
      if (user) {
        let sQuery = {
          deleted: false,
          isActive: true
        }
        if(user.isVocalOnly !== "") {
          sQuery.genres = Mongoose.Types.ObjectId(user.isVocalOnly)
        }
        Song.distinct("artist", sQuery)
        .then(function(artistIds) {
          var getDiscoverArtists = new Promise(function(f, r) {          
          let query = {
            deleted: false,
            isActive: true,
            $or: [{
              songCount: {
                $gt: 0
              }
            }, {
              albumCount: {
                $gt: 0
              }
            }]
            } 
          if(user.isVocalOnly !== "") {
              query._id = { $in: artistIds }  
            }                  
          Artist.find(query, {
            _id: 1, name: 1, nameHebrew: 1, isPremium: 1, shareUrl: 1, avatar: 1, songCount: 1, albumCount: 1 
          })
          .sort({createdDate: -1, albumCount: -1, songCount: -1})
          .limit(20)
          .then(function(artists) {
            f(artists)
          })
          .catch(function(err) {
            f([])
          })            
        })

        var getIndexedArtistListing = new Promise(function(f, r) {
          let charArray = ["A","B","C","D","E","F","G","H","I","J","K","L","M","N","O","P","Q","R","S","T","U","V","W","X","Y","Z"]
          let promiseArray = []
          _.forEach(charArray, function(char) {
            promiseArray.push(new Promise(function(resolve, reject) {
              var query = {
                  name: {
                    $regex: '^'+ char, $options: 'i'
                  },
                  deleted: false,
                  isActive: true,
                  $or: [{
                    songCount: {
                      $gt: 0
                    }
                  }, {
                    albumCount: {
                      $gt: 0
                    }
                  }]
              }
              if(user.isVocalOnly !== "") {
                  query._id = { $in: artistIds }
              }
              Promise.all([
                Artist.count(query),
                Artist.find(query, {
                  _id: 1, name: 1, nameHebrew: 1, isPremium: 1, shareUrl: 1, avatar: 1, songCount: 1, albumCount: 1
                })
                .sort({name: 1})
                .limit(20)
              ])
              .spread((artistCount, artistList) => {
                let item = {}
                item.char = char
                item.count = artistCount                
                let artistPromiseArray = []
                _.forEach(artistList, function(a) {
                  a = a.toJSON()
                  artistPromiseArray.push(new Promise(function(resolve, reject) {
                    var songQuery = {
                      artist: a._id,
                      isActive: true,
                      deleted: false
                    }
                    if(user.isVocalOnly !== "") {
                      songQuery.genres = Mongoose.Types.ObjectId(user.isVocalOnly)
                    }
                    Song.distinct("_id", songQuery)
                    .then(function(songIds) {
                      a.songs = songIds
                      resolve(a);
                    })
                  }))
                })
                Promise.all(artistPromiseArray)
                .then(function(finalResult) {
                  item.artist = finalResult
                  resolve(item)
                })                
              })
            }))            
          })
          Promise.all(promiseArray)
          .then(function(data) {
            f(data)
          })
          .catch(function(err1) {
            f([])
          })        
        })

        var getIndexedArtistListingWithSearch = new Promise(function(f, r) {
          let charArray = ["A","B","C","D","E","F","G","H","I","J","K","L","M","N","O","P","Q","R","S","T","U","V","W","X","Y","Z"]
          let arrArtists = []
          var query = {
                  name: {
              $regex: term, $options: 'i'
                  },
                  deleted: false,
                  isActive: true,
                  $or: [{
                    songCount: {
                      $gt: 0
                    }
                  }, {
                    albumCount: {
                      $gt: 0
                    }
                  }]
          }
          if(user.isVocalOnly !== "") {
              query._id = { $in: artistIds }  
          }
          Artist.find(query, {
                  _id: 1, name: 1, nameHebrew: 1, isPremium: 1, shareUrl: 1, avatar: 1, songCount: 1, albumCount: 1
                })
                .sort({name: 1})
          .then((artistList) => { 
            let promiseArray = [];           
            _.forEach(charArray, function(char) {
              promiseArray.push(new Promise(function(resolve, reject) {
                var re =  exports.getCharRegEx(char)
                let item = {}
                item.char = char
                let artists = artistList.filter(a => a.name.match(re));
                item.count = artists.length 
                if(artists.length > 20) {
                  artists = artists.slice(0, 20)
                }
                let artistPromiseArray = []
                _.forEach(artists, function(a) {
                  a = a.toJSON()
                  artistPromiseArray.push(new Promise(function(resolve, reject) {
                    var songQuery = {
                      artist: a._id,
                      isActive: true,
                      deleted: false
                    }
                    if(user.isVocalOnly !== "") {
                      songQuery.genres = Mongoose.Types.ObjectId(user.isVocalOnly)
                    }
                    Song.distinct("_id", songQuery)
                    .then(function(songIds) {
                      a.songs = songIds
                      resolve(a);
                    })
                  }))
                })
                Promise.all(artistPromiseArray)
                .then(function(finalResult) {
                  item.artist = finalResult
                  resolve(item);
          })
              }))
            })  
          Promise.all(promiseArray)
          .then(function(data) {
            f(data)
          })
          .catch(function(err1) {
            f([])
          })        
          })                
        })

        let mainPromiseArray = []
        if(term !== "") {
          mainPromiseArray = [getDiscoverArtists, getIndexedArtistListingWithSearch]
        } else {
          mainPromiseArray = [getDiscoverArtists, getIndexedArtistListing]
        }

        Promise.all(mainPromiseArray)
        .then(function(results) {
          res.json({
            success: true,
            message: "Artist listing.",
            discover: results[0],
            artists: results[1]
          });
        })
        .catch(function(err1) {
          res.json({
            success: true,
            message: "Artist listing.",
            discover: [],
            artists: []
          });
        })
        })
      } else {
        res.json({
          success: false,
          message: "Invalid user."
        });
      }
    })
  } else {
    res.json({
      success: false,
      message: "Invalid user."
    });
  }
}

exports.getCharRegEx = function(char) {
  let regex;
  switch (char) {
    case "A": 
      regex = /^A/
      break;
    case "B": 
      regex = /^B/
      break;
    case "C": 
      regex = /^C/
      break;
    case "D": 
      regex = /^D/
      break;
    case "E": 
      regex = /^E/
      break;
    case "F": 
      regex = /^F/
      break;
    case "G": 
      regex = /^G/
      break;
    case "H": 
      regex = /^H/
      break;
    case "I": 
      regex = /^I/
      break;
    case "J": 
      regex = /^J/
      break;
    case "K": 
      regex = /^K/
      break;
    case "L": 
      regex = /^L/
      break;
    case "M": 
      regex = /^M/
      break;
    case "N": 
      regex = /^N/
      break;
    case "O": 
      regex = /^O/
      break;
    case "P": 
      regex = /^P/
      break;
    case "Q": 
      regex = /^Q/
      break;
    case "R": 
      regex = /^R/
      break;
    case "S": 
      regex = /^S/
      break;
    case "T": 
      regex = /^T/
      break;
    case "U": 
      regex = /^U/
      break;
    case "V": 
      regex = /^V/
      break;
    case "W": 
      regex = /^W/
      break;
    case "X": 
      regex = /^X/
      break;
    case "Y": 
      regex = /^Y/
      break;
    case "Z": 
      regex = /^Z/
      break;
     default: 
      regex = ""
      break;
  }
  return regex;
}

exports.getArtistsListingStartWithChar = function (req, res) {
  var userId = req.headers['userid'];
  if (userId) {
    User.findOne({
      _id: userId
    })
    .then(function(user) {
      if (user) {
        let sQuery = {
          deleted: false,
          isActive: true
        }
        if(user.isVocalOnly !== "") {
          sQuery.genres = Mongoose.Types.ObjectId(user.isVocalOnly)
        }
        Song.distinct("artist", sQuery)
        .then(function(artistIds) {
  let char = req.query.char ? req.query.char : '';
  let page = req.query["page"] ? req.query["page"] : 1;
  let term = req.query.term ? req.query.term : "";
  let limit = Config.config().allApiLimit;
  let skip = 0;
  let query = {}
  if(term != "") {
    term = term.toLowerCase()
  }
  skip = page - 1
  skip = skip * limit
  if(term != '') {
    query = {
      name: {
        $regex: term, $options: 'i'
      },
      deleted: false,
      isActive: true,
      $or: [{
        songCount: {
          $gt: 0
        }
      }, {
        albumCount: {
          $gt: 0
        }
      }]
    }
  } else {
    query = {
      name: {
        $regex: '^'+ char, $options: 'i'
      },
      deleted: false,
      isActive: true,
      $or: [{
        songCount: {
          $gt: 0
        }
    }, {
        albumCount: {
          $gt: 0
        }
      }]
    }
  }
        if(user.isVocalOnly !== "") {
            query._id = { $in: artistIds }
        }
  Artist.find(query, {
      _id: 1, name: 1, nameHebrew: 1, isPremium: 1, shareUrl: 1, avatar: 1, songCount: 1, albumCount: 1 
    })
    .sort({name: 1})
    .lean()
  .then(function(artists) {    
    let re = exports.getCharRegEx(char);
    artists = artists.filter(a => a.name.match(re));
    artists = artists.slice(skip, skip + limit);
      let artistPromiseArray = []
      _.forEach(artists, function(a) {
        artistPromiseArray.push(new Promise(function(resolve, reject) {
              var songQuery = {
            artist: a._id,
                isActive: true,
                deleted: false
              }
              if(user.isVocalOnly !== "") {
                songQuery.genres = Mongoose.Types.ObjectId(user.isVocalOnly)
              }
              Song.distinct("_id", songQuery)
          .then(function(songIds) {
            a.songs = songIds
            resolve(a);
          })
        }))
      })
      Promise.all(artistPromiseArray)
      .then(function(finalResult) {
        res.json({
          success: true,
          message: "Artist listing.",
          artists: finalResult
        });
      })
      .catch(function(err1) {
        res.json({
          success: true,
          message: "Artist listing.",
          artists: []
        });
      })
    })
        })
      }
    })
  } else {
    res.json({
      success: false,
      message: "Invalid user."
    });
  }
}

//Api to get detail of an Artist 
exports.fetchArtistDetailNew = function(req, res) {
  var id = req.params.id;
  var yesterday = moment().add(-24, 'h')
  var sDate = yesterday 
  var eDate = moment()
  var getArtistDetail = new Promise(function(f, r) {
    Artist.findOne({
      _id: id,
      deleted: false,
      isActive: true
    })
    .populate('genres','_id title titleHebrew icon', { isActive: true, deleted: false })
    .populate('relatedArtists', 'name nameHebrew avatar songCount albumCount shareUrl isPremium')
    .then(function(artist) {
      f(artist)
    })
  })
  // Function to get Count of New Released Album of an Artist
  var getArtistNewReleasedAlbumCount = new Promise(function(f, r) {
    Album.count({
      artist: id,
      deleted: false,
      isActive: true,
      isNewRelease: true
    })
    .then(function(newReleaseAlbumCount) {
      f(newReleaseAlbumCount)
    })
  })
  // Function to get New Released Albums of an Artist
  var getArtistNewReleasedAlbums = new Promise(function(f, r) {
    Album.find({
      artist: id,
      deleted: false,
      isActive: true,
      isNewRelease: true
    })
    .populate('artist', 'name nameHebrew avatar songCount albumCount shareUrl isPremium')
    .populate('songs', 'title titleHebrew song_original_fileurl artwork duration duration_seconds shareUrl isPremium')
    .sort({createdDate: -1, updatedDate: -1})
    .limit(10)
    .then(function(NewReleasedAlbums) {
      f(NewReleasedAlbums)
    })
  })
  // Function to get Albums Count of an Artist
  var getArtistAlbumsCount = new Promise(function(f, r) {
    Album.count({
      artist: id,
      deleted: false,
      isActive: true      
    })
    .then(function(albumsCount) {
      f(albumsCount)
    })
  })
  // Function to get Albums listing of an Artist
  var getArtistAlbums = new Promise(function(f, r) {
    Album.find({
      artist: id,
      deleted: false,
      isActive: true      
    }, {
      _id:1,
      title: 1,
      titleHebrew:1,
      artwork:1,
      shareUrl:1,
      isPremium:1
    })
    .sort({createdDate: -1, updatedDate: -1})    
    .then(function(albums) {
      var albumsPromise = [];
      albums.forEach(function(a) {
        a = a.toJSON();
        albumsPromise.push(new Promise(function(resolve, reject) {
          Song.aggregate([
            {$project: {albums: 1, streamedCount: 1}},
            {$match: {albums: {$in: [a._id]}}},
            {$group:
              {_id: '0',
                totalStreamedCount:{$sum:'$streamedCount'}
              }
            }
          ])
          .then(function(songStremedCount) {
            a.songStremedCount = (songStremedCount.length > 0 ? songStremedCount[0].totalStreamedCount : 0)
            resolve(a);
          })
        }))
      })
      Promise.all(albumsPromise)
      .then(function(finalResult) {
        finalResult.sort(function(a, b) {
          return b.songStremedCount - a.songStremedCount
        })
        finalResult = finalResult.splice(0, 4);
        f(finalResult)
      })
      .catch(function(err1) {
        albums = albums.splice(0, 4);
      f(albums)
    })
  })
  })

  // Function to get Popular Songs Count of an Artist
  var getArtistPopularSongsCount = new Promise(function(f, r) {
    var yesterday = moment().add(-24, 'h')
    var sDate = new Date(yesterday) 
    var eDate = new Date(moment())
    SongStats.find({
      updatedDate: {
        $gte: sDate,
        $lte: eDate
      },
      streamedCount: {
        $gt: 0
      }      
    })
    .sort({streamedCount: -1})
    .then(function(songIds) {
      if(songIds.length > 0) {
        var sids = [];
        songIds.forEach(function(s) {
          if(sids.indexOf(s.songId) == -1) {
            sids.push(s.songId)
          }
        })
        Song.count({
          _id: {
            $in: sids
          },
          artist: id,
          deleted: false,
          isActive: true
        })
        .then(function(popularSongsCount) {
          f(popularSongsCount)
        })
      } else {
        f(0)
      }
    })
  })
  // Function to get Popular songs listing of an Artist
  var getArtistPopularSongs = new Promise(function(f, r) {
    var yesterday = moment().add(-24, 'h')
    var sDate = new Date(yesterday) 
    var eDate = new Date(moment())
    SongStats.find({
      updatedDate: {
        $gte: sDate,
        $lte: eDate
      },
      streamedCount: {
        $gt: 0
      }      
    })
    .sort({streamedCount: -1})
    .then(function(songIds) {
      if(songIds.length > 0) {
        var sids = [];
        songIds.forEach(function(s) {
          if(sids.indexOf(s.songId) == -1) {
            sids.push(s.songId)
          }
        })
        Song.find({
          _id: {
            $in: sids
          },
          artist: id,
          deleted: false,
          isActive: true
        })
        .populate('artist', 'name nameHebrew avatar songCount albumCount shareUrl isPremium')
        .populate('ft_artist', 'name nameHebrew avatar songCount albumCount shareUrl isPremium')
        .populate('tags', 'tagName')
        .populate('genres', 'title titleHebrew icon')
        .populate('albums', 'title titleHebrew artwork songCount totalDuration shareUrl isPremium')
        .limit(5)
        .then(function(popularSongs) {
          f(popularSongs)
        })
      } else {
        f([])
      }
    })
  })
  // Function to get popular playlist count of an Artist
  var getArtistPopularPlaylistCount = new Promise(function(f, r) {
    var yesterday = moment().add(-24, 'h')
    var sDate = new Date(yesterday) 
    var eDate = new Date(moment())
    User.distinct("_id", {
      role: { $in: ["admin", "superadmin"] }
    })
    .then(function(users) {
      SongStats.find({
        updatedDate: {
          $gte: sDate,
          $lte: eDate
        },
        streamedCount: {
          $gt: 0
        }      
      })
      .then(function(songIds) {
        if(songIds.length > 0) {
          var sids = [];
          songIds.forEach(function(s) {
            if(sids.indexOf(s.songId) == -1) {
              sids.push(s.songId)
            }
          })
          Song.distinct("_id", {
            _id: {
              $in: sids
            },
            artist: id,
            deleted: false,
            isActive: true
          })
          .then(function(sIds) {
            Playlist.count({
              songs: {
                $in: sIds
              },
              createdBy: {
                $in: users
              },
              deleted: false,
              isActive: true
            })
            .then(function(popularPlaylistCount) {
              f(popularPlaylistCount)
            })
          })
        } else {
          f(0)
        }
      })
    })
  })
  // Function to get popular playlist of an Artist
  var getArtistPopularPlaylist = new Promise(function(f, r) {
    var yesterday = moment().add(-24, 'h')
    var sDate = new Date(yesterday) 
    var eDate = new Date(moment())
    User.distinct("_id", {
      role: { $in: ["admin", "superadmin"] }
    })
    .then(function(users) {
      SongStats.find({
        updatedDate: {
          $gte: sDate,
          $lte: eDate
        },
        streamedCount: {
          $gt: 0
        }      
      })
      .then(function(songIds) {
        if(songIds.length > 0) {
          var sids = [];
          songIds.forEach(function(s) {
            if(sids.indexOf(s.songId) == -1) {
              sids.push(s.songId)
            }
          })
          Song.distinct("_id", {
            _id: {
              $in: sids
            },
            artist: id,
            deleted: false,
            isActive: true
          })
          .then(function(sIds) {
            Playlist.find({
              songs: {
                $in: sIds
              },
              createdBy: {
                $in: users
              },
              deleted: false,
              isActive: true
            })
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
                  _id: 1, title: 1, titleHebrew: 1, artwork:1, songCount:1, totalDuration:1, shareUrl:1, isPremium:1
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
            .limit(4)
            .then(function(popularPlaylist) {
              f(popularPlaylist)
            })
          })
        } else {
          f([])
        }
      })
    })
  })

  // Function to get Artist songs list
  var getArtistSongs = new Promise(function(f, r) {      
    Song.find({
      artist: id,
      deleted: false,
      isActive: true
    })
    .populate('artist', 'name nameHebrew avatar songCount albumCount shareUrl isPremium')
    .populate('ft_artist', 'name nameHebrew avatar songCount albumCount shareUrl isPremium')
    .populate('tags', 'tagName')
    .populate('genres', 'title titleHebrew icon')
    .populate('albums', 'title titleHebrew artwork songCount totalDuration shareUrl isPremium')
    .then(function(songIds) {
      f(songIds)
    })
  })

  // Function to get Artist songs unique genres
  var getArtistGenres = new Promise(function(f, r) {      
    Song.distinct("genres", {
      artist: id,
      deleted: false,
      isActive: true
    })
    .then(function(genreIds) {
      if(genreIds.length > 0) {
        var gids = [];
        genreIds.forEach(function(g) {
          if(gids.indexOf(g) == -1) {
            gids.push(g)
          }
        });
        Genre.find({
          _id: {
            $in : gids
          },
          deleted: false,
          isActive: true
        }, {
          _id: 1,
          title: 1,
          titleHebrew: 1,
          icon: 1
        })
        .then(function(genres) {
          f(genres)
        })
      } else {
        f([]);
      }      
    })
  })

  // Execute all the promise functions above
  Promise.all([getArtistDetail, getArtistNewReleasedAlbums, getArtistAlbums, 
    getArtistPopularSongs, getArtistPopularPlaylist, getArtistNewReleasedAlbumCount,
    getArtistAlbumsCount, getArtistPopularSongsCount, getArtistPopularPlaylistCount, getArtistSongs, getArtistGenres])
  .then(function(result) {
    var _artist = null
    if(result[0]) {
      _artist = result[0];
      _artist = _artist.toJSON();
      _artist.genres = result[10];
    }
    res.json({
      success: true,
      message: "Artist detail.",
      artist: _artist,
      NewReleasedAlbums: result[1],
      albums: result[2],
      popularSongs: result[3],
      popularPlaylist: result[4],
      NewReleasedAlbumsCount: result[5],
      albumsCount: result[6],
      popularSongsCount: result[7],
      popularPlaylistCount: result[8],
      artistSongs: result[9]
    });
  })
};

exports.sendInvitation = function(req, res) {
  const { emailAddress, password, id } = req.body
  return Promise.all([
    User.findOne({email: { $regex: emailAddress , $options: 'i' }}),
    Artist.findOne({emailAddress: { $regex: emailAddress , $options: 'i' }, _id: {$ne: id}}),
    Recipient.findOne({email: { $regex: emailAddress , $options: 'i' }})
  ])
  .spread((user, artist, recipient) => {
    if(!user && !artist && !recipient) {
      Artist.findOneAndUpdate({
        _id: id 
      }, { 
        $set: req.body 
      })
      .then((artist) => {
      req.body.name = artist.name
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