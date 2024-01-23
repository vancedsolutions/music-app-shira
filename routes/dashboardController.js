
var User = require('../models/users');
var UserStats = require('../models/userStats');
var Song = require('../models/songs');
var Album = require('../models/albums');
var Genre = require('../models/genres');
var Playlist = require('../models/playlists');
var Artist = require('../models/artist');
var SongStats = require('../models/songStates');
var Campaign = require('../models/campaigns')
var Payment = require('../models/payments');
var AppStats = require('../models/appStats');
var Utils = require('../service/utils');

// const ParseMs = require('parse-ms');


var Promise = require('bluebird');

// API to get data for dashboard stats
exports.fetchData = function (req, res) {
    const filter = JSON.parse(req.query.filter)
    var sdate = Utils.formatStartDate(filter[0].startDate)
    var edate = Utils.formatEndDate(filter[0].endDate)
    // Function to change the format of String
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
      }
      return str.join(' ') 
    }
  
    // Function to get Total users by Date
    var getTotalUsers = new Promise(function(f, r) {
      User.count({
        deleted: false,
        createdDate: { 
          "$gte" : sdate,
          "$lte": edate
        },
        role: 'user'  
      })
      .then(function(userCount) {
        f(userCount)
      })
      .catch(function(err) {
        f(0)
      })
    })
  
    // Function to get all users listening Music by Date. Later used socket to get realtime users
    var getUsersListingMusic = new Promise(function(f, r) {
      f(0);    
    })
  
    // Function to get Total Paid users filtered by date
    var getPaidUser = new Promise(function(f, r) {
      User.count({
        deleted: false, 
        'subscribePlan.plantype': 'Paid',
        'subscribePlan.subscriptionDate': { 
          $gte: sdate,
          $lte: edate
        },
        role: 'user' 
      })
      .then(function(count) {
        f(count)
      })
      .catch(function(err) {
        f(0)
      })
    })
  
    // Function to get Total paid users who subscribed for monthly plan by Date
    var getTotalMonthlyPlanSubscribers = new Promise(function(f, r) {
      User.count({
        deleted: false, 
        'subscribePlan.plantype': 'Paid',
        'subscribePlan.planId': 'Shirali_Monthly_Subscription',
        'subscribePlan.subscriptionDate': { 
          $gte: sdate,
          $lte: edate
        },
        role: 'user' 
      })
      .then(function(count) {
        f(count)
      })
      .catch(function(err) {
        f(0)
      })
    })
  
    // Function to get Total paid users who subscribed for yearly plan by Date
    var getTotalYearlyPlanSubscribers = new Promise(function(f, r) {
      User.count({
        deleted: false, 
        'subscribePlan.plantype': 'Paid',
        'subscribePlan.planId': 'Shirali_Yearly_Subscription',
        'subscribePlan.subscriptionDate': { 
          $gte: sdate,
          $lte: edate
        },
        role: 'user' 
      })
      .then(function(count) {
        f(count)
      })
      .catch(function(err) {
        f(0)
      })
    })
  
    // Function to get total songs in the DB filtered by date
    var getSongs = new Promise(function(f, r) { 
      Song.count({
        deleted: false,   
        createdDate: { 
          "$gte" : sdate,
          "$lte": edate
        },    
      })
      .then(function(songCount) {
        f(songCount)
      })
      .catch(function(err) {
        f(0)
      })
    })
  
    // Function to get total artists in DB filtered by date
    var getArtists = new Promise(function(f, r) {
      Artist.count({
        deleted: false,   
        createdDate: { 
          "$gte" : sdate,
          "$lte": edate
        },    
      })
      .then(function(artistCount) {
        f(artistCount)
      })
      .catch(function(err) {
        f(0)
      })
    })
  
     // Function to get total albums in DB filtered by date
    var getAlbums = new Promise(function(f, r) {
      Album.count({
        deleted: false,   
        createdDate: { 
          "$gte" : sdate,
          "$lte": edate
        },    
      })
      .then(function(albumCount) {
        f(albumCount)
      })
      .catch(function(err) {
        f(0)
      })
    })
  
    //Function to get all playlist created by admin/superadmin users in DB filtered by date
    var getPlaylist = new Promise(function(f, r) {
      User.distinct("_id", {
        role: { $in: ["admin", "superadmin"] }
      })
      .then(function(adminUsers) {
      Playlist.count({
        deleted: false,   
        createdDate: { 
          "$gte" : sdate,
          "$lte": edate
        },    
          createdBy: {
            $nin: adminUsers
          }
      })
      .then(function(playlistCount) {
        f(playlistCount)
      })
      .catch(function(err) {
        f(0)
      })
    })   
    })   
  
    // Function to get total streamed music filtered by date
    var getStreamedMusic = new Promise(function(f, r) {
      SongStats.aggregate([
        {"$match": { "createdDate" : { $gte: new Date(sdate) ,$lte: new Date(edate) } } },
        {"$group": { "_id": null, "duration": { "$sum": "$streamDuration" } } }
      ])
      .then(function(results) {
        var duration = (results.length > 0 ? parseFloat(results[0].duration) : 0)
        var durationMS = (duration*1000);
        var result = formatString(durationMS);
        f(result);
      })
    })
  
    // Function to get daily active users filtered by date
    var getDailyActiveUsers = new Promise(function(f, r) {
      var sdate1 = Utils.formatStartDate(filter[0].endDate);
      var edate1 = Utils.formatEndDate(filter[0].endDate);
      UserStats.aggregate([
        {"$match": { "createdDate" : { $gte: new Date(sdate1) ,$lte: new Date(edate1) } } },
        {"$group": { "_id": null, "count": { "$sum": "$userSessionCount" } } }
      ])
      .then(function(results) {
        f(results[0].count)
          })
      .catch(function(err) {
        f(0)
      })
    })
  
    // Function to get total free user filtered by date
    var getFreeUser = new Promise(function(f, r) {
      User.count({
        deleted: false, 
        'subscribePlan.plantype': 'Free',
        'createdDate': { 
          $gte: sdate,
          $lte: edate
        },
        role: 'user' 
      })
      .then(function(count) {
        f(count)
      })
      .catch(function(err) {
        f(0)
      })
    })
  
    // Function to get total my music data filtered by date
    var getTotalMyMusicData = new Promise(function(f, r) {
      User.aggregate([{
        "$match": { 
          "createdDate" : {
            $gte: new Date(sdate),
            $lte: new Date(edate)
          } 
        }
      },
      {
        "$project": {
              "myMusicData": { "$size": "$myMusic" }
           }
         },
         {
            "$group": {
              "_id": null,
                "count": {
                  "$sum": "$myMusicData",
                }
            }
          }
      ])
      .then(function(count) {
        f(count[0].count)
      })
      .catch(function(err) {
        f(0)
      })
    })
  
    // Function to get new paid user by date
     var getNewPaidUser = new Promise(function(f, r) {
      var sdate1 = Utils.formatStartDate(filter[0].endDate);
      var edate1 = Utils.formatEndDate(filter[0].endDate);
      User.count({
        deleted: false, 
        'subscribePlan.plantype': 'Paid',
        'subscribePlan.subscriptionDate': {
          $gte: new Date(sdate1),
          $lte: new Date(edate1)
        },
        role: 'user'  
      })
      .then(function(count) {
        f(count)
      })
      .catch(function(err) {
        f(0)
      })
    })
  
     // Function to get total ad revenue filtered by date
     var getTotalAdRevenue = new Promise(function(f, r) {
      Campaign.aggregate([
        {$project: {campaign:1}},
        {$match: {'campaign.createDate' : {
          $gte: new Date(sdate),
          $lte: new Date(edate)
        }}},
        {$group:
          {_id: null,
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
  
     // Function to get total subscription revenue filtered by date
    var getTotalSubscriptionRevenue = new Promise(function(f, r) {
      Payment.aggregate([{
        "$match":{ "paymentDate" : {
          $gte: new Date(sdate),
          $lte: new Date(edate)
        }}}, {
          "$group": {
            "_id": null,
            "count": {
              "$sum": "$amount",
            }
          }
        }
      ])
      .then(function(result) {
        if(result.length > 0) {
          f(parseFloat(result[0].count).toFixed(2))
        } else {
          f(0)
        }     
      })
    });
  
    //Function to get all android download stats for the selected date range
    var getAndroidAppDownloadStats = new Promise(function(f, r) {
      AppStats.aggregate([{
        "$match": { 
          "createdDate" : {
          $gte: new Date(sdate),
          $lte: new Date(edate)
          } 
        }
      },
         {
          "$group": {
            "_id": null,
            "count": {
                  "$sum": "$androidDownloads",
            }
          }
        }
      ])
      .then(function(result) {
        if(result.length > 0) {
          f(result[0].count)
        } else {
          f(0)
        }     
      })
    });
  
    //Function to get all ios download stats for the selected date range
    var getIOSAppDownloadStats = new Promise(function(f, r) {
      AppStats.aggregate([{
        "$match": { 
          "createdDate" : {
          $gte: new Date(sdate),
          $lte: new Date(edate)
          } 
        }
      },
         {
          "$group": {
            "_id": null,
            "count": {
                  "$sum": "$iosDownloads",
            }
          }
        }
      ])
      .then(function(result) {
        if(result.length > 0) {
          f(result[0].count)
        } else {
          f(0)
        }     
      })
    });
  
    // Execute all the promise function defined above 
    Promise.all([getTotalUsers, getUsersListingMusic, getPaidUser, getSongs, getArtists, getAlbums, getPlaylist, getStreamedMusic, getDailyActiveUsers, getFreeUser, getTotalMyMusicData, getNewPaidUser, getTotalAdRevenue, getTotalSubscriptionRevenue, getAndroidAppDownloadStats, getIOSAppDownloadStats, getTotalMonthlyPlanSubscribers, getTotalYearlyPlanSubscribers])
    .then(function(data) {
      res.json({
        success: true,
        message: "Data found.",
        totalUsers: data[0],
        userListingMusic: data[1],
        paidUsers: data[2],
        songs: data[3],
        artist: data[4],
        album: data[5],
        playlist: data[6],        
        streamedMusic: data[7],
        dailyActiveUsers: data[8],
        freeUsers: data[9],
        myMusic: data[10],
        newPaidUser: data[11],
        totalAdRevenue: data[12],
        totalSubscriptionRevenue: data[13], 
        totalAndroidUser: data[14],
        totalIosUser: data[15],
        monthlySubscriber: data[16],
        yearlySubscriber: data[17],
      });
    })
    .catch(function(err) {
      res.json({
        success: false,
        message: "Error in fetching dashboard data.",
        err: err
      });
    })
  };

  
exports.updateAppStats = function (req, res) {
    var deviceType = req.body.deviceType
    var sdate = Utils.formatStartDate(new Date())
    var edate = Utils.formatEndDate(new Date())
    AppStats.findOne({
      createdDate: {
        $gte: sdate,
        $lte: edate
      }
    })
    .then(function(stats) {
      if(stats) {
        if(deviceType == "android") {
          stats.androidDownloads = stats.androidDownloads + 1;
        } else {
          stats.iosDownloads = stats.iosDownloads + 1;
        }
        stats.save()
        res.json({
          success: true,
          message: "Changes saved successfully",
        })
      } else {  
        var objStat = new AppStats({
          createdDate: new Date()
        })
        if(deviceType == "android") {
          objStat.androidDownloads = 1;
          objStat.iosDownloads = 0;
        } else {
          objStat.androidDownloads = 0;
          objStat.iosDownloads = 1;
        }
        objStat.save()
        res.json({
          success: true,
          message: "Changes saved successfully",
        })
      }
    })
  }