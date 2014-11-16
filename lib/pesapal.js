/**
 *  Copyright (c) 2014 Salama AB
 *  All rights reserved
 *  Contact: aksalj@aksalj.me
 *  Website: http://www.aksalj.me
 *
 *  Project : pesapaljs
 *  File : pesapal
 *  Date : 10/2/14 8:55 AM
 *  Description :
 *
 *  See http://developer.pesapal.com/how-to-integrate/api-reference
 *
 */

/* */
var models = require('./internal/models');
var Consts = require('./internal/consts');
var URI = require('URIjs');

var PAYMENT_METHODS = {
    PesaPal: new models.PaymentMethod("PESAPAL", "PesaPal", "PesaPal Account", null, Consts.PAYMENT_METHODS.PESAPAL),
    MPesa: new models.PaymentMethod("MPESA", "MPesa", "Safaricom mobile payment", "220220", Consts.PAYMENT_METHODS.MPESA),
    Airtel: new models.PaymentMethod("ZAP", "Airtel Money", "Airtel mobile payment", "PESAPAL", Consts.PAYMENT_METHODS.AIRTEL_MONEY),
    Visa: new models.PaymentMethod("VISA", "Visa", "Visa Credit / Debit Card", null, Consts.PAYMENT_METHODS.VISA),
    MasterCard: new models.PaymentMethod("MASTERCARD", "MasterCard", "MasterCard Credit / Debit Card", null, Consts.PAYMENT_METHODS.MASTERCARD)
};


var PesaPal = function (options) {

    this.core = require('./internal/core');

    if(options) {
        options = options || {}; // TODO: See https://github.com/rjrodger/parambulator
        var debug = options.debug || false;
        var customUIPaymentMethods = [
            PAYMENT_METHODS.MPesa.tag,
            PAYMENT_METHODS.Airtel.tag,
            PAYMENT_METHODS.Visa.tag,
            PAYMENT_METHODS.MasterCard.tag
        ];
        this.core.setup(options.key, options.secret, debug, customUIPaymentMethods);
    }

    if(!this.core.ready()) throw new Error("Need to specify both consumer key and secret");
};


/**
 * Get payment listener middleware for express.
 * @param req
 * @param res
 * @param next
 */
PesaPal.prototype.paymentListener = function (req, res, next) {

    var options = {
        type: "CHANGE", // PesaPal Always Seems to Want CHANGE
        transaction: req.query[Consts.DATA_KEYS.transaction],
        reference: req.query[Consts.DATA_KEYS.reference],
        statusOnly: false
    };

    this.core.fetchPayment(options, function(err, payment) {
        // See http://developer.pesapal.com/how-to-integrate/ipn
        if(!err) {
            req.payment = payment;
            res.status(200).send(new URI(req.originalUrl).query());
        } else {
            req.payment = null;
            res.status(500).send(null);
        }
        next();
    });
};

/**
 * Get the status of a payment
 * @param options {{reference: string, transaction: string}}
 * @param callback
 */
PesaPal.prototype.paymentStatus = function (options, callback) {
    options.statusOnly = true;
    options.type = null;
    this.core.fetchPayment(options, callback);
};

/**
 * Get details of a payment
 * @param options {{reference: string, transaction: string}}
 * @param callback
 */
PesaPal.prototype.paymentDetails = function (options, callback) {
    options.statusOnly = false;
    options.type = null;
    this.core.fetchPayment(options, callback);
};


/**
 * Get the URL for the PesaPal payment page
 * @param order
 * @param callbackURI
 * @returns string
 */
PesaPal.prototype.getPaymentURL = function (order, callbackURI) {

    if(!order) throw new Error("No order specified");
    if(order.items.length === 0 && order.amount === 0) throw new Error("An order must have at least one(1) item");

    return this.core.generateSignedPaymentURL(order, callbackURI);
};


/**
 * Prepare an order
 * @param order Order
 * @param paymentMethod PaymentMethod
 * @param callback
 */
PesaPal.prototype.makeOrder = function(order, paymentMethod, callback) {
    return this.core.prepareOrder(order, paymentMethod, callback);
};

/**
 * Pay prepared order
 * @param order
 * @param callback
 * @param paymentData {MobileMoney | Card}
 */
PesaPal.prototype.payOrder = function(order, paymentData, callback) {
    return this.core.submitPayment(order, paymentData, callback);
};

/* Utils */
PesaPal.Utils = {

    /**
     * Utility to help not remember PesaPal's long HTTP query keys
     * @param key string {type | transaction | reference }
     * @returns {*}
     */
    getQueryKey: function(key) {
        if(Consts.DATA_KEYS.hasOwnProperty(key)) {
            return Consts.DATA_KEYS[key];
        } else {
            return null;
        }

    },

    /**
     * Find a payment method by tag
     * @param tag
     * @returns {*}
     */
    getPaymentMethodByTag: function (tag) {
        var found = null; // TODO: Need a simpler way!!!!
        PesaPal.PaymentMethod.forEach(function(method) {
            if(method.tag == tag) found = method;
        });
        return found;
    }
};

/* Models */
PesaPal.Customer = models.Customer;
PesaPal.Order = models.Order;
PesaPal.Item = models.Item;
PesaPal.PaymentMethod = PAYMENT_METHODS;
PesaPal.PaymentStatus = Consts.PAYMENT_STATUSES;
PesaPal.Card = models.Card;
PesaPal.MobileMoney = models.MobileMoney;

exports = module.exports = PesaPal;