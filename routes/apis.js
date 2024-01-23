const express = require("express");
const router = express.Router();


var authController = require('./authController');
router.post('/api/v1/auth/adminlogin', authController.adminSignIn);
router.post('/api/v1/auth/login', authController.signIn);
router.post('/api/v1/auth/artistlogin', authController.artistLogin);
router.post('/api/v1/auth/recipientlogin',  authController.recipientLogin);
router.post('/api/v1/auth/resetPasswordLink', authController.resetPasswordLink);
router.post('/api/v1/auth/resetPassword', authController.resetPassword);
router.post('/api/v1/auth/signup', authController.signUp);

var userController = require('./userController');
/**
 * Export CSV User record
 *
 * @section User
 * @type get
 * @url /api/v1/user/export
 */
router.get('/api/v1/user/exportcsv',  userController.exportcsv);
router.get('/api/v1/user/exportlisteners', userController.fetchMusicLister);
router.get('/api/v1/user/fetchTopMusicListenerStreamCount', userController.fetchTopMusicListenerStreamCount);

/**
 * Get a list of users
 *
 * @section User
 * @type get
 * @url /api/v1/user
 */
router.get('/api/v1/user', userController.getUsers);
/**
 * Get profile of a user
 *
 * @section User
 * @type get
 * @url /api/v1/user/:id
 */
router.get('/api/v1/user/:id', userController.getUserProfile);
/**
 * Create a user
 *
 * @section User
 * @type post
 * @url /api/v1/user
 * @param {object} user post body
 */
router.post('/api/v1/user', userController.createProfile);
/**
 * Update a user
 
 * @section User
 * @type put
 * @url /api/v1/user/:id 
 * @param {string} userid will send into url params 
 */
router.put('/api/v1/user/:id', userController.updateProfile);
/**
 * Update an admin user
 
 * @section User
 * @type put
 * @url /api/v1/adminuser/:id
 * @param {string} id will send into url params 
 */
router.put('/api/v1/adminuser/:id', userController.updateAdminProfile);
/**
 * Delete a user
 
 * @section User
 * @type delete
 * @url /remove/:id 
 * @param {string} userid will send into url params 
 */
router.delete('/remove/:id', userController.deleteUsers);
/**
 * Update a user
 
 * @section User
 * @type put
 * @url /update/:id 
 * @param {string} userid will send into url params 
 */
router.put('/update/:id', userController.updateUsers);
/**
 * Get all admin users
 *
 * @section User
 * @type get
 * @url /api/v1/adminuser
 */
router.get('/api/v1/adminuser', userController.getAdminUsers);
/**
 * Add a song to users recently played list
 
 * @section User
 * @type put
 * @url /api/v1/user/:userId/recentlyPlayed/:songId
 * @param {string} userId will send into url params
 * @param {string} songId will send into url params 
 */
router.put('/api/v1/user/:userId/recentlyPlayed/:songId', userController.addRecentlyPlayed);
/**
 * Add a song to users music list
 *
 * @section User
 * @type put
 * @url /api/v1/user/:userId/mymusic/:songId
 * @param {string} userId will send into url params
 * @param {string} songId will send into url params 
 */
router.put('/api/v1/user/:userId/mymusic/:songId', userController.addToMyMusic);
/**
 * Remove a song from my music
 *
 * @section User
 * @type delete
 * @url /api/v1/user/:userId/mymusic/:songId
 * @param {string} userId will send into url params
 * @param {string} songId will send into url params 
 */
router.delete('/api/v1/user/:userId/mymusic/:songId', userController.removeFromMyMusic);
/**
 * Get my music songs
 *
 * @section User
 * @type get
 * @url /api/v1/user/mymusic/:id
 * @param {string} id will send into url params
 */
router.get('/api/v1/user/mymusic/:id', userController.getMyMusic);
/**
 * Get recently played songs listing
 *
 * @section User
 * @type get
 * @url /api/v1/user/:id/recentlyPlayed
 * @param {string} id will send into url params
 */
router.get('/api/v1/user/:id/recentlyPlayed', userController.getRecentlyPlayedList);
/**
 * Get playlists created by user
 *
 * @section User
 * @type get
 * @url /api/v1/user/:id/playlists
 * @param {string} id will send into url params
 */
