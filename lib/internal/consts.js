/**
 *  Copyright (c) 2014 Salama AB
 *  All rights reserved
 *  Contact: aksalj@aksalj.me
 *  Website: http://www.aksalj.me
 *
 *  Project : pesapaljs
 *  File : static.js
 *  Date : 11/16/14 2:06 PM
 *  Description : PesaPal constants
 *
 */

exports.ENDPOINTS = {
    DEMO: {
        payment_status: "http://demo.pesapal.com/api/querypaymentstatus",
        payment_details: "http://demo.pesapal.com/api/querypaymentdetails",
        direct_order: "http://demo.pesapal.com/api/postpesapaldirectorderv4"
    },
    LIVE: {
        payment_status: "https://www.pesapal.com/API/QueryPaymentStatus",
        payment_details: "https://www.pesapal.com/API/QueryPaymentDetails",
        direct_order: "https://www.pesapal.com/API/PostPesapalDirectOrderV4"
    }
};

exports.DATA_KEYS = {
    type: "pesapal_notification_type", // for IPN only
    transaction: "pesapal_transaction_tracking_id",
    reference: "pesapal_merchant_reference",
    request: "pesapal_request_data", // for direct order only
    response: "pesapal_response_data",
    redirect_url: "url" // for when submitting payment data
};

exports.PAYMENT_STATUSES = {
    COMPLETED: "COMPLETED",
    PENDING: "PENDING",
    FAILED: "FAILED"
};

exports.PAYMENT_METHODS = {
    MPESA: null, //"MPESA",
    AIRTEL_MONEY: null, //"ZAP",
    VISA: "CREDITCARD",
    MASTERCARD: "CREDITCARDMC",
    PESAPAL: null//"EWALLET" // HUH: ??
};