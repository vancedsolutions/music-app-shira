var jwt = require('jsonwebtoken');
var Config = require('../../config/config');
var User = require('../../models/users');
module.exports = (req, res, next) => {
  // check header or url parameters or post parameters for token
  var token = req.body.token || req.query.token || req.headers['authorization'];
  // decode token
  if (token) {
    // verifies secret and checks exp
    //jwt.verify(token, Config.config().token.secret, function(err, decoded) {      
    //  if (err) {
    //    return res.json({ success: false, message: 'Failed to authenticate token.' });    
    //  } else {
        // if everything is good, save to request for use in other routes
    //    req.decoded = decoded;    
        next();
    //  }
    //});
  } else {
    var appSecret = req.headers['appsecret'];
    if(appSecret) {
      if(appSecret === Config.config().appSecret) {
        var deviceId = req.headers['deviceid'];
        if(deviceId) {
          User.findOne({deviceID: deviceId})
          .then(function(user) {
            if(user) {
        next();
      } else {
              return res.json({
                success: false, 
                message: "Invalid device login."
              });
            }
          })
        } else {
          next();
        }        
      } else {
        return res.json({ success: false, message: 'Failed to authenticate app secret.' });
      }
    } else {
      return res.json({
        success: false, 
        message: "No token provided."
      });
    }
  }
}