router.get('/api/v1/user/:id/playlists', userController.getPlaylists);
/**
 * To create user subscription
 *
 * @section User
 * @type post
 * @url /api/v1/user/:id/subscribe
 * @param {string} id will send into url
 * @param {string} token will send into body
 * @param {string} plantype will send into body
 * @param {number} amount will send into body
 */
router.post('/api/v1/user/:id/subscribe',  userController.subscribe);
router.post('/api/v1/user/:id/iosSubscription',  userController.iosSubscription);
router.post('/api/v1/user/:id/iosSubscriptionExpired',  userController.iosSubscriptionExpired);
/**
 * To cancel a user subscription
 *
 * @section User
 * @type post
 * @url /api/v1/user/:id/cancelSubscription
 */
router.post('/api/v1/user/:id/cancelSubscription',  userController.cancelSubscription);
/**
 * To save active user stats
 *
 * @section User
 * @type post
 * @url /api/v1/user/:id/userStats
 * @param {string} id will send into url
 */
router.post('/api/v1/user/:id/userStats', userController.userStats);
/**
 * Get profile of a user
 *
 * @section User
 * @type get  
 * @url /api/v1/user/:id/payoutMethod
 * @param {string} id will send into url
 */
router.get('/api/v1/user/:id/payoutMethod', userController.getPaymentMethod);
/**
 * Api to update user payment method
 *
 * @section User
 * @type put
 * @url /api/v1/user/:id/updatePaymentMethod
 * @param {string} id will send into url params
 * @param {string} token will send into request body
 */
router.put('/api/v1/user/:id/updatePaymentMethod', userController.updatePaymentMethod);
router.post('/api/v1/user/token', userController.generateToken);
/**
 * To follow shirali playlist
 
 * @section User  
 * @type put
 * @url /api/v1/user/:userId/playlist/follow/:playlistId
 * @param {string} userId will send into url params
 * @param {string} playlistId will send into url params 
 */
router.put('/api/v1/user/:userId/playlist/follow/:playlistId', userController.followShiraliPlaylist);
/**
 * To unfollow shirali playlist
 
 * @section User
 * @type put
 * @url /api/v1/user/:userId/playlist/unfollow/:playlistId
 * @param {string} userId will send into url params
 * @param {string} playlistId will send into url params 
 */
router.put('/api/v1/user/:userId/playlist/unfollow/:playlistId', userController.unfollowShiraliPlaylist);
/**
 * Get data for home tab
 *
 * @section User
 * @type get
 * @url /api/v1/user/home/:id
 */
router.get('/api/v1/user/home/:id', userController.homeData);

router.put('/api/v1/user/refund/:id', userController.refundUser);


var genreController = require('./genreController');

//03-12-2020
router.get('/api/v1/genres/pushPlaylists/:id',genreController.playlistUpdateInGenre);
/**
 * Get list of genres
 *
 * @section Genre
 * @type get
 * @url /api/v1/genre
 */
router.get('/api/v1/genre', genreController.fetchGenres);
/**
 * Get list of active genres
 *
 * @section Genre
 * @type get
 * @url /api/v1/genre/active
 */
router.get('/api/v1/genre/active', genreController.fetchActiveGenres);
/**
 * Create a genre
 *
 * @section Genre
 * @type post
 * @url /api/v1/genre
 * @param {string} name will send into body
 * @param {string} image will send into body
 */
router.post('/api/v1/genre', genreController.createGenre);


//03-12-2020
router.get('/api/v1/genre/:id',  genreController.fetchSpecificGenre);
/**
 * Update a genre
 *
 * @section Genre
 * @type put
 * @url /api/v1/genres/:id
 * @param {string} id will send into url params
 * @param {string} name will send into body
 * @param {string} image will send into body
 */
router.put('/api/v1/genres/:id', genreController.updateGenre);
/**
 * Update a genre
 *
 * @section Genre
 * @type put
 * @url /api/v1/genres/:id
 * @param {string} id will send into url params
 */
router.patch('/api/v1/genres/:id', genreController.patchGenre);
/**
 * Delete a genre
 *
 * @section Genre
 * @type delete
 * @url /api/v1/genres/:id
 * @param {string} id will send into url params
 */
router.delete('/api/v1/genres/:id', genreController.deleteGenre);
router.get('/api/v1/genres/:id/fetchDataByGenre', genreController.findLatestByGenres);
router.get('/api/v1/genres/:id/fetchSongsByGenre', genreController.findLatestSongByGenre);
router.get('/api/v1/genres/:id/fetchArtistsByGenre', genreController.findLatestArtistByGenre);
router.get('/api/v1/genres/:id/fetchAlbumsByGenre', genreController.findLatestAlbumByGenre);


