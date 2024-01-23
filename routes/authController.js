var User = require('../models/users');
var Artist = require('../models/artist');
var Recipient = require('../models/recipients');
var Config = require('../config/config');
var jwt = require('jsonwebtoken');
var moment = require('moment');
// var EmailService = require('../service/email')
 const { uuid } = require('uuidv4');


// API for admin sign in
exports.adminSignIn = function(req, res) {
    console.log("Working")
    var email = req.body.email;
    var password = req.body.password;
    User.findOne({ role: { $in: ['admin', 'superadmin'] }, email: { $regex: "^" + email + "$", $options: 'i' } })
        .then(function(user) {
            if (user) {
                if (user.deleted || user.isBlock) {
                    res.status(403).send({
                        success: false,
                        message: "Your profile is not active. Please contact to system administrator."
                    });
                }
                if (user.authenticate(password)) {
                    user = user.toJSON();
                    delete user.hashedPassword;
                    delete user.salt;
                    user.myMusic = [];
                    // if user is found and password is right
                    // create a token
                    var token = jwt.sign(user, Config.config().token.secret, {
                        expiresIn: 86400 // expires in 24 hours
                    });
                    res.json({
                        success: true,
                        message: "Login successfull.",
                        user: user,
                        token: token
                    });
                } else {
                    res.status(403).send({
                        success: false,
                        message: "Invalid Email or Password."
                    });
                }
            } else {
                exports.artistLogin(req, res);
            }
        });
};


// API for user sign in
exports.signIn = function(req, res) {
    var email = req.body.email;
    var password = req.body.password;
    var deviceType = req.headers['devicetype'];
    var deviceId = req.body.deviceId ? req.body.deviceId : uuid();
    User.findOne({ email: { $regex: "^" + email + "$", $options: 'i' } })
        .then(function(user) {
            if (user) {
                if (user.deleted || user.isBlock) {
                    res.status(403).send({
                        success: false,
                        message: "Your profile is not active. Please contact to system administrator."
                    });
                }
                if (user.authenticate(password)) {
                    if (deviceId != "") {
                        user.deviceID = deviceId;
                    }
                    user.deviceType = [deviceType];
                    user.save()
                    user = user.toJSON();
                    delete user.hashedPassword;
                    delete user.salt;
                    user.myMusic = [];
                    user.recentlyPlayed = [];
                    user.payments = [];
                    user.playlist = [];
                    user.campaigns = [];
                    user.stripe.paymentMethods = [];
                    // if user is found and password is right
                    // create a token
                    var token = jwt.sign(user, Config.config().token.secret, {
                        expiresIn: 86400 // expires in 24 hours
                    });
                    res.json({
                        success: true,
                        message: "Login successfull.",
                        user: user,
                        token: token
                    });
                } else {
                    res.status(403).send({
                        success: false,
                        message: "Invalid Email or Password."
                    });
                }
            } else {
                res.status(403).send({
                    success: false,
                    message: "Invalid Email or Password."
                });
            }
        });
};


// API for app user and dashboard user signup
exports.signUp = function(req, res) {
    var username = req.body.username ? req.body.username : "";
    var firstName = ""
    var lastName = ""
    var email = req.body.email;
    var password = req.body.password;
    var role = req.body.role ? req.body.role : ['user'];
    var deviceId = req.body.deviceId ? req.body.deviceId : uuid();
    var deviceType = req.headers['devicetype'];
    User.findOne({
            email: email
        })
        .then(function(user) {
            if (user) {
                if (user.deleted) {
                    user.deleted = false
                    user.hashedPassword = user.encryptPassword(password)
                    user.save()
                    res.json({
                        success: true,
                        message: "User registered successfully.",
                        user: user
                    });
                } else {
                    res.json({
                        success: false,
                        message: "Email already registered. Please login."
                    });
                }
            } else {
                if (username === "") {
                    firstName = req.body.firstname
                    lastName = req.body.lastname
                    username = firstName + " " + lastName
                } else {
                    firstName = username.split(' ')[0]
                    lastName = username.split(' ')[1]
                }
                var newUser = new User({
                    username: username,
                    firstName: firstName,
                    lastName: lastName,
                    email: email,
                    password: password,
                    role: role,
                    deviceID: deviceId,
                    deviceType: [deviceType],
                    subscribePlan: {
                        plantype: 'Free',
                        subscriptionDate: new Date(),
                        subscriptionPaymentDate: new Date(),
                        subscriptionRenewDate: new Date(),
                        trailEndDate: new Date()
                    },
                    isTrialTaken: 0,
                    createdDate: new Date(),
                    updatedDate: new Date()
                })
                newUser
                    .save()
                    .then(function(newuser) {
                        delete newuser.hashedPassword;
                        delete newuser.salt;
                        if (role.indexOf('user') !== -1) {
                            // EmailService.sendWelcomeEmail(newuser)
                        }
                        res.json({
                            success: true,
                            message: "User registered successfully.",
                            user: newuser
                        });
                    })
            }
        })
};


exports.artistLogin = function(req, res) {
    const { email, password } = req.body
    Artist.findOne({ emailAddress: email }).then((artist) => {
        if (artist) {
            artist.comparePassword(password, (err, isMatch) => {
                if (err) throw err;
                if (isMatch) {
                    var token = jwt.sign(artist, Config.config().token.secret, {
                        expiresIn: 86400 // expires in 24 hours
                    });
                    const user = artist.toObject()
                    user.role = ['artist']
                    return res.json({ success: true, message: 'Logged in successfully', token, user })
                } else {
                    return res.json({ success: false, message: 'Incorrect password.', token: null })
                }
            })
        } else {
            exports.recipientLogin(req, res)
        }
    })
}

//Api for login recipient
exports.recipientLogin = function(req, res) {
    const { email, password } = req.body
    Recipient.findOne({ email }).then((recipient) => {
        if (recipient) {
            recipient.comparePassword(password, (err, isMatch) => {
                if (err) throw err;
                if (isMatch) {
                    var token = jwt.sign(recipient, Config.config().token.secret, {
                        expiresIn: 86400 // expires in 24 hours
                    });
                    const user = recipient.toObject()
                    user.role = ['recipient']
                    return res.json({ success: true, message: 'Logged in successfully', token, user })
                } else {
                    res.status(403).send({
                        success: false,
                        message: "Invalid Email or Password."
                    });
                }
            })
        } else {
            res.status(403).send({
                success: false,
                message: "Invalid Email or Password."
            });
        }
    })
}
exports.resetPasswordLink = function(req, res) {
    var email = req.body.email;
    var source = req.body.source ? req.body.source : 'web';
    User.findOne({ email: { $regex: email, $options: 'i' } })
        .then(function(user) {
            if (user) {
                if (user.deleted || user.isBlock) {
                    res.status(403).send({
                        success: false,
                        message: "Your profile is not active. Please contact to system administrator."
                    });
                } else {
                    var userID = user._id
                    var text = ''
                    var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
                    for (var i = 0; i < 61; i++) {
                        text += possible.charAt(Math.floor(Math.random() * possible.length));
                    }
                    user.resetPasswordToken = text
                    user.save()
                        // send mail to the user's email with reset password link
                    EmailService.sendResetPasswordMail(user, source, function(result) {
                        if (result) {
                            res.json({
                                success: true,
                                message: "We have sent a password reset link to your email address. Please click on the link.",
                            });
                        } else {
                            if (source == "web") {
                                res.status(403).send({
                                    success: false,
                                    message: "Error in sending email updates."
                                });
                            } else {
                                res.json({
                                    success: false,
                                    message: "Error in processing the request."
                                });
                            }
                        }
                    });
                }
            } else {
                if (source == "web") {
                    res.status(403).send({
                        success: false,
                        message: "User not found."
                    });
                } else {
                    res.json({
                        success: false,
                        message: "User not found."
                    });
                }
            }
        });
};
// API to reset password
exports.resetPassword = function(req, res) {
    var token = req.body.token;
    User.findOne({ resetPasswordToken: token })
        .then(function(user) {
            if (user) {
                if (user.deleted || user.isBlock) {
                    res.status(403).send({
                        success: false,
                        message: "Your profile is not active. Please contact to system administrator."
                    });
                } else {
                    user.hashedPassword = user.encryptPassword(req.body.password)
                    user.resetPasswordToken = "";
                    user.save()
                    res.json({
                        success: true,
                        message: "Email Sent ",
                    });
                }
            } else {
                res.status(403).send({
                    success: false,
                    message: "Sorry! Reset password link has been expired."
                });
            }
        })
};