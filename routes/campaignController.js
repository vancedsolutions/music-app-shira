var Campaign = require('../models/campaigns');
var Config = require('../config/config');
var Busboy = require('busboy');
const AWS = require('aws-sdk')
var User = require('../models/users');
var CampaignStats = require('../models/campaignStats');
var Promise = require('bluebird');
var _ = require('lodash');
var stripe = require("stripe")(Config.config().stripe_key);
var Utils = require('../service/utils');
var d3nBar = require('../service/d3Bar');
var moment = require('moment');
var EmailService = require('../service/email')
const svg2png = require('svg2png');
var Settings = require('../models/settings');

//API to create a Campaign
// exports.createCampaignStep1 = function(req, res) {
//     res.status(200).send({
//         success: true,
//         message: "ok"
//     });
// }
exports.createCampaignStep1 = function(req, res) {
        var aws = Config.config().aws;
        var adFileS3Url = '';
        var artworkS3Url = '';
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
            if (file) {
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
            var uploadAdFile = new Promise(function(f, r) {
                var file = body.files.find(function(f) {
                    return f.fieldname == "adFile";
                })
                if (file) {
                    AWS.config.update({
                        accessKeyId: aws.key,
                        secretAccessKey: aws.secret,
                        region: aws.region
                    });
                    var s3 = new AWS.S3({
                        params: {
                            Bucket: aws.audio_input_bucket
                        }
                    });
                    var filename = 'campaign/' + file.newfilename;
                    var data = {
                        Key: filename,
                        Body: file.buffer,
                        ContentType: file.mimetype,
                        ACL: 'public-read'
                    };
                    s3.upload(data, function(err, resp) {
                        if (err) {
                            r(err);
                        } else {
                            var transcoder = new AWS.ElasticTranscoder({
                                region: aws.region
                            });
                            let params = {
                                PipelineId: aws.pipelineId,
                                Input: {
                                    Key: filename
                                },
                                Output: {
                                    Key: filename,
                                    PresetId: aws.VideoPresetId
                                }
                            };
                            if (body.fields.adFormat === "Audio") {
                                params.Output.PresetId = aws.PresetId
                            }
                            transcoder.createJob(params, function(err, transcodedata) {
                                if (transcodedata) {
                                    adFileS3Url = resp.Location.toString().replace(aws.audio_input_bucket, aws.audio_output_bucket);
                                    f(resp.Location);
                                } else {
                                    adFileS3Url = '';
                                    f('');
                                }
                            });
                        }
                    })
                }
            });
            // Function to upload artwork file on amazon s3
            var uploadArtworkFile = new Promise(function(f, r) {
                var file = body.files.find(function(f) {
                    return f.fieldname == "artworkFile";
                })
                if (file) {
                    AWS.config.update({
                        accessKeyId: aws.key,
                        secretAccessKey: aws.secret,
                        region: aws.region
                    });
                    var s3 = new AWS.S3({
                        params: {
                            Bucket: aws.bucket
                        }
                    });
                    var data = {
                        Key: 'campaign/' + file.newfilename,
                        Body: file.buffer,
                        ContentType: file.mimetype,
                        ACL: 'public-read'
                    };
                    s3.upload(data, function(err, resp) {
                        if (err) {
                            r(err);
                        } else {
                            artworkS3Url = resp.Location;
                            f(resp.Location);
                        }
                    })
                }
            });
            // Function to add Campaign Step 1 Information
            function addCampaign() {
                var name = body.fields.advertiserName
                var email = body.fields.advertiserEmail
                Campaign.findOne({
                        'advertisor.email': { $regex: "^" + email + "$", $options: 'i' }
                    })
                    .then(function(campaign) {
                        var newCamp = new Campaign({
                            ads: {
                                adFileUrl: adFileS3Url,
                                adFormat: body.fields.adFormat,
                                adDuration: body.fields.adDuration,
                                redirectUrl: body.fields.redirectUrl,
                                adArtworkUrl: artworkS3Url,
                                isActive: false
                            }
                        });
                        if (campaign) {
                            newCamp.advertisor = campaign.advertisor
                            newCamp.advertisor.name = body.fields.advertiserName
                        } else {
                            newCamp.advertisor.name = body.fields.advertiserName
                            newCamp.advertisor.email = body.fields.advertiserEmail
                        }

                        newCamp
                            .save()
                            .then(function(campaign) {
                                if (campaign) {
                                    res.json({
                                        success: true,
                                        message: "Campaign added successfully.",
                                        campaign: campaign
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
                    })
            }

            var promiseArray = [];
            if (body.files.length > 0) {
                for (var i = 0; i < body.files.length; i++) {
                    if (body.files[i].fieldname == "adFile") {
                        promiseArray.push(uploadAdFile)
                    } else if (body.files[i].fieldname == "artworkFile") {
                        promiseArray.push(uploadArtworkFile)
                    }
                }
            }
            if (promiseArray.length > 0) {
                Promise.all(promiseArray)
                    .then(function(data) {
                        addCampaign();
                    });
            } else {
                addCampaign();
            }
        }
    }
    // API to add campaign step 2 Information
exports.createCampaignStep2 = function(req, res) {
    const id = req.body.campaignId
    const token = req.body.token
    const customerId = req.body.customerId
    Campaign.findById(id)
        .then((campaign) => {
            if (token !== "" && customerId === "") {
                // Stripe API to create a customer
                stripe.customers.create({
                    source: token,
                    email: campaign.advertisor.email
                }, function(err, customer) {
                    if (err) {
                        res.status(403).send({
                            success: false,
                            message: "Error in processing your request."
                        });
                    } else {
                        var custid = customer.id;
                        if (custid) {
                            // Stripe API to charge a user for entered amount
                            stripe.charges.create({
                                    amount: req.body.payDetails.amount * 100,
                                    currency: "usd",
                                    customer: custid,
                                })
                                .then(function(charge) {
                                    var amount = req.body.payDetails.amount
                                    var impressionCount = req.body.payDetails.impressionCount
                                    var amountPerImpression = (amount / impressionCount)
                                    Campaign.findOneAndUpdate({
                                            _id: id
                                        }, {
                                            'advertisor.primaryaddress': {
                                                state: req.body.payDetails.state,
                                                city: req.body.payDetails.city,
                                                streetAddress: req.body.payDetails.streetAddress,
                                                zip: req.body.payDetails.zip,
                                                aptNumber: req.body.payDetails.aptNumber
                                            },
                                            'advertisor.billingAddress': {
                                                state: req.body.payDetails.billingState,
                                                city: req.body.payDetails.billingCity,
                                                streetAddress: req.body.payDetails.billingStreetAddress,
                                                zip: req.body.payDetails.billingZip,
                                                aptNumber: req.body.payDetails.billingAptNumber
                                            },
                                            'advertisor.customerId': custid,
                                            'advertisor.isDifferentBillingAddress': req.body.payDetails.differentBilling,
                                            'ads.isActive': true,
                                            'campaign.startDate': new Date(req.body.payDetails.startDate),
                                            'campaign.endDate': new Date(req.body.payDetails.endDate),
                                            'campaign.impressionCount': impressionCount,
                                            'campaign.amount': amount,
                                            'campaign.amountPerImpression': amountPerImpression,
                                            'campaign.isOverAge': req.body.payDetails.overage,
                                            'campaign.overAgeCap': req.body.payDetails.overageCap,
                                            'campaign.payment': charge,
                                            'campaign.createDate': new Date(),
                                            'campaign.updatedDate': new Date()
                                        }, {
                                            new: true
                                        })
                                        .then((camp) => {
                                            if (!camp) {
                                                res.status(403).send({
                                                    success: false,
                                                    message: "No campaign found."
                                                });
                                            } else {
                                                var strHTML = ''
                                                let campaignPromise = Campaign.find({ 'advertisor.email': campaign.advertisor.email })
                                                    .then((campaigns) => {
                                                        strHTML = "<table border='1' cellPadding='5' cellSpacing='0' style='width:100%'>"
                                                        strHTML += "<tr>"
                                                        strHTML += "<th>Campaign Start Date</th>"
                                                        strHTML += "<th>Campaign End Date</th>"
                                                        strHTML += "<th>Amount</th>"
                                                        strHTML += "</tr>"
                                                        campaigns.forEach(function(s) {
                                                            const startDate = moment(s.campaign.startDate).format('ll')
                                                            const endDate = moment(s.campaign.endDate).format('ll')
                                                            strHTML += "<tr>"
                                                            strHTML += "<td allign='center'>" + startDate + "</td>"
                                                            strHTML += "<td allign='center'>" + endDate + "</td>"
                                                            strHTML += "<td allign='center'>" + '$' + s.campaign.amount + "</td>"
                                                            strHTML += "</tr>"
                                                        })
                                                        strHTML += "</table>"
                                                        return strHTML
                                                    })
                                                return Promise.all([campaignPromise])
                                                    .spread((campaignPromise) => {
                                                        EmailService.sendCampaignPaymentMail(charge, camp, campaignPromise, function(result) {
                                                            res.json({
                                                                success: true,
                                                                message: "Changes saved successfully.",
                                                                campaign: camp
                                                            });
                                                        });
                                                    })
                                            }
                                        })
                                });
                        }
                    }
                });
            } else {
                // Stripe API to Charge the user for entered amount
                stripe.charges.create({
                        amount: req.body.payDetails.amount * 100,
                        currency: "usd",
                        customer: customerId,
                    })
                    .then(function(charge) {
                        var amount = parseFloat(req.body.payDetails.amount)
                        var impressionCount = parseInt(req.body.payDetails.impressionCount)
                        var overageImpressionCount = impressionCount
                        if (req.body.payDetails.overage && parseInt(req.body.payDetails.overageCap) > 0) {
                            overageImpressionCount = parseInt(parseInt(overageImpressionCount) + parseInt(req.body.payDetails.overageCap))
                        }
                        var amountPerImpression = (amount / overageImpressionCount)
                        Campaign.findOneAndUpdate({
                                _id: id
                            }, {
                                'campaign.startDate': new Date(req.body.payDetails.startDate),
                                'campaign.endDate': new Date(req.body.payDetails.endDate),
                                'campaign.impressionCount': parseInt(impressionCount),
                                'campaign.amount': amount,
                                'campaign.amountPerImpression': amountPerImpression,
                                'campaign.isOverAge': req.body.payDetails.overage,
                                'campaign.overAgeCap': parseInt(req.body.payDetails.overageCap),
                                'campaign.payment': charge,
                                'campaign.createDate': new Date(),
                                'campaign.updatedDate': new Date(),
                                'ads.isActive': true,
                                'advertisor.name': campaign.advertisor.name,
                                'advertisor.email': campaign.advertisor.email,
                                'advertisor.primaryaddress': {
                                    state: req.body.payDetails.state,
                                    city: req.body.payDetails.city,
                                    streetAddress: req.body.payDetails.streetAddress,
                                    zip: req.body.payDetails.zip,
                                    aptNumber: req.body.payDetails.aptNumber
                                },
                                'advertisor.billingAddress': {
                                    state: req.body.payDetails.billingState,
                                    city: req.body.payDetails.billingCity,
                                    streetAddress: req.body.payDetails.billingStreetAddress,
                                    zip: req.body.payDetails.billingZip,
                                    aptNumber: req.body.payDetails.billingAptNumber
                                },
                                'advertisor.customerId': customerId,
                                'advertisor.isDifferentBillingAddress': req.body.payDetails.differentBilling
                            }, {
                                new: true
                            })
                            .then((camp) => {
                                if (!camp) {
                                    res.status(403).send({
                                        success: false,
                                        message: "No campaign found."
                                    });
                                } else {
                                    var strHTML = ''
                                    let campaignPromise = Campaign.find({ 'advertisor.email': campaign.advertisor.email, 'campaign.payment': { $exists: true } })
                                        .then((campaigns) => {
                                            strHTML = "<table border='1' cellPadding='5' cellSpacing='0' style='width:100%'>"
                                            strHTML += "<tr>"
                                            strHTML += "<th>Campaign Start Date</th>"
                                            strHTML += "<th>Campaign End Date</th>"
                                            strHTML += "<th>Amount</th>"
                                            strHTML += "</tr>"
                                            campaigns.forEach(function(s) {
                                                const startDate = moment(s.campaign.startDate).format('ll')
                                                const endDate = moment(s.campaign.endDate).format('ll')
                                                strHTML += "<tr>"
                                                strHTML += "<td allign='center'>" + startDate + "</td>"
                                                strHTML += "<td allign='center'>" + endDate + "</td>"
                                                strHTML += "<td allign='center'>" + '$' + s.campaign.amount + "</td>"
                                                strHTML += "</tr>"
                                            })
                                            strHTML += "</table>"
                                            return strHTML
                                        })
                                    return Promise.all([campaignPromise])
                                        .spread((campaignPromise) => {
                                            EmailService.sendCampaignPaymentMail(charge, camp, campaignPromise, function(result) {
                                                res.json({
                                                    success: true,
                                                    message: "Changes saved successfully.",
                                                    campaign: camp
                                                });
                                            });
                                        })
                                }
                            })
                    });
            }
        })
}

//API to Edit Information of Step 1 of a Campaign
exports.editCampaignStep1 = function(req, res) {
        var aws = Config.config().aws;
        var adFileS3Url = '';
        var artworkS3Url = '';
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
            if (file) {
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
            //Uploading video/audio file to s3
            var uploadAdFile = new Promise(function(f, r) {
                var file = body.files.find(function(f) {
                    return f.fieldname == "adFile";
                })
                if (file) {
                    AWS.config.update({
                        accessKeyId: aws.key,
                        secretAccessKey: aws.secret,
                        region: aws.region
                    });
                    var s3 = new AWS.S3({
                        params: {
                            Bucket: aws.audio_input_bucket
                        }
                    });
                    var filename = 'campaign/' + file.newfilename;
                    var data = {
                        Key: filename,
                        Body: file.buffer,
                        ContentType: file.mimetype,
                        ACL: 'public-read'
                    };
                    s3.upload(data, function(err, resp) {
                        if (err) {
                            r(err);
                        } else {
                            var transcoder = new AWS.ElasticTranscoder({
                                region: aws.region
                            });
                            let params = {
                                PipelineId: aws.pipelineId,
                                Input: {
                                    Key: filename
                                },
                                Output: {
                                    Key: filename,
                                    PresetId: aws.VideoPresetId
                                }
                            };
                            if (body.fields.adFormat === "Audio") {
                                params.Output.PresetId = aws.PresetId
                            }
                            transcoder.createJob(params, function(err, transcodedata) {
                                if (transcodedata) {
                                    adFileS3Url = resp.Location.toString().replace(aws.audio_input_bucket, aws.audio_output_bucket);
                                    f(resp.Location);
                                } else {
                                    adFileS3Url = '';
                                    f('');
                                }
                            });
                        }
                    })
                }
            });
            //Uploading artwork file to s3
            var uploadArtworkFile = new Promise(function(f, r) {
                var file = body.files.find(function(f) {
                    return f.fieldname == "artworkFile";
                })
                if (file) {
                    AWS.config.update({
                        accessKeyId: aws.key,
                        secretAccessKey: aws.secret,
                        region: aws.region
                    });
                    var s3 = new AWS.S3({
                        params: {
                            Bucket: aws.bucket
                        }
                    });
                    var data = {
                        Key: 'campaign/' + file.newfilename,
                        Body: file.buffer,
                        ContentType: file.mimetype,
                        ACL: 'public-read'
                    };
                    s3.upload(data, function(err, resp) {
                        if (err) {
                            r(err);
                        } else {
                            artworkS3Url = resp.Location;
                            f(resp.Location);
                        }
                    })
                }
            });
            // Updates the Information of campaign step 1 
            function addCampaign() {
                var objAds = {
                    'ads.updatedDate': new Date(),
                    'ads.redirectUrl': body.fields.redirectUrl,
                    'advertisor.name': body.fields.advertiserName,
                    'advertisor.email': body.fields.advertiserEmail,
                    'ads.adDuration': body.fields.adDuration
                };

                if (adFileS3Url != "") {
                    objAds['ads.adFileUrl'] = adFileS3Url;
                    objAds['ads.adFormat'] = body.fields.adFormat;
                }

                if (artworkS3Url != "") {
                    objAds['ads.adArtworkUrl'] = artworkS3Url
                }

                Campaign.update({
                        _id: body.fields.id
                    }, {
                        $set: objAds
                    }, {
                        new: true
                    })
                    .then(function(campaign) {
                        if (campaign) {
                            res.json({
                                success: true,
                                message: "Changes saved successfully.",
                                campaign: campaign
                            });
                        } else {
                            res.status(403).send({
                                success: false,
                                message: "Error in processing your request."
                            });
                        }
                    })
            }

            var promiseArray = [];
            if (body.files.length > 0) {
                for (var i = 0; i < body.files.length; i++) {
                    if (body.files[i].fieldname == "adFile") {
                        promiseArray.push(uploadAdFile)
                    } else if (body.files[i].fieldname == "artworkFile") {
                        promiseArray.push(uploadArtworkFile)
                    }
                }
            }
            if (promiseArray.length > 0) {
                Promise.all(promiseArray)
                    .then(function(data) {
                        addCampaign();
                    });
            } else {
                addCampaign();
            }
        }
    }
    // API to update the information of step 2 of a campaign
exports.editCampaignStep2 = function(req, res) {
    const id = req.body.campaignId
    const token = req.body.token
    const customerId = req.body.customerId
    Campaign.findById(id)
        .then((campaign) => {
            if (campaign) {
                if (token !== "" && customerId === "") {
                    //Stripe API to create a customer 
                    stripe.customers.create({
                        source: token,
                        email: campaign.advertisor.email
                    }, function(err, customer) {
                        if (err) {
                            res.status(403).send({
                                success: false,
                                message: "Error in processing your request."
                            });
                        } else {
                            var custid = customer.id;
                            if (custid) {
                                var prevAmount = (campaign.campaign.amount ? campaign.campaign.amount : 0);
                                var currAmount = parseFloat(req.body.payDetails.amount)
                                if (currAmount != parseFloat(prevAmount)) {
                                    // Stripe API to charge a cutomer with the entered amount
                                    stripe.charges.create({
                                            amount: currAmount * 100,
                                            currency: "usd",
                                            customer: custid,
                                        })
                                        .then(function(charge) {
                                            updateCampaignInfo(charge)
                                        });
                                } else {
                                    updateCampaignInfo(null)
                                }
                            }
                        }
                    });
                } else {
                    var prevAmount = (campaign.campaign.amount ? campaign.campaign.amount : 0);
                    var currAmount = parseFloat(req.body.payDetails.amount)
                    if (currAmount != parseFloat(prevAmount)) {
                        // Stripe API to charge a cutomer with the entered amount
                        stripe.charges.create({
                                amount: currAmount * 100,
                                currency: "usd",
                                customer: customerId,
                            })
                            .then(function(charge) {
                                updateCampaignInfo(charge)
                            });
                    } else {
                        updateCampaignInfo(null)
                    }
                }
            }
            // Function to update the information of step 2 of a campaign
            function updateCampaignInfo(charge) {
                var prevAmount = (campaign.campaign.amount ? campaign.campaign.amount : 0);
                var currAmount = req.body.payDetails.amount
                var payment = (campaign.campaign.payment ? campaign.campaign.payment : {});
                if (charge !== null) {
                    payment = charge
                }

                if (parseFloat(currAmount) != parseFloat(prevAmount)) {
                    currAmount = (parseFloat(prevAmount) + parseFloat(currAmount))
                }
                var amount = parseFloat(currAmount)
                var impressionCount = parseInt(req.body.payDetails.impressionCount)
                var overageImpressionCount = impressionCount
                if (req.body.payDetails.overage && parseInt(req.body.payDetails.overageCap) > 0) {
                    overageImpressionCount = parseInt(parseInt(overageImpressionCount) + parseInt(req.body.payDetails.overageCap))
                }
                var amountPerImpression = (amount / overageImpressionCount)
                Campaign.findOneAndUpdate({
                        _id: id
                    }, {
                        'campaign.startDate': new Date(req.body.payDetails.startDate),
                        'campaign.endDate': new Date(req.body.payDetails.endDate),
                        'campaign.impressionCount': parseInt(impressionCount),
                        'campaign.amount': amount,
                        'campaign.amountPerImpression': amountPerImpression,
                        'campaign.isOverAge': req.body.payDetails.overage,
                        'campaign.overAgeCap': parseInt(req.body.payDetails.overageCap),
                        'campaign.payment': payment,
                        'campaign.updatedDate': new Date(),
                        'ads.isActive': true,
                        'advertisor.name': campaign.advertisor.name,
                        'advertisor.email': campaign.advertisor.email,
                        'advertisor.primaryaddress': {
                            state: req.body.payDetails.state,
                            city: req.body.payDetails.city,
                            streetAddress: req.body.payDetails.streetAddress,
                            zip: req.body.payDetails.zip,
                            aptNumber: req.body.payDetails.aptNumber
                        },
                        'advertisor.billingAddress': {
                            state: req.body.payDetails.billingState,
                            city: req.body.payDetails.billingCity,
                            streetAddress: req.body.payDetails.billingStreetAddress,
                            zip: req.body.payDetails.billingZip,
                            aptNumber: req.body.payDetails.billingAptNumber
                        },
                        'advertisor.customerId': customerId,
                        'advertisor.isDifferentBillingAddress': req.body.payDetails.differentBilling
                    }, {
                        new: true
                    })
                    .then((camp) => {
                        if (!camp) {
                            res.status(403).send({
                                success: false,
                                message: "No campaign found."
                            });
                        } else {
                            if (charge !== null) {
                                var strHTML = ''
                                let campaignPromise = Campaign.find({ 'advertisor.email': campaign.advertisor.email, 'campaign.payment': { $exists: true } })
                                    .then((campaigns) => {
                                        strHTML = "<table border='1' cellPadding='5' cellSpacing='0' style='width:100%'>"
                                        strHTML += "<tr>"
                                        strHTML += "<th>Campaign Start Date</th>"
                                        strHTML += "<th>Campaign End Date</th>"
                                        strHTML += "<th>Amount</th>"
                                        strHTML += "</tr>"
                                        campaigns.forEach(function(s) {
                                            const startDate = moment(s.campaign.startDate).format('ll')
                                            const endDate = moment(s.campaign.endDate).format('ll')
                                            strHTML += "<tr>"
                                            strHTML += "<td allign='center'>" + startDate + "</td>"
                                            strHTML += "<td allign='center'>" + endDate + "</td>"
                                            strHTML += "<td allign='center'>" + '$' + s.campaign.amount + "</td>"
                                            strHTML += "</tr>"
                                        })
                                        strHTML += "</table>"
                                        return strHTML
                                    })
                                return Bluebird.all([campaignPromise])
                                    .spread((campaignPromise) => {
                                        EmailService.sendCampaignPaymentMail(charge, camp, campaignPromise, function(result) {
                                            res.json({
                                                success: true,
                                                message: "Changes saved successfully.",
                                                campaign: camp
                                            });
                                        });
                                    })
                            } else {
                                res.json({
                                    success: true,
                                    message: "Changes saved successfully.",
                                    campaign: campaign
                                });
                            }
                        }
                    })
            }
        })
}

// API to make a campaign active or inActive
exports.activeCampaign = function(req, res) {
    Campaign.findOneAndUpdate({
            _id: req.params.id
        }, {
            $set: {
                'ads.isActive': req.body.isActive
            }
        }, {
            new: true
        })
        .then((campaign) => {
            if (!campaign) {
                res.status(403).send({
                    success: false,
                    message: "No campaign found."
                });
            } else {
                return res.json({
                    success: true,
                    message: "Changes saved successfully.",
                    campaign: campaign
                });
            }
        })
};

//Api to delete a Campaign
exports.deleteCampaign = function(req, res) {
    var id = req.params.id;
    Campaign.update({
        _id: id
    }, {
        $set: {
            'ads.deleted': true
        }
    }, function(err, doc) {
        if (err) {
            res.status(403).send({
                success: false,
                message: "Error in processing the request."
            });
        } else {
            return res.json({
                success: true,
                message: "Campaign deleted."
            });
        }
    });
};

//Api to get details of a campaign
exports.getCampaignDetail = function(req, res) {
    var id = req.params.id
    Campaign.findOne({ _id: id })
        .then(function(campaign) {
            if (campaign) {
                delete campaign.campaign.payment
                campaign = campaign.toJSON()
                campaign.card = {}
                if (campaign.advertisor.customerId != "") {
                    stripe.customers.retrieve(
                        campaign.advertisor.customerId,
                        function(err, customer) {
                            if (customer && customer.sources) {
                                campaign.card = customer.sources.data
                            }
                            res.json({
                                success: true,
                                message: "Campaign found.",
                                campaign: campaign
                            });
                        });
                } else {
                    res.json({
                        success: true,
                        message: "Campaign found.",
                        campaign: campaign
                    });
                }
            } else {
                res.status(403).send({
                    success: false,
                    message: "no campaign found"
                })
            }
        })
};

//Api to get Campaign listing
exports.fetchCampaign = function(req, res) {
    Settings.findOne({}, {
            'fieldsPerPage': 1
        })
        .then(function(fields) {
            var page = req.query.page ? req.query.page : 1
            let limit = fields.fieldsPerPage;
            skip = page - 1
            skip = skip * limit
            Campaign.count({
                    'ads.deleted': false
                })
                .then(function(count) {
                    let campaignCount = count
                    Campaign.find({
                            'ads.deleted': false
                        })
                        .skip(skip)
                        .limit(limit)
                        .lean()
                        .sort({ 'campaign.createDate': -1 })
                        .then(function(campaign) {
                            if (campaign) {
                                res.json({
                                    success: true,
                                    message: "Campaign found.",
                                    campaign: campaign,
                                    count: campaignCount,
                                    limit: limit
                                });
                            } else {
                                res.status(403).send({
                                    success: false,
                                    message: "no campaign found"
                                })
                            }
                        })
                })
        })
};

//Api to get all the Advertisers
exports.fetchAdvertisers = function(req, res) {
    Campaign.find({
            'ads.deleted': false,
            'ads.isActive': true
        }, { _id: 1, 'advertisor': 1 })
        .sort({ 'advertisor.name': 1 })
        .then(function(advertisors) {
            var results = [];
            if (advertisors && advertisors.length > 0) {
                advertisors.forEach(function(ad) {
                    var isExists = results.find(function(r) {
                        return r.label == ad.advertisor.name
                    })
                    if (!isExists) {
                        results.push({ value: ad._id, label: ad.advertisor.name })
                    }
                })
                res.json({
                    success: true,
                    message: "advertisors found.",
                    advertisors: results
                });
            } else {
                res.status(403).send({
                    success: false,
                    message: "no advertisors found"
                })
            }
        })
};

//Api to fetch random advertisement to display in the app to free users
exports.fetchAdvertisement = function(req, res) {
    var userId = req.headers['userid']
    var count = 0;
    if (userId) {
        userId = req.params.userId;
        User.findOne({
                _id: userId
            })
            .then(function(user) {
                if (user) {
                    //Used to reset the campign list which user already watch so that user can see the ads again
                    function loopAdvertisementForUser(user) {
                        user.campaigns = [];
                        user.save();
                        count++;
                        getAdvertisement(user);
                    }
                    //This function give advertisement data which is currently in active state and user never see it before
                    function getAdvertisement(user) {
                        Campaign.find({
                                _id: { $nin: user.campaigns },
                                'ads.isActive': true,
                                'ads.deleted': false,
                                'campaign.startDate': { $lte: new Date() },
                                'campaign.endDate': { $gte: new Date() }
                            })
                            .sort({ 'advertisor.name': 1 })
                            .then(function(campaigns) {
                                if (campaigns.length > 0) {
                                    //var campaign = campaigns[Math.floor(Math.random()*campaigns.length)];
                                    var campaign = null;
                                    campaign = campaigns.find(function(c) {
                                        var amountPerImpression = c.campaign.amountPerImpression;
                                        var impressionCount = parseInt(c.campaign.impressionCount)
                                        var viewCount = c.campaign.viewCount;
                                        var maxViewCount = Math.ceil(amountPerImpression * impressionCount);
                                        var overage = c.campaign.isOverAge;
                                        var overageCap = parseInt(c.campaign.overAgeCap);
                                        if (overage) {
                                            maxViewCount = parseInt(impressionCount + overageCap);
                                        }
                                        if (maxViewCount > viewCount) {
                                            return c;
                                        }
                                    })
                                    if (campaign) {
                                        if (!user.campaigns) {
                                            user.campaigns = [];
                                        }
                                        user.campaigns.push(campaign._id)
                                        user.save();
                                        var sDate = Utils.formatStartDate(new Date())
                                        var eDate = Utils.formatEndDate(new Date())
                                        CampaignStats.findOneAndUpdate({
                                                date: {
                                                    $gte: sDate,
                                                    $lte: eDate,
                                                },
                                                campaignId: campaign._id
                                            }, {
                                                date: new Date(),
                                                campaignId: campaign._id,
                                                $push: {
                                                    userId: user._id
                                                },
                                                $inc: { 'viewCount': 1 }
                                            }, {
                                                new: true,
                                                upsert: true
                                            })
                                            .then(function() {
                                                Campaign.update({
                                                        _id: campaign._id
                                                    }, {
                                                        $inc: { 'campaign.viewCount': 1 }
                                                    })
                                                    .then(function(camp) {
                                                        campaign = campaign.toJSON();
                                                        delete campaign.campaign
                                                        res.json({
                                                            success: true,
                                                            message: "Advertisement found.",
                                                            campaign: campaign
                                                        });
                                                    })
                                            })
                                    } else {
                                        if (count <= 2) {
                                            loopAdvertisementForUser(user)
                                        } else {
                                            res.json({
                                                success: false,
                                                message: "No Advertisement found.",
                                                campaign: {}
                                            });
                                        }
                                    }
                                } else {
                                    if (count <= 2) {
                                        loopAdvertisementForUser(user)
                                    } else {
                                        res.json({
                                            success: false,
                                            message: "No Advertisement found.",
                                            campaign: {}
                                        });
                                    }
                                }
                            })
                    }
                    getAdvertisement(user);
                }
            })
    } else {
        res.json({
            success: false,
            message: "unauthorized access",
            campaign: {}
        })
    }
};

//Api to update ad click count
exports.updateCampaignClickCount = function(req, res) {
    var campaignId = req.params.id
    var userId = req.headers['userid']
    Campaign.findOneAndUpdate({
            _id: campaignId
        }, {
            $inc: { 'campaign.clickCount': 1 }
        })
        .then(function(campaign) {
            if (campaign) {
                var sDate = Utils.formatStartDate(new Date())
                var eDate = Utils.formatEndDate(new Date())
                CampaignStats.findOneAndUpdate({
                        date: {
                            $gte: sDate,
                            $lte: eDate,
                        },
                        campaignId: campaignId
                    }, {
                        date: new Date(),
                        campaignId: campaignId,
                        $push: {
                            clickUserId: userId
                        },
                        $inc: { 'clickCount': 1 }
                    }, {
                        new: true,
                        upsert: true
                    })
                    .then(function(data) {
                        res.json({
                            success: true,
                            message: "Changes saved successfully."
                        });
                    })
            } else {
                res.status(403).send({
                    success: false,
                    message: "Campaign not found."
                });
            }
        })
}

//Api to send campaign performace report to advertiser via email.
exports.sendCampaignPerformanceReport = function(req, res) {
    var campaignId = req.params.id
    var aws = Config.config().aws;

    function GetLastWeekStart() {
        var today = moment();
        var daystoLastMonday = 0 - (1 - today.isoWeekday()) + 7;
        var lastMonday = today.subtract('days', daystoLastMonday);
        return lastMonday;
    }

    function GetLastWeekEnd() {
        var lastMonday = GetLastWeekStart();
        var lastSunday = lastMonday.add('days', 6);
        return lastSunday;
    }

    Campaign.findOne({
            _id: campaignId
        })
        .then(function(camp) {
            if (camp) {
                // function to get weekly report
                var getWeeklyReport = new Promise(function(f, r) {
                        var sDate = GetLastWeekStart()
                        var eDate = GetLastWeekEnd()
                        var currentDate = moment();
                        var diffDays = eDate.diff(sDate, 'days')
                        var arrPromise = [];
                        var dates = [];
                        for (var i = 0; i < diffDays + 1; i++) {
                            var d = moment(sDate).add(i, 'days')
                            dates.push(new Date(d))
                        }

                        dates.forEach(function(d, index) {
                            var start = Utils.formatStartDate(new Date(d))
                            var end = Utils.formatEndDate(new Date(d))
                            arrPromise.push(new Promise(function(resolve, reject) {
                                CampaignStats.findOne({
                                        campaignId: campaignId,
                                        date: {
                                            $gte: start,
                                            $lte: end
                                        }
                                    }, {
                                        date: 1,
                                        viewCount: 1
                                    })
                                    .then(function(stats) {
                                        var data = {
                                            key: moment(start).format('DD'),
                                            value: 0
                                        }
                                        if (stats) {
                                            data = {
                                                key: moment(start).format('DD'),
                                                value: stats.viewCount
                                            }
                                        }
                                        resolve(data)
                                    })
                            }))
                        });
                        Promise.all(arrPromise)
                            .then(function(results) {
                                var weekViewCount = 0
                                var weekData = {}
                                results.forEach(function(r) {
                                    weekViewCount += r.value
                                })
                                const bar = d3nBar({ data: results })
                                weekData.weekViewCount = weekViewCount
                                    // convert the svg image of graph to png
                                var svgBuffer = new Buffer(bar.svgString(), 'utf-8');
                                svg2png(svgBuffer)
                                    // upload image to s3
                                    .then(function(buffer) {
                                        var newName = (new Date()).valueOf();
                                        var newfilename = newName + '.png';
                                        AWS.config.update({
                                            accessKeyId: aws.key,
                                            secretAccessKey: aws.secret,
                                            region: aws.region
                                        });
                                        var s3 = new AWS.S3({
                                            params: {
                                                Bucket: aws.bucket
                                            }
                                        });
                                        s3.upload({
                                            Body: buffer,
                                            Key: 'campaign/' + newfilename,
                                            ACL: 'public-read'
                                        }, function(err, data1) {
                                            if (err) {
                                                console.log(err)
                                            }
                                            if (data1) {
                                                weekData.week_graph_url = data1.Location
                                                f(weekData)
                                            }
                                        })
                                    })
                            })
                    })
                    // Function to get Monthly Report of a Advertisement
                var getMonthlyReport = new Promise(function(f, r) {
                        var sDate = moment().startOf('month');
                        var eDate = moment();
                        var diffDays = eDate.diff(sDate, 'days')
                        var d = moment(sDate)
                        var arrPromise = [];
                        var dates = [];
                        var i = 0;
                        while (new Date(moment(d).format("MM/DD/YYYY")) < new Date(moment(eDate).format("MM/DD/YYYY"))) {
                            d = moment(sDate).add(i, 'days')
                            dates.push(new Date(d))
                            i++
                        }

                        dates.forEach(function(d, index) {
                            var start = Utils.formatStartDate(new Date(d))
                            var end = Utils.formatEndDate(new Date(d))
                            arrPromise.push(new Promise(function(resolve, reject) {
                                CampaignStats.findOne({
                                        campaignId: campaignId,
                                        date: {
                                            $gte: start,
                                            $lte: end
                                        }
                                    }, {
                                        date: 1,
                                        viewCount: 1
                                    })
                                    .then(function(stats) {
                                        var data = {
                                            // key: moment(start).format('MM DD YYYY'),
                                            key: moment(start).format('DD'),
                                            value: 0
                                        }
                                        if (stats) {
                                            data = {
                                                // key: moment(stats.date).format('MM DD YYYY'),
                                                key: moment(stats.date).format('DD'),
                                                value: stats.viewCount
                                            }
                                        }
                                        resolve(data)
                                    })
                            }))
                        });
                        Promise.all(arrPromise)
                            .then(function(results) {
                                var monthViewCount = 0
                                var monthData = {}
                                results.forEach(function(r) {
                                    monthViewCount += r.value
                                })
                                const bar = d3nBar({ data: results })
                                monthData.monthViewCount = monthViewCount
                                    //convert the svg image to png
                                var svgBuffer = new Buffer(bar.svgString(), 'utf-8');
                                svg2png(svgBuffer)
                                    .then(function(buffer) {
                                        var newName = (new Date()).valueOf();
                                        var newfilename = newName + '.png';
                                        AWS.config.update({
                                            accessKeyId: aws.key,
                                            secretAccessKey: aws.secret,
                                            region: aws.region
                                        });
                                        var s3 = new AWS.S3({
                                            params: {
                                                Bucket: aws.bucket
                                            }
                                        });
                                        s3.upload({
                                            Body: buffer,
                                            Key: 'campaign/' + newfilename,
                                            ACL: 'public-read'
                                        }, function(err, data1) {
                                            if (err) {
                                                console.log(err)
                                            }
                                            if (data1) {
                                                monthData.month_graph_url = data1.Location
                                                f(monthData)
                                            }
                                        })
                                    })
                            })
                    })
                    // bind the above promise function
                Promise.all([getWeeklyReport, getMonthlyReport])
                    .then(function(finalResult) {
                        EmailService.sendCampaignPerformanceReportToAdvertiser(camp, finalResult[0], finalResult[1], function(result) {
                            if (result) {
                                res.json({
                                    success: true,
                                    message: "Email updates sent successfully."
                                });
                            } else {
                                res.status(403).send({
                                    success: false,
                                    message: "Error in sending email updates."
                                });
                            }
                        });
                    })
            }
        })
}