var tagController = require('./tagController');
/**
 * Get list of tags
 *
 * @section Tag
 * @type get
 * @url /api/v1/tags
 */
router.get('/api/v1/tags', tagController.fetchTags);
/**
 * Get list of active tags
 *
 * @section Tag
 * @type get
 * @url /api/v1/tags/active
 */
router.get('/api/v1/tags/active', tagController.fetchActiveTags);
/**
 * Create a tag
 *
 * @section Tag
 * @type post
 * @url /api/v1/tag
 * @param {string} tagName will send into body
 */
router.post('/api/v1/tag', tagController.createTag);
/**
 * Update a tag
 *
 * @section Tag
 * @type put
 * @url /api/v1/tag/:id
 * @param {string} id will send into url params
 * @param {string} tagName will send into body
 */
router.put('/api/v1/tag/:id', tagController.updateTag);
/**
 * Update a tag
 *
 * @section Tag
 * @type put
 * @url /api/v1/tag/:id
 * @param {string} id will send into url params 
 */
router.patch('/api/v1/tag/:id', tagController.patchTag);
/**
 * Delete a tag
 *
 * @section Tag
 * @type delete
 * @url /api/v1/tags/:id
 * @param {string} id will send into url params
 */
router.delete('/api/v1/tags/:id', tagController.deleteTag);


var labelController = require('./labelController');
/**
 * Get list of labels
 *
 * @section Label
 * @type get
 * @url /api/v1/labels
 */
router.get('/api/v1/labels', labelController.fetchLabel);
/**
 * Get list of active labels
 *
 * @section Label
 * @type get
 * @url /api/v1/labels/active
 */
router.get('/api/v1/labels/active', labelController.fetchActiveLabel);
/**
 * Create a label
 *
 * @section Label
 * @type post
 * @url /api/v1/label
 * @param {string} labelName will send into body
 */
router.post('/api/v1/label',  labelController.createLabel);
/**
 * Update a label
 *
 * @section Label
 * @type put
 * @url /api/v1/labels/:id
 * @param {string} id will send into url params
 * @param {string} labelName will send into body
 */
router.put('/api/v1/labels/:id',  labelController.updateLabel);
/**
 * Update a label
 *
 * @section Label
 * @type put
 * @url /api/v1/labels/:id
 * @param {string} id will send into url params
 */
router.patch('/api/v1/labels/:id',  labelController.patchLabel);
/**
 * Delete a label
 *
 * @section Label
 * @type delete
 * @url /api/v1/labels/:id
 * @param {string} id will send into url params
 */
router.delete('/api/v1/labels/:id',  labelController.deleteLabel);

var albumController = require('./albumController');
router.get('/api/v1/export/inactivealbums', albumController.getInactiveAlbumCsv);
router.get('/api/v1/albums/:artistId', albumController.fetchAlbum);
router.post('/api/v1/album', albumController.createAlbum);
router.put('/api/v1/albums', albumController.updateAlbum);
router.put('/api/v1/album/:id',  albumController.updateAlbumSongs);
router.delete('/api/v1/albums/:id',  albumController.deleteAlbum);
router.put('/api/v1/album/:id/song/add/:songId',  albumController.addSongToAlbum);
router.put('/api/v1/album/:id/song/remove/:songId',  albumController.removeSongFromAlbum);
/**
 * Get songs of an album 
 *
 * @section Album
 * @type get
 * @url /api/v1/artist/:id/albums
 * @param {string} id will send into url params
 */
router.get('/api/v1/album/:id/songs',  albumController.getAlbumSongs);
/**
 * Get newly released albums list only
 *
 * @section Album
 * @type get
 * @url /api/v1/album/newReleaseAlbums
 */
router.get('/api/v1/album/newReleaseAlbums/all',  albumController.getNewReleaseAlbums);
/**
 * Get recommended albums
 *
 * @section Album
 * @type get
 * @url /api/v1/album/recommended/all
 */
router.get('/api/v1/album/recommended/all',  albumController.getRecommendedAlbums);
/**
 * Get album detail
 *
 * @section Album
 * @type get
 * @url /api/v1/album/:id
 * @param {string} id will send into url params
 */
router.get('/api/v1/album/:id/detail',  albumController.getAlbumDetail);
/**
 * Get all recently played albums by user
 *
 * @section Album
 * @type get
 * @url /api/v1/album/recentlyPlayedAlbums/all
 */
router.get('/api/v1/album/recentlyPlayedAlbums/all',  albumController.getRecentlyPlayedAlbums);


var artistController = require('./artistController');

router.get('/api/v1/export/inactiveartists', artistController.getInactiveArtistCsv);
/**
 * Get artists listing for admin dashboard
 *
 * @section Artist
 * @type get
 * @url /api/v1/artist
 */
router.get('/api/v1/artist',  artistController.fetchArtists);
router.post('/api/v1/artist/updateArtistGenres',  artistController.updateArtistGenere);
router.post('/api/v1/artist/updateArtistTags',  artistController.updateArtistTags);
/**
 * Get artists listing for admin dashboard
 *
 * @section Artist
 * @type get
 * @url /api/v1/artist
 */
router.get('/api/v1/artists',  artistController.fetchArtistslist);

/**
 * Get artist detail 
 *
 * @section Artist
 * @type get
 * @url /api/v1/artist/:id
 * @param {string} id will send into url params
 */
router.get('/api/v1/artist/:id/detail',  artistController.fetchDetail);
router.put('/api/v1/artist/sendinvitation',  artistController.sendInvitation);
/**
 * Get artist detail 
 *
 * @section Artist
 * @type get
 * @url /api/v1/artist/:id
 * @param {string} id will send into url params
 */
router.get('/api/v1/artist/:id',  artistController.fetchArtistDetail);
/**
 * Get artist new release albums
 *
 * @section Artist
 * @type get
 * @url /api/v1/artist/:id/newReleaseAlbums
 * @param {string} id will send into url params
 * @param {number} page will send into query
 */
router.get('/api/v1/artist/:id/newReleaseAlbums',  artistController.getArtistNewReleaseAlbums);
/**
 * Get artist popular Playlist
 *
 * @section Artist
 * @type get
 * @url /api/v1/artist/:id/popularPlaylist
 * @param {string} id will send into url params
 * @param {number} page will send into query
 */
router.get('/api/v1/artist/:id/popularPlaylist',  artistController.fecthArtistPopularPlayLists);
/**
 * Get artist popular songs listing
 *
 * @section Artist
 * @type get
 * @url /api/v1/artist/:id/popularSongs
 * @param {string} id will send into url params
 * @param {number} page will send into query
 */
router.get('/api/v1/artist/:id/popularSongs',  artistController.fetchArtistPopularSongs);
/**
 * Get artist for payment
 *
 * @section Artist
 * @type get
 * @url /api/v1/artist/payment/:filter
 * @param {string} id will send into url params
 */
router.get('/api/v1/artist/payment/:filter',  artistController.fetchArtistForPayment);
/**
 * Get artist payout details
 *
 * @section Artist
 * @type get
 * @url /api/v1/artist/:id/payout/:filter
 * @param {string} id will send into url params
 */
router.get('/api/v1/artist/:id/payout/:filter',  artistController.fetchArtistPayoutDetail);
router.post('/api/v1/artist',  artistController.createArtist);
router.post('/api/v1/musicInfo',  artistController.addMusicInfo);
router.post('/api/v1/bankInfo',  artistController.addBankInfo);
router.post('/api/v1/addressInfo',  artistController.addAddressInfo);
router.put('/api/v1/artist/:id',  artistController.updateArtist);
router.delete('/api/v1/artist/:id',  artistController.deleteArtist);
router.put('/api/v1/artist/:id/:isActive',  artistController.updateActiveStatus);
router.post('/api/v1/artist/payout',  artistController.PayoutToArtist);
router.get('/api/v1/searchArtist/:term',  artistController.searchArtist)
/**
 * Get albums of an artist 
 *
 * @section Artist
 * @type get
 * @url /api/v1/artist/:id/albums
 * @param {string} id will send into url params
 */
router.get('/api/v1/artist/:id/albums', artistController.fetchArtistAlbums);
/**
 * Get songs of an artist 
 *
 * @section Artist
 * @type get
 * @url /api/v1/artist/:id/songs
 * @param {string} id will send into url params
 */
router.get('/api/v1/artist/:id/songs', artistController.fetchArtistSongs);
router.get('/api/v1/artist/active/:term', artistController.fetchActiveArtists);


var playlistController = require('./playlistController');
/**
 * Get all Playlists
 *
 * @section Playlist
 * @type get
 * @url /api/v1/playlists
 */
router.get('/api/v1/playlists',  playlistController.fetchPlaylist);
/**
 * Create a new playlist
 *
 * @section Playlist
 * @type post
 * @url /api/v1/playlist
 * @param {string} title will send into request body
 * @param {string} createdBy will send into request body
 */
router.post('/api/v1/playlist',  playlistController.createPlaylist);
/**
 * Update a playlist
 *
 * @section Playlist
 * @type put
 * @url /api/v1/playlist/:id
 * @param {string} id will send into url params
 * @param {string} title will send into request body
 */
router.put('/api/v1/playlist/:id',  playlistController.updatePlaylist);
/**
 * Update songs and isActive status playlist
 *
 * @section Playlist
 * @type patch
 * @url /api/v1/playlist/:id
 * @param {string} id will send into url params
 * @param {string} songs will send into request body
 * @param {string} isActive will send into request body
 */
router.patch('/api/v1/playlist/:id',  playlistController.patchPlaylist);
/**
 * Update a playlist
 *
 * @section Playlist
 * @type delete
 * @url /api/v1/playlist/:id
 * @param {string} id will send into url params
 */
router.delete('/api/v1/playlist/:id',  playlistController.deletePlaylist);
/**
 * Get all Shirali Playlists
 *
 * @section Playlist
 * @type get
 * @url /api/v1/playlist/shirali
 */
router.get('/api/v1/playlist/shirali',  playlistController.getPlayLists);
/**
 * Api to add a song into playlist songs array
 *
 * @section Playlist
 * @type put
 * @url /api/v1/playlist/:id/song/add/:songId
 * @param {string} id will send into url params
 * @param {string} songId will send into url params
 */
router.put('/api/v1/playlist/:id/song/add/:songId',  playlistController.addSongToPlaylist);
/**
 * Api to remove a song from playlist songs array
 *
 * @section Playlist
 * @type delete
 * @url /api/v1/playlist/:id/song/remove/:songId
 * @param {string} id will send into url params
 * @param {string} songId will send into url params
 */
router.put('/api/v1/playlist/:id/song/remove/:songId',  playlistController.removeSongFromPlaylist);
/**
 * Get all songs of a playlist
 *
 * @section Playlist
 * @type get
 * @url /api/v1/playlist/:id/songs
 * @param {string} id will send into url params
 */
router.get('/api/v1/playlist/:id/songs', playlistController.getPlaylistSongs);


var songController = require('./songController');
router.get('/api/v1/song/getSongsMissingFileUrl',  songController.getSongsMissingFileUrl);
router.get('/api/v1/song/getSignedUrl',  songController.getSignedSongUrl);
/**
 * Get all songs
 *
 * @section Song
 * @type get
 * @url /api/v1/song
 */
router.get('/api/v1/song', songController.fetchSongs);
/**
 * Get all active songs
 *
 * @section Song
 * @type get
 * @url /api/v1/song/active
 */
router.get('/api/v1/song/active', songController.fetchActiveSongs);
/**
 * Get all songs for 
 *
 * @section Song
 * @type get
 * @url /api/v1/song/all
 */
router.get('/api/v1/songs/all', songController.fetchAllSongs);
/**
 * Get all songs of a artist
 *
 * @section Song
 * @type get
 * @url /api/v1/song
 * @param {string} artistId will send into url params
 */
router.get('/api/v1/songs/:artistId',  songController.getArtistsSongs);
router.post('/api/v1/song', songController.createSong);
router.put('/api/v1/song/', songController.updateSong);
router.put('/api/v1/song/updateActiveStatus/:id', songController.updateActiveStatus);
router.delete('/api/v1/song/:id', songController.deleteSong);
router.post('/api/v1/song/fixsharepages/:type',  songController.fixSharePages);
router.post('/api/v1/song/skipsong', songController.skipSong);
router.get('/api/v1/song/newReleasedSongs', songController.getNewReleasedSongs);
router.put('/api/v1/song/updateNewReleaseStatus/:id', songController.updateNewReleaseStatus);
router.get('/api/v1/song/weekTopTen', songController.getWeekTopTenSongs);
router.post('/api/v1/song/saveArtistTopSongs', songController.saveArtistTopSongs);
router.get('/api/v1/song/exportArtistTopSongs', songController.exportArtistTopSongs);
/**
 * Get song detail
 *
 * @section Song
 * @type get
 * @url /api/v1/song/:id
 * @param {string} id will send into url params
 */
router.get('/api/v1/song/:id/detail',  songController.getSongDetail);
/**
 * Api to like a song
 *
 * @section Song
 * @type post
 * @url /api/v1/song/:id/like/:uid
 * @param {string} id will send into url params
 * @param {string} uid will send into url params
 */
router.post('/api/v1/song/:id/like/:uid', songController.likeSong);
/**
 * Api to unlike a song
 *
 * @section Song
 * @type post
 * @url /api/v1/song/:id/unlike/:uid
 * @param {string} id will send into url params
 * @param {string} uid will send into url params
 */
router.post('/api/v1/song/:id/unlike/:uid', songController.unlikeSong);
/**
 * Get newly released songs list only
 *
 * @section Song
 * @type get
 * @url /api/v1/song/newReleaseSongs
 */
router.get('/api/v1/song/newReleaseSongs/all', songController.getNewReleaseSongs);
/**
 * Get all preferred songs for user
 *
 * @section Song
 * @type get
 * @url /api/v1/song/preferredSongs/all
 */
router.get('/api/v1/song/preferredSongs/all',  songController.getPreferredSongs);
/**
 * Get all recently played songs by user
 *
 * @section Song
 * @type get
 * @url /api/v1/song/recentlyPlayedSongs/all
 */
router.get('/api/v1/song/recentlyPlayedSongs/all',  songController.getRecentlyPlayedSongs);
/**
 * Get new release songs and albums both in response
 *
 * @section Song
 * @type get
 * @url /api/v1/song/newReleases
 */
router.get('/api/v1/song/newReleases',  songController.getNewReleases);
/**
 * Get popular songs and albums both in response
 *
 * @section Song
 * @type get
 * @url /api/v1/song/popular
 */
router.get('/api/v1/song/popular', songController.getPopularListing);
/**
 * Get recommendations listing
 *
 * @section Song
 * @type get
 * @url /api/v1/song/recommendations
 */
router.get('/api/v1/song/recommendations',  songController.getRecommendedListing);
/**
 * Get recommended songs
 *
 * @section Song
 * @type get
 * @url /api/v1/song/recommended/all
 */
router.get('/api/v1/song/recommended/all',  songController.getRecommendedSongs);
/**
 * Update song stream stats and stream count
 *
 * @section Song
 * @type post
 * @url /api/v1/song/:songId/stream
 * @param {string} songId will send into url params
 * @param {string} plantype will send into body
 */
router.post('/api/v1/song/:songId/stream',  songController.songStream);
/**
 * Get user like/unlike status of a song
 *
 * @section Song
 * @type get
 * @url /api/v1/songs/:id/status/:uid
 * @param {string} id will send into url params
 * @param {string} uid will send into url params
 */
router.get('/api/v1/song/:id/status/:uid',  songController.getSongStatus);
router.get('/api/v1/searchSong/:term',  songController.searchSong)



var searchController = require('./searchController');
/**
 * Search Song as per the search term
 *
 * @section Search
 * @type get
 * @url /api/v1/search/:term
 */
router.get('/api/v1/search/:term', searchController.search);

/**
 * Search Song as per the search term
 *
 * @section Search
 * @type get
 * @url /api/v1/search/advance/:term
 */
router.get('/api/v1/search/advance/:term',  searchController.advanceSearch);

/**
 * Get suggesstion list as soon as user start searching
 *
 * @section Search
 * @type get
 * @url /api/v1/search/suggesstions/:term
 */
router.get('/api/v1/search/suggesstions/:term',  searchController.searchSuggestions);

/**
 * API to view all searched songs based on the search term
 *
 * @section Search
 * @type get
 * @url /api/v1/search/songs/all/:term
 */
router.get('/api/v1/search/songs/all/:term',  searchController.viewAllSearchedSongs);

/**
 * API to view all searched artists based on the search term
 *
 * @section Search
 * @type get
 * @url /api/v1/search/artists/all/:term
 */
router.get('/api/v1/search/artists/all/:term',  searchController.viewAllSearchedArtists);

/**
 * API to view all searched albums based on the search term
 *
 * @section Search
 * @type get
 * @url /api/v1/search/albums/all/:term
 */
router.get('/api/v1/search/albums/all/:term',  searchController.viewAllSearchedAlbums);

var campaignController = require('./campaignController');
/**
 * Get campaigns for dashboard
 *
 * @section Campaign
 * @type get
 * @url /api/v1/campaigns
 */
router.get('/api/v1/campaigns', campaignController.fetchCampaign);
/**
 * Get advertisers for dashboard
 *
 * @section Campaign
 * @type get
 * @url /api/v1/advertisers
 */
router.get('/api/v1/advertisers', campaignController.fetchAdvertisers);
/**
 * Get a single advertisement to display in the app
 *
 * @section Campaign
 * @type get
 * @url /api/v1/user/:userId/advertisement
 * @param {string} userId will send into url params
 */
router.get('/api/v1/user/:userId/advertisement', campaignController.fetchAdvertisement);
/**
 * Get a single campaign detail
 *
 * @section Campaign
 * @type get
 * @url /api/v1/campaign/:id
 * @param {string} id will send into url params
 */
router.get('/api/v1/campaign/:id', campaignController.getCampaignDetail);
router.post('/api/v1/campaign', campaignController.createCampaignStep1);
router.put('/api/v1/campaign/:id', campaignController.createCampaignStep2);
router.put('/api/v1/campaign/:id/editstep1', campaignController.editCampaignStep1);
router.put('/api/v1/campaign/:id/editstep2', campaignController.editCampaignStep2);
router.post('/api/v1/campaign/:id/sendCampaignReport', campaignController.sendCampaignPerformanceReport);
/**
 * Update click count of a campaign when user click any ad from application.
 *
 * @section Campaign
 * @type put
 * @url /api/v1/campaign/:id/click
 * @param {string} id will send into url params
 */
router.put('/api/v1/campaign/:id/click', campaignController.updateCampaignClickCount);
router.put('/api/v1/campaign/active/:id', campaignController.activeCampaign);
router.delete('/api/v1/campaign/:id', campaignController.deleteCampaign);


var settingController = require('./settingController');
router.post('/api/v1/setting/create',  settingController.createSetting);
/**
 * Fetch application settings
 *
 * @section Setting
 * @type get
 * @url /api/v1/setting/getSetting
 */
router.get('/api/v1/setting/getSetting',  settingController.fetchSetting);
router.get('/api/v1/setting/getSettingAdmin',  settingController.fetchSettingAdmin);

var dashboardController = require('./dashboardController');
router.get('/api/v1/dashboard',  dashboardController.fetchData);
router.post('/api/v1/updateAppStats',  dashboardController.updateAppStats);

var stripeController = require('./stripeController');
router.post('/api/v1/stripe/webhook', stripeController.webhook);

var recipientController = require('./recipientController');
router.post('/api/v1/recipient/create', recipientController.createRecipient);
router.put('/api/v1/recipient/update', recipientController.updateRecipient);
router.delete('/api/v1/recipient/:id',  recipientController.deleteRecipient);
router.get('/api/v1/recipient/list',  recipientController.fetchRecipients);
// router.get('/api/v1/recipient/:id/payout/:filter',  artistController.fetchRecipientPayoutDetail);
router.post('/api/v1/recipient/sendinvitation', recipientController.sendInvitation);

var uploadsController = require('./uploadsController');
router.post('/api/v1/uploads/uploadSongArtwork', uploadsController.uploadSongArtwork);
router.post('/api/v1/uploads/uploadSongFile', uploadsController.uploadSongFile);
router.post('/api/v1/uploads/bulkuploading', uploadsController.bulkUploading);
router.post('/api/v1/uploads/deletealbum/:name', uploadsController.deleteAlbumByName);
router.post('/api/v1/uploads/generatesharepages', uploadsController.generateMissingSharePage);

var radioStationController = require('./radioStationController');
router.get('/api/v1/radiostation/all',  radioStationController.fetchActiveRadioStations);
router.post('/api/v1/radiostation/create', radioStationController.createRadioStation);
router.post('/api/v1/radiostation/update',  radioStationController.updateRadioStation);
router.get('/api/v1/radiostation',  radioStationController.fetchRadioStations);
router.delete('/api/v1/radiostation/:id', radioStationController.deleteRadioStation);


var bannerController = require('./bannerController');
router.post('/api/v1/banner/new',   bannerController.createBanner);
router.get('/api/v1/banner/get',   bannerController.fetchBanners);
router.put('/api/v1/banner/edit',  bannerController.updateBanner);
router.put('/api/v1/banner/editstatus',  bannerController.updateBannerStatus);

module.exports = router;