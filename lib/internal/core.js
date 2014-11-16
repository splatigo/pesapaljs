/**
 *  Copyright (c) 2014 Salama AB
 *  All rights reserved
 *  Contact: aksalj@aksalj.me
 *  Website: http://www.aksalj.me
 *
 *  Project : pesapaljs
 *  File : requester
 *  Date : 10/2/14 8:55 AM
 *  Description :
 *
 */
var OAuthSimple = require('oauthsimple');
var request = require('request');
var URL = require('url');
var URI = require('URIjs');
var Consts = require('./consts');
var PesaPalScraper = require('./scraper');

var DEBUG = false;

/* API Endpoints */
var ENDPOINTS = null;

var CONSUMER_KEY = null;
var CONSUMER_SECRET = null;

var CUSTOM_UI_PAYMENT_METHODS = [];

var cookieJar = request.jar();
var requestHeaders = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 6.3; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/37.0.2049.0 Safari/537.36' // Chrome 37
};


/**
 * Setup the module
 * @param key
 * @param secret
 * @param debug
 * @param customUIPaymentMethods
 */
exports.setup = function (key, secret, debug, customUIPaymentMethods) {

    DEBUG = debug;

    CONSUMER_KEY = key;
    CONSUMER_SECRET = secret;

    ENDPOINTS = DEBUG ? Consts.ENDPOINTS.DEMO : Consts.ENDPOINTS.LIVE ;

    CUSTOM_UI_PAYMENT_METHODS = customUIPaymentMethods || [];

    if(DEBUG) {
        require('request-debug')(request);
    }
};

/**
 * Check if core is ready
 * @returns {boolean}
 */
exports.ready = function () {
    return CONSUMER_KEY !== null && CONSUMER_SECRET !== null;
};


/**
 * Prepare xml to be sent as a query parameter
 * @param xml
 * @returns {*}
 */
var prepareXML = function (xml) {
    var php = require('phpjs');
    return php.htmlentities(xml, "ENT_NOQUOTES").replace(/"/g, "&quot;");
};


/**
 *
 * @param order
 * @param callbackURI
 * @returns string
 */
exports.generateSignedPaymentURL = function (order, callbackURI) {
    var signer = new OAuthSimple(CONSUMER_KEY, CONSUMER_SECRET);
    var rq = signer.sign({
        action: "GET",
        path: ENDPOINTS.direct_order,
        parameters: {
            oauth_callback: callbackURI,
            pesapal_request_data : prepareXML(order.toXML())
        }
    });
    return rq.signed_url;
};

/**
 * Get a payment information
 * @param params {{type: string, reference: string, transaction: string, statusOnly: boolean}}
 * @param callback
 */
exports.fetchPayment = function (params, callback) {

    params = params || {};

    var type = params.type || null;
    var reference = params.reference || null;
    var transaction = params.transaction || null;
    var statusOnly = true;
    if(params.statusOnly === false) statusOnly = false;

    if (!callback) throw new Error("No callback specified");
    if (!reference && !transaction) throw new Error("You must specify either a reference or a transaction or both.");

    var url = new URI(ENDPOINTS.payment_status);
    if (statusOnly == false) {
        url = new URI(ENDPOINTS.payment_details);
    }
    if (type) {
        url.addQuery(Consts.DATA_KEYS.type, type);
    }
    if (reference) {
        url.addQuery(Consts.DATA_KEYS.reference, reference);
    }
    if (transaction) {
        url.addQuery(Consts.DATA_KEYS.transaction, transaction);
    }

    var oauth = {
        consumer_key: CONSUMER_KEY,
        consumer_secret: CONSUMER_SECRET
    };

    request.get({url:url.toString(), oauth:oauth}, function (err, resp, body) {
        var data = null;
        if (!err) {
            // TODO: Parse data

            if(body.indexOf("Problem:") == 0) {
                err = new Error(body)
            } else {
                data = body.replace(Consts.DATA_KEYS.response + "=", '');
                if (!statusOnly) {
                    // data=pesapal_transaction_tracking_id,payment_method,payment_status,pesapal_merchant_reference
                    var segments = data.split(',');
                    data = {
                        transaction: segments[0],
                        method: segments[1],
                        status: segments[2],
                        reference: segments[3]
                    };
                }
            }
        }
        callback(err, data);
    });
};

/**
 *
 * @param order
 * @param paymentMethod
 * @param callback
 */
exports.prepareOrder = function (order, paymentMethod, callback) {
    if(!order) throw new Error("No order specified");
    if(order.items.length == 0 && order.amount == 0) throw new Error("An order must have at least one(1) item");
    if(!callback) throw new Error("Callback is required");

    paymentMethod = paymentMethod || order.getPaymentMethod();
    if(!paymentMethod) throw new Error("No payment method specified");

    if(CUSTOM_UI_PAYMENT_METHODS.indexOf(paymentMethod.tag) == -1) {
        throw new Error("Payment method not supported. Only MPesa, Airtel Money or Bank cards(Visa & MasterCard) are supported");
    }

    // Add this for possible use by a client
    order.setPaymentMethod(paymentMethod);

    var signer = new OAuthSimple(CONSUMER_KEY, CONSUMER_SECRET);
    var req = signer.sign({
        action: "GET",
        path: ENDPOINTS.direct_order,
        parameters: {
            oauth_callback: 'http://dummysite.se:8528/callback/',
            pesapal_request_data : prepareXML(order.toXML())
        }
    });

    request.get({url: req.signed_url, jar: cookieJar, headers: requestHeaders}, function (err, resp, body) {
        if(err) {
            callback(err, null);
        } else {

            try{ // TODO: Scrap PesaPal payment page

                if(body.indexOf("Problem:") == 0)  throw new Error(body);

                order._scraper = new PesaPalScraper(paymentMethod, body, DEBUG);

                requestHeaders.Referer = req.signed_url;

            }catch (error) {
                err = new Error(error);
            }

            callback(err, order);
        }
    });

};


/**
 * Send mobile money code / credit card details to PesaPal
 * @param order
 * @param paymentData {MobileMoney | Card}
 * @param callback
 */
exports.submitPayment = function(order, paymentData, callback) {

    if(!order._scraper) throw new Error("Invalid/Unprepared order");
    if(!paymentData) throw new Error("No Card/Transaction Info  Supplied");

    var params = order._scraper.paymentData;

    switch (order._scraper.paymentMethod) {
        case "VISA": // Credit / Debit Card
        case "MASTERCARD":

            params.FirstName = paymentData.firstName;
            params.LastName = paymentData.lastName;
            params.Email = paymentData.email;
            params.Country = paymentData.country;
            params.CountryCode = paymentData.countryCode;
            params.PhoneNumber = paymentData.phone;
            params.CreditCardNumber = paymentData.number;
            params.Cvv2Number = paymentData.cvv;
            params.ExpDateMonth = paymentData.expirationMonth;
            params.ExpDateYear = paymentData.expirationYear;
            break;

        default: // Mobile Money

            params.MobileNumber = paymentData.phone;
            params.TransactionCode = paymentData.code;
            break;
    }

    var parseResponse = function (err, resp, body) {
        if(err) {
            callback(err, null, null);
        } else if(resp.statusCode == 500) {
            callback(new Error("Failed to submit payment"), null, null);
        }else if (resp.statusCode == 200) { // Some error occurred, probably invalid code/card info
            callback(new Error("Check Payment Details"), null, null);
        } else if (resp.statusCode == 302) { // Do they send another status for redirect?

            // HUH: No need to redirect, they seem to include the reference and transaction id in the redirect URI
            var uri = URL.parse(resp.headers.location, true);
            uri = URL.parse(uri.query[Consts.DATA_KEYS.redirect_url], true); // http://dummysite.se:8528/callback/?pesapal_transaction_tracking_id=XXXX&pesapal_merchant_reference=XXXX

            var reference = uri.query[Consts.DATA_KEYS.reference]; // From redirect URI
            var transaction = uri.query[Consts.DATA_KEYS.transaction];

            if(!reference || !transaction)
                err = new Error("Unable to submit payment / No transaction ID returned");

            callback(err, reference, transaction);
        }
    };

    var url = order._scraper.url;
    switch (order._scraper.httpMethod.toUpperCase()) {
        case "POST":
            request.post({
                url: url,
                jar: cookieJar,
                headers: requestHeaders
            }, parseResponse).form(params);
            break;
        case "GET": // HUH: Not likely to happen!
        default:
            throw new Error("WTF PesaPal!");
    }
};

