var Playlist = require('../models/playlists');
var User = require('../models/users');
var Config = require('../config/config');
var Songs = require('../models/songs');
var AWS = require('aws-sdk')
var Promise = require('bluebird');
var Settings = require('../models/settings');
var Utils = require('../service/utils');
var shortid = require('shortid');
var mongoose = require('mongoose');
var Genre = require('../models/genres');

//API to create a Playlist
exports.createPlaylist = function (req, res) {
  var info = req.body;
  var originalBlob = info.files;  
  var aws = Config.config().aws;
  if (originalBlob && originalBlob !=='' && typeof(originalBlob !== "number" && originalBlob !== null)) {
    var regex       = /^data:.+\/(.+);base64,(.*)$/;
    var matches     = originalBlob.match(regex);
    var base64Data  = matches && matches.length && matches[2] ? matches[2] : '';
    var buf         = new Buffer(base64Data, 'base64');
    var newName     = (new Date()).valueOf();
    var newfilename = newName +'.png';   
    // upload Playlist Image on amazon S3
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
      Key: 'playlist/'+newfilename,
      ACL: 'public-read'
    }, function(err, data1) {
      if(data1) {
        info.avatar = data1.Location;
        addPlaylist(info)
      } else {
        addPlaylist(info);
      }
    })
  } else {
    addPlaylist(info);
  }

  function addPlaylist(info) {
    var _shortid = shortid.generate()
    info.shortid = _shortid
    info.shareUrl = Config.config().siteUrl+"/playlists/"+_shortid+".html"
    info.createdDate = new Date();
    info.updatedDate = new Date();
    var playlistObj = new Playlist(info);
    playlistObj.save().then(function(playlist) {
    if(playlist) {
      Utils.generateSharePage('playlists', playlist.title, playlist.avatar, playlist._id, playlist.shortid)
      res.json({
        success: true,
        message: "Playlist created.",
        playlist: playlist
      });
    }
  })
  .catch(function(err) {
    res.status(403).send({
      success: false,
      message: "Error in processing the request."
    });
  })
  }
}

//Api to update a Playlist record
exports.updatePlaylist = function(req, res) {
  var playlistId = req.params.id
  var info = req.body;   
  var originalBlob = info.files;  
  var aws = Config.config().aws;
  if ( originalBlob && originalBlob !=='' && typeof(originalBlob !== "number" && originalBlob !== null) && originalBlob.search('https://shiralidevelopment.s3-us-west-1.amazonaws.com') === -1) {
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
      Key: 'playlist/'+newfilename,
      ACL: 'public-read'
    }, function(err, data1) {
      if(data1) {
        info.avatar = data1.Location
      }
      update(info)
      })
    } else {
    info.avatar = originalBlob
    update(info)
    }

  function update(info){
    var _shortid = shortid.generate()
    var objInfo = {
      title: info.title,
      description: info.description,  
      title_hebrew: info.title_hebrew,
      description_hebrew: info.description_hebrew,
      avatar: info.avatar,
      updatedDate: new Date()
    };
    if(info.shortid == undefined || info.shortid === "") {
      objInfo.shortid = _shortid
    }
    if(info.shareUrl == undefined || info.shareUrl === "") {
      objInfo.shareUrl = Config.config().siteUrl+"/playlists/"+_shortid+".html"
    }
    Playlist.findOneAndUpdate({
      _id: info.id
    }, {
      $set: objInfo
    },{ 
      new: true 
    })
    .then((playlist) => {
      if (!playlist) {
        return res.json({
          success: false,
          message: "No playlist found."
  });
      } else {
        Utils.generateSharePage('playlists', playlist.title, playlist.avatar, playlist._id, playlist.shortid)
      return res.json({
        success: true,
        message: "Changes saved successfully.",
        playlist: playlist
      });
      }
    })
};
}
//03-12-2020
exports.deletePlaylist = function(req, res) {
  var playlistId = req.params.id
  Playlist.update({
    _id: playlistId
}, {
    $set: {
        deleted: true
    }
}, function(err, doc) {
    if (err) {
        res.status(403).send({
            success: false,
            message: "Error in processing the request."
        });
    } else {
      Genre.update({
        playlists:{$in:[mongoose.Types.ObjectId(`${playlistId}`)]}
      },{
          $pull: { playlists: playlistId }
      },function(err,doc){
          if(err){
              res.status(403).send({
                  success: false,
                  message: "Error in processing the request2."
              });
          }else{

              return res.json({
                success: true,
                message: "Playlist Deleted."
            });
          }
      })
        
    }
});
  // Genre.exists({playlists:{$in:[mongoose.Types.ObjectId(`${req.params.id}`)]}},function(err,doc){
  //     if(err){
  //         res.status(403).send({
  //             success: false,
  //             message: "Error in processing the request."
  //         });
  //     }else{
  //         if(doc){
  //             Genre.update({
  //                 playlists:{$in:[mongoose.Types.ObjectId(`${req.params.id}`)]}
  //             },{
  //                 $pull: { playlists: playlistId }
  //             },function(err,doc){
  //                 if(err){
  //                     res.status(403).send({
  //                         success: false,
  //                         message: "Error in processing the request2."
  //                     });
  //                 }else{
  //                     res.status(200).send({
  //                         success: true,
  //                         message:'ok removed'
  //                     });
  //                 }
  //             })
  //         }else{
  //             // res.status(403).send({
  //             //     success: false,
  //             //     message: "Playlist not found."
  //             // });
              
  //         }
          
  //     }
  // })
  
  // Playlist.update({
  //     _id: req.params.id
  // }, {
  //     $set: {
  //         deleted: true
  //     }
  // }, function(err, doc) {
  //     if (err) {
  //         res.status(403).send({
  //             success: false,
  //             message: "Error in processing the request."
  //         });
  //     } else {
  //         return res.json({
  //             success: true,
  //             message: "Playlist Deleted."
  //         });
  //     }
  // });
};
//Api to delete a Playlist
// exports.deletePlaylistBackup= function(req, res) {
//   Playlist.update({
//     _id: req.params.id
//   }, {
//     $set: {
//       deleted: true
//     }
//   }, function (err, doc) {
//     if(err){
//       res.status(403).send({
//         success: false,
//         message: "Error in processing the request."
//       });
//     }
//     else{
//       return res.json({
//         success: true,
//         message: "Playlist Deleted."
//       });
//     }
//   });
// };
//03-12-2020
exports.patchPlaylist= function(req, res) {
  var playlistID = req.params.id
  var songId=req.body.songs;
  delete req.body.id
  Playlist.findOneAndUpdate({
          _id: playlistID
      }, {
          $set: req.body
      }, {
          new: true
      })
      .then((playlist) => {
          if (!playlist) {
              res.json({
                  success: false,
                  message: "No playlist found."
              });
          } else {
              Songs.find({_id:{$in:songId}}).then(data=>{
                 
                  if(data.length>0){
                    for(var i=0;i<data.length;i++){
                        Genre.findOneAndUpdate({_id:data[i].genres[0],deleted:false,playlists:{$nin:[playlist._id]}},{
                          $push: { playlists: playlist._id }
                      }).then(function(data){
                          if(!data){
                              // res.status(403).send({
                              //     success: false,
                              //     message: "Error in processing the request."
                              // });
                          }else{
                              // res.json({
                              //     success: true,
                              //     message: "playlist updated successfully.",
                              //     playlist: playlist
                              // });
                          }
                      }).catch((error)=>{
                        // res.json({
                        //   success: False,
                        //   message: "Error in processing the request"
                        // });
                      })
                    }
                    res.json({
                      success: true,
                      message: "playlist updated successfully.",
                      playlist: playlist
                  });
                  
               }else{
                  res.json({
                    success: true,
                    message: "playlist updated successfully.",
                    playlist: playlist
                });
               }
              }).catch((error)=>{
                  res.json({
                    success: False,
                    message: "Error in processing the request"
                  });
              })
              // res.json({
              //     success: true,
              //     message: "playlist updated successfully.",
              //     playlist: playlist
              // });
          }
      }).catch((error)=>{
        res.json({
          success: False,
          message: "Error in processing the request"
        });
      })
};
//API to Update a playlist
exports.patchPlaylistBackup= function(req, res) {
  var playlistID = req.params.id
  delete req.body.id
  Playlist.findOneAndUpdate({
    _id: playlistID
  }, { 
    $set: req.body
  },{ 
    new: true 
  })
  .then((playlist) => {
    if (!playlist) {
      res.json({
        success: false,
        message: "No playlist found."
      });
    } else {
      res.json({
        success: true,
        message: "playlist updated successfully.",
        playlist: playlist
      });
    }
  })
};

//Api to get Playlist listing
exports.fetchPlaylist = function(req, res) {
  User.distinct("_id", {
    role: { $in: ["admin", "superadmin"] }
  })
  .then(function(users) {
    // Filter data for Pagination
  Settings.findOne({},{
    'fieldsPerPage':1
  })
  .then(function(fields) {
    var page = req.query.page ? req.query.page : 'all'
     if(page !== "all") {
      let limit = fields.fieldsPerPage;
      skip = page - 1
      skip = skip * limit
      Playlist.count({
          deleted: false,
          createdBy: {
            $in: users
          }
      })
      .then(function(count) {
      let playlistCount = count
           Playlist.find({ 
            deleted: false,
            createdBy: {
              $in: users
            }
          })
      .skip(skip)
      .limit(limit)
      .lean()
          .populate({  
             path:'songs',
             match: {isActive: true, deleted: false },
             populate:[{  
                   path:'artist',
                   model:'Artists',
                   select:{  
                      name: 1,
                      nameHebrew: 1,
                      avatar: 1,
                      songCount: 1,
                      albumCount: 1,
                      shareUrl: 1,
                      isPremium: 1
                   }
            }, {  
                   path:'albums',
                   model:'Albums',
                   select:{  
                      title: 1,
                      titleHebrew: 1,
                      artwork: 1,
                      totalDuration: 1,
                      shareUrl: 1,
                      isPremium: 1,
                      songCount: 1
                   }
            }]
          })
      .sort({createdDate: -1})
      .then(function(playlist) {
        var playlistPromise = [];
        if(playlist.length > 0) {
          playlist.forEach(function(p) {
            playlistPromise.push(new Promise(function(resolve, reject) {
              User.count({playlist: p._id}).then(function(userCount) {
                p.selectedPlaylist = userCount;
                resolve(p);
              })
            }))
          })
          Promise.all(playlistPromise)
          .then(function(result) {
            res.json({
              success: true,
              message: "Playlist found.",
              count: playlistCount,
              limit: limit,
              playlist: result
            });
          })
          .catch(function(err1) {
            res.json({
              success: true,
              message: "No Playlist found.",
              playlist: []
            });
          })
            } else {
          res.json({
            success: true,
            message: "No Playlist found.",
            playlist: []
          });
        }
    })
    })
      } else {
  Playlist.find({ deleted: false })
        .populate({  
            path:'songs',
            match: {isActive: true, deleted: false },
            populate:[  
              {  
                 path:'artist',
                 model:'Artists',
                 select:{  
                    name: 1,
                    nameHebrew: 1,
                    avatar: 1,
                    songCount: 1,
                    albumCount: 1,
                    shareUrl: 1,
                    isPremium: 1
                 }
          }, {  
                 path:'albums',
                 model:'Albums',
                 select:{  
                    title: 1,
                    titleHebrew: 1,
                    artwork: 1,
                    totalDuration: 1,
                    shareUrl: 1,
                    isPremium: 1,
                    songCount: 1
                 }
          }]
        })
  .sort({createdDate: -1})
  .then(function(playlist) {
    var playlistPromise = [];
    if(playlist.length > 0) {
      playlist.forEach(function(p) {
        p = p.toJSON();
        playlistPromise.push(new Promise(function(resolve, reject) {
          User.count({playlist: p._id}).then(function(userCount) {
            p.selectedPlaylist = userCount;
            resolve(p);
          })
        }))
      })
      Promise.all(playlistPromise)
      .then(function(result) {
    res.json({
      success: true,
      message: "Playlist found.",
          playlist: result
        });
      })
      .catch(function(err1) {
        res.json({
          success: true,
          message: "No Playlist found.",
          playlist: []
    });
  })
    } else {
      res.json({
        success: true,
        message: "No Playlist found.",
        playlist: []
      });
    }
  })
      }
  })
  })
};

//03-12-2020
exports.getPlayLists = function(req, res) {
  var userId = req.headers['userid']
  var genre = req.query['genre'] ? req.query['genre'] : 'all'
  console.log(genre);
  if (userId) {
      User.findOne({
              _id: userId
          })
          .then(function(u) {
              if (u) {
                  User.distinct("_id", {
                          role: { $in: ["admin", "superadmin"] }
                      })
                      .then(function(users) {
                          if (users && users.length > 0) {
                              getData(users, u)
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
                              message: "Error in fetching home data."
                          });
                      })
              } else {
                  res.json({
                      success: false,
                      message: "No user found"
                  });
              }
          })
          // Function to get Data 
      function getData(users, u) {
          var query = {
              createdBy: {
                  $in: users
              },
              deleted: false,
              isActive: true
          }
          var songQuery = {
              deleted: false,
              isActive: true
          }
          if (genre != 'all' && genre != '' && genre != 'undefined') {
              songQuery.genres = mongoose.Types.ObjectId(genre)
          }
          if (u.isVocalOnly !== "") {
              songQuery.genres = mongoose.Types.ObjectId(u.isVocalOnly)
          }
          Songs.distinct("_id", songQuery)
              .then(function(songIds) {
                  query = {
                      createdBy: {
                          $in: users
                      },
                      songs: {
                          $in: songIds
                      },
                      deleted: false,
                      isActive: true
                  }
                  getPlaylist(query, u);
              })
      }
      // Function to get Playlist
      function getPlaylist(query, u) {
          var songMatch = {
              isActive: true,
              deleted: false
          }
          if (u.isVocalOnly !== "") {
              songMatch.genres = mongoose.Types.ObjectId(u.isVocalOnly);
          } else if (genre != 'all' && genre != '' && genre != 'undefined') {
              songMatch.genres = mongoose.Types.ObjectId(genre);
          }
          if(genre=='all'){
              Playlist.find(query, {
                  _id: 1,
                  title: 1,
                  title_hebrew: 1,
                  icon: 1,
                  songs: 1,
                  description: 1,
                  description_hebrew: 1,
                  avatar: 1,
                  shareUrl: 1,
                  displayOrder: 1,
                  updatedDate: 1,
                  createdBy: 1
              })
              .populate({
                  path: 'songs',
                  model: 'Songs',
                  match: songMatch,
                  populate: [{
                          path: 'artist',
                          model: 'Artists',
                          select: {
                              _id: 1,
                              name: 1,
                              nameHebrew: 1,
                              avatar: 1,
                              songCount: 1,
                              albumCount: 1,
                              shareUrl: 1,
                              isPremium: 1
                          }
                      },
                      {
                          path: 'ft_artist',
                          model: 'Artists',
                          select: {
                              _id: 1,
                              name: 1,
                              nameHebrew: 1,
                              avatar: 1,
                              songCount: 1,
                              albumCount: 1,
                              shareUrl: 1,
                              isPremium: 1
                          }
                      },
                      {
                          path: 'albums',
                          model: 'Albums',
                          select: {
                              _id: 1,
                              title: 1,
                              titleHebrew: 1,
                              artwork: 1,
                              songCount: 1,
                              totalDuration: 1,
                              shareUrl: 1,
                              isPremium: 1
                          }
                      },
                      {
                          path: 'tags',
                          model: 'Tags'
                      },
                      {
                          path: 'genres',
                          model: 'Genres'
                      }
                  ]
              })
              .sort({ updatedDate: -1 })
              .then(function(playlists) {
                  if (playlists && playlists.length > 0) {
                      playlists.forEach(function(p) {
                          p.title = Utils.titleCase(p.title)
                      })
                  }
                  if (u.isVocalOnly !== "" || genre === '5a3e08db768d68577815c651') {
                      playlists = playlists.filter(p => p.songs.length > 5);
                  }
                  res.json({
                      success: true,
                      message: "Playlist Listing",
                      playlists: playlists
                  });
              })
              .catch(function(err) {
                  res.json({
                      success: false,
                      message: "Error in fetching the playlist"
                  });
              })
          }else{
              Genre.findOne({_id:genre}).then((data)=>{
                  //console.log(data)
                  var query1=query
                  // query1={query,_id:{
                  //     $in:data.playlists
                  // }}
                  if(data.playlists.length>0){
                      query1._id={$in:data.playlists}
                  //console.log(query1);

                      Playlist.find(query1, {
                          _id: 1,
                          title: 1,
                          title_hebrew: 1,
                          icon: 1,
                          songs: 1,
                          description: 1,
                          description_hebrew: 1,
                          avatar: 1,
                          shareUrl: 1,
                          displayOrder: 1,
                          updatedDate: 1,
                          createdBy: 1
                      })
                      .populate({
                          path: 'songs',
                          model: 'Songs',
                          match: songMatch,
                          populate: [{
                                  path: 'artist',
                                  model: 'Artists',
                                  select: {
                                      _id: 1,
                                      name: 1,
                                      nameHebrew: 1,
                                      avatar: 1,
                                      songCount: 1,
                                      albumCount: 1,
                                      shareUrl: 1,
                                      isPremium: 1
                                  }
                              },
                              {
                                  path: 'ft_artist',
                                  model: 'Artists',
                                  select: {
                                      _id: 1,
                                      name: 1,
                                      nameHebrew: 1,
                                      avatar: 1,
                                      songCount: 1,
                                      albumCount: 1,
                                      shareUrl: 1,
                                      isPremium: 1
                                  }
                              },
                              {
                                  path: 'albums',
                                  model: 'Albums',
                                  select: {
                                      _id: 1,
                                      title: 1,
                                      titleHebrew: 1,
                                      artwork: 1,
                                      songCount: 1,
                                      totalDuration: 1,
                                      shareUrl: 1,
                                      isPremium: 1
                                  }
                              },
                              {
                                  path: 'tags',
                                  model: 'Tags'
                              },
                              {
                                  path: 'genres',
                                  model: 'Genres'
                              }
                          ]
                      })
                      .sort({ updatedDate: -1 })
                      .then(function(playlists) {
                          if (playlists && playlists.length > 0) {
                              playlists.forEach(function(p) {
                                  p.title = Utils.titleCase(p.title)
                              })
                          }
                          if (u.isVocalOnly !== "" || genre === '5a3e08db768d68577815c651') {
                              playlists = playlists.filter(p => p.songs.length > 5);
                          }
                          var newparr=[];
                          if(playlists&&playlists.length>0){
                              playlists.forEach(function(p){
                                  var index=data.playlists.indexOf(p._id);
                                  newparr.splice(index, 0, p)
                              })
                          }
                          //console.log(bitpastel);
                          res.json({
                              success: true,
                              message: "Playlist Listing",
                              playlists: newparr,
                              // custom:bitpastel
                          });
                      })
                      .catch(function(err) {
                          res.json({
                              success: false,
                              message: "Error in fetching the playlist"
                          });
                      })
                  }else{
                      Playlist.find(query, {
                          _id: 1,
                          title: 1,
                          title_hebrew: 1,
                          icon: 1,
                          songs: 1,
                          description: 1,
                          description_hebrew: 1,
                          avatar: 1,
                          shareUrl: 1,
                          displayOrder: 1,
                          updatedDate: 1,
                          createdBy: 1
                      })
                      .populate({
                          path: 'songs',
                          model: 'Songs',
                          match: songMatch,
                          populate: [{
                                  path: 'artist',
                                  model: 'Artists',
                                  select: {
                                      _id: 1,
                                      name: 1,
                                      nameHebrew: 1,
                                      avatar: 1,
                                      songCount: 1,
                                      albumCount: 1,
                                      shareUrl: 1,
                                      isPremium: 1
                                  }
                              },
                              {
                                  path: 'ft_artist',
                                  model: 'Artists',
                                  select: {
                                      _id: 1,
                                      name: 1,
                                      nameHebrew: 1,
                                      avatar: 1,
                                      songCount: 1,
                                      albumCount: 1,
                                      shareUrl: 1,
                                      isPremium: 1
                                  }
                              },
                              {
                                  path: 'albums',
                                  model: 'Albums',
                                  select: {
                                      _id: 1,
                                      title: 1,
                                      titleHebrew: 1,
                                      artwork: 1,
                                      songCount: 1,
                                      totalDuration: 1,
                                      shareUrl: 1,
                                      isPremium: 1
                                  }
                              },
                              {
                                  path: 'tags',
                                  model: 'Tags'
                              },
                              {
                                  path: 'genres',
                                  model: 'Genres'
                              }
                          ]
                      })
                      .sort({ updatedDate: -1 })
                      .then(function(playlists) {
                          if (playlists && playlists.length > 0) {
                              playlists.forEach(function(p) {
                                  p.title = Utils.titleCase(p.title)
                              })
                          }
                          if (u.isVocalOnly !== "" || genre === '5a3e08db768d68577815c651') {
                              playlists = playlists.filter(p => p.songs.length > 5);
                          }
                          var newparr=[];
                          if(playlists&&playlists.length>0){
                              playlists.forEach(function(p){
                                  var index=data.playlists.indexOf(p._id);
                                  // Genre.findOneAndUpdate({_id:genre,deleted:false,playlists:{$nin:[p._id]}},{
                                  //     $push: { playlists: p._id }
                                  // },function(err,doc){
                                  // // 
                                  // })
                                  newparr.splice(index, 0, p)
                              })
                          }
                      
                          //console.log(bitpastel);
                          res.json({
                              success: true,
                              message: "Playlist Listing",
                              playlists: newparr,
                              // custom:bitpastel
                          });
                      })
                      .catch(function(err) {
                          res.json({
                              success: false,
                              message: "Error in fetching the playlist"
                          });
                      })
                  }
                  
              }).catch((error)=>{
                  Playlist.find(query, {
                      _id: 1,
                      title: 1,
                      title_hebrew: 1,
                      icon: 1,
                      songs: 1,
                      description: 1,
                      description_hebrew: 1,
                      avatar: 1,
                      shareUrl: 1,
                      displayOrder: 1,
                      updatedDate: 1,
                      createdBy: 1
                  })
                  .populate({
                      path: 'songs',
                      model: 'Songs',
                      match: songMatch,
                      populate: [{
                              path: 'artist',
                              model: 'Artists',
                              select: {
                                  _id: 1,
                                  name: 1,
                                  nameHebrew: 1,
                                  avatar: 1,
                                  songCount: 1,
                                  albumCount: 1,
                                  shareUrl: 1,
                                  isPremium: 1
                              }
                          },
                          {
                              path: 'ft_artist',
                              model: 'Artists',
                              select: {
                                  _id: 1,
                                  name: 1,
                                  nameHebrew: 1,
                                  avatar: 1,
                                  songCount: 1,
                                  albumCount: 1,
                                  shareUrl: 1,
                                  isPremium: 1
                              }
                          },
                          {
                              path: 'albums',
                              model: 'Albums',
                              select: {
                                  _id: 1,
                                  title: 1,
                                  titleHebrew: 1,
                                  artwork: 1,
                                  songCount: 1,
                                  totalDuration: 1,
                                  shareUrl: 1,
                                  isPremium: 1
                              }
                          },
                          {
                              path: 'tags',
                              model: 'Tags'
                          },
                          {
                              path: 'genres',
                              model: 'Genres'
                          }
                      ]
                  })
                  .sort({ updatedDate: -1 })
                  .then(function(playlists) {
                      if (playlists && playlists.length > 0) {
                          playlists.forEach(function(p) {
                              p.title = Utils.titleCase(p.title)
                          })
                      }
                      if (u.isVocalOnly !== "" || genre === '5a3e08db768d68577815c651') {
                          playlists = playlists.filter(p => p.songs.length > 5);
                      }
                      var newparr=[];
                      if(playlists&&playlists.length>0){
                          playlists.forEach(function(p){
                              var index=data.playlists.indexOf(p._id);
                              newparr.splice(index, 0, p)
                          })
                      }
                      //console.log(bitpastel);
                      res.json({
                          success: true,
                          message: "Playlist Listing",
                          playlists: newparr,
                          // custom:bitpastel
                      });
                  })
                  .catch(function(err) {
                      res.json({
                          success: false,
                          message: "Error in fetching the playlist"
                      });
                  })
              })
          }
          
      }
  } else {
      res.json({
          success: false,
          message: "Unauthorized access"
      });
  }
};
//API to Get playlist from search
exports.getPlayListsBackup = function (req, res) {
  var userId = req.headers['userid']
  var genre = req.query['genre'] ? req.query['genre'] : 'all'
  if(userId) {
    User.findOne({
      _id: userId
    })
    .then(function(u) {
      if(u) {
    User.distinct("_id", {
      role: { $in: ["admin", "superadmin"] }
    })
    .then(function(users) {
      if(users && users.length > 0) {      
            getData(users, u)
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
        message: "Error in fetching home data."
      });
    })
      } else {
        res.json({
          success: false,
          message: "No user found"
        });
      }
    })
    // Function to get Data 
    function getData(users, u) {
      var query = {
        createdBy: {
          $in: users
        },
        deleted: false,
        isActive: true         
      }
      var songQuery = {
          deleted: false,
          isActive: true
      }
      if(genre != 'all' && genre != '' && genre != 'undefined') {
        songQuery.genres = mongoose.Types.ObjectId(genre)
      }
      if(u.isVocalOnly !== "") {
        songQuery.genres = mongoose.Types.ObjectId(u.isVocalOnly)
      }
      Songs.distinct("_id", songQuery)
        .then(function(songIds) {
          query = {
            createdBy: {
              $in: users
            },
            songs: {
              $in : songIds
          },
            deleted: false,
            isActive: true         
          }
          getPlaylist(query, u);
        })
    }
    // Function to get Playlist
    function getPlaylist(query, u) {
      var songMatch = {
        isActive: true,
        deleted: false
      }
      if(u.isVocalOnly !== "") {
        songMatch.genres = mongoose.Types.ObjectId(u.isVocalOnly);
      } else if(genre != 'all' && genre != '' && genre != 'undefined') {
        songMatch.genres = mongoose.Types.ObjectId(genre);
      }
      Playlist.find(query, {
        _id: 1, 
        title: 1,
        title_hebrew: 1,
        icon: 1,
        songs: 1,
        description: 1,
        description_hebrew: 1,
        avatar: 1,
        shareUrl:1,
        displayOrder:1,
        updatedDate: 1,
        createdBy: 1
      })
      .populate({
        path: 'songs',
        model: 'Songs',
        match: songMatch,
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
      .sort({updatedDate: -1})
      .then(function(playlists) {
        if(playlists && playlists.length > 0) {
          playlists.forEach(function(p) {
            p.title = Utils.titleCase(p.title)
          })
        }
        if(u.isVocalOnly !== "" || genre === '5a3e08db768d68577815c651') {
          playlists = playlists.filter(p => p.songs.length > 5);
        }
        res.json({
          success: true,
          message: "Playlist Listing",
          playlists: playlists
        });
      })
      .catch(function(err) {
        res.json({
          success: false,
          message: "Error in fetching the playlist"
        });
      })
    }
  } else {
    res.json({
      success: false,
      message: "Unauthorized access"
    });
  } 
};

//API to Add song to a Playlist
exports.addSongToPlaylist = function(req, res) {
  var playlistId = req.params.id
  var songId = req.params.songId
  Playlist.findOneAndUpdate({
    _id: playlistId
  }, { 
    $push: { songs: songId }
  },{ 
    new: true 
  })
  .then((playlist) => {
    if (!playlist) {
      res.status(403).send({
        success: false,
        message: "No playlist found."
      });
    } else {
      res.json({
        success: true,
        message: "Song added to playlist successfully.",
        playlist: playlist
      });
    }
  })
};

//API to Remove a song from Playlist
exports.removeSongFromPlaylist = function(req, res) {
  var playlistId = req.params.id
  var songId = req.params.songId
  Playlist.findOneAndUpdate({
    _id: playlistId
  }, { 
    $pull: { songs: songId }
  },{ 
    new: true 
  })
  .then((playlist) => {
    if (!playlist) {
      res.status(403).send({
        success: false,
        message: "No playlist found."
      });
    } else {
      res.json({
        success: true,
        message: "Song removed from playlist successfully.",
        album: album
      });
    }
  })
};

// API to get the songs of a playlist
exports.getPlaylistSongs = function (req, res) {
  var userId = req.headers['userid']
  if(userId) {
    User.findOne({
      _id: userId
    })
    .then(function(user) {
      if(user) {
    var id = req.params.id
    var songMatch = {
          isActive: true,
          deleted: false,
          genres: {
            $nin: user.blockedGenres
          }
        }
        if(user.isVocalOnly !== "") {
          songMatch.genres = mongoose.Types.ObjectId(user.isVocalOnly)
        }
    Playlist.findOne({
      deleted: false,
      isActive: true,
      _id: id
    }, {title:1, title_hebrew: 1, description:1, description_hebrew:1, avatar:1, shareUrl:1, songs: 1})
    .populate({
      path: 'songs',
      model: 'Songs',
      match: songMatch,
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
    .then(function(playlist) {
      return res.json({
        success: true,
        message: "Playlist songs listing",
        songs: playlist
      });
    })
    .catch(function(err) {
      res.status(403).send({
        success: false,
        message: "Error in fetching playlist songs."
      });
    })
  } else {
    return res.json({
      success: false,
          message: "Invalid User"      
        });
      }
    })
  } else {
    return res.json({
      success: false,
      message: "Unauthorized access"      
    });
  }
};