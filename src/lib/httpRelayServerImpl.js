#!/usr/bin/env node
/*
    Copyright (c) 2016 eyeOS

    This file is part of Open365.

    Open365 is free software: you can redistribute it and/or modify
    it under the terms of the GNU Affero General Public License as
    published by the Free Software Foundation, either version 3 of the
    License, or (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU Affero General Public License for more details.

    You should have received a copy of the GNU Affero General Public License
    along with this program. If not, see <http://www.gnu.org/licenses/>.
*/

"use strict";

// eyeos requires
var EyeosAuth = require('eyeos-auth');

// node stdlib requires
var http = require('http');
var inspect = require('util').inspect;

// external requires
var uuid = require('node-uuid');
var log2out = require('log2out');
var amqp = require('amqp');

var settings;
var USE_GUEST_FOR_REQUEST_RABBIT_AUTH;
var busSettings;
var serviceName;
var deadletterName;
var deadletterQueueRk;
var deadletterQueueOptions;
var deadletterExchangeOptions;
var hostname;
var port;


var relayerConnection;
var relayerConnectionIsOk = false;
var deadletterExchange;
var auth = new EyeosAuth();
var httpServer;

var logger = log2out.getLogger('HttpRelayServer');

function _parseUrlPathParameters(parametersTxt) {
    var parameters = {};
    if(parametersTxt) {
        var parametersArr = parametersTxt.split('/');
        for (var i = 0; i < parametersArr.length; i = i + 2) {
            var key = parametersArr[i];
            var value = parametersArr[i + 1];
            parameters[key] = value;
        }
    }
    return parameters;
}

function getUrlElements(url){
    // URLs expected in the form: /destinationName/apiVersion/param1/value1/param2/value2...
    var relayerUrlRegexp = /^\/([a-zA-Z0-9_\.~-]+)\/([a-zA-Z0-9_\.~-]+)\/?(.*)?/;
    var parsedUrlElems = relayerUrlRegexp.exec(url);
    if ( !parsedUrlElems || parsedUrlElems.length < 2){
        logger.error('Error in request url:', url, 'parsedUrlElems:', parsedUrlElems);
        return null;
    }

    return {destinationName: parsedUrlElems[1]
        , apiVersion: parsedUrlElems[2]
        , urlPathParameters: _parseUrlPathParameters(parsedUrlElems[3])
    }
}

function convertToBusMessage(req, body) {

    var urlElems = getUrlElements(req.url);

    var routingKey = urlElems.urlPathParameters['routingKey'] || req.headers && req.headers['routingKey'] || '';
    return {
        url: req.url,
        destination: urlElems.destinationName + '.' + urlElems.apiVersion,
        routingKey: routingKey,
        parameters: urlElems.urlPathParameters,
        method: req.method,
        headers: req.headers,
        document: body
    }
}

function _prepareBusUserSettings(busMessage) {
    // prepares rabbitmq connection settings for the user making the request. using card for rabbitmq authentication.
    if (USE_GUEST_FOR_REQUEST_RABBIT_AUTH) {
        logger.warn('==============================================================================================');
        logger.warn('====>>> USE_GUEST_FOR_REQUEST_RABBIT_AUTH - request will not be properly authenticated <<<====');
        logger.warn('====>>>         using hardcoded user and password to connect to BUS for user request   <<<====');
        logger.warn('====>>>         TODO: disable when rabbit is able to authenticate users via card       <<<====');
        logger.warn('==============================================================================================');
    }
    return {
        login: USE_GUEST_FOR_REQUEST_RABBIT_AUTH ? settings.busSettings.login : busMessage.headers.card,
        password: USE_GUEST_FOR_REQUEST_RABBIT_AUTH ? settings.busSettings.password : busMessage.headers.signature,
        host: settings.busSettings.host,
        port: settings.busSettings.port
    }
}

function _closeConnection(connection, destinationName, callback) {
    connection.setImplOptions({reconnect: false});
    connection.removeAllListeners('error');
    connection.disconnect();
    connection.on('error', function () {
        logger.debug('- disconnected connection for ', destinationName)
    });
    callback();
}

function _sendToDeadletter(routingKey, busMessage, err, userBusSettings) {
    deadletterExchange.publish(routingKey, JSON.stringify({busMessage: busMessage, error: err, busSettings: userBusSettings}));
}

function _openBusConnectionAndExchangeThenSend(userBusSettings, destinationName, busMessage) {
    var connection = amqp.createConnection(userBusSettings); // disposable connection for this request.
    connection.on('ready', function () {
        logger.debug('Connection established for user request:', connection.options);
        var exchange = connection.exchange(destinationName, {passive: true}, function () {
            logger.debug('Exchange opened for user request:', exchange.name, ' => publishing message.', busMessage);
            exchange.publish(busMessage.routingKey, JSON.stringify(busMessage));
            _closeConnection(connection, destinationName);
        });
        exchange.on('error', function (err) {
            logger.warn('Error on exchange: ', destinationName, err);
            // error in exchange usually means that user has no permissions or exchange does not exist. send to deadletter.
            _sendToDeadletter(destinationName, busMessage, err, userBusSettings);
            _closeConnection(connection, destinationName);
        })
    });
    connection.on('error', function (err) {
        debugger;
        logger.error('Error connecting to RabbitMQ for request: ', busMessage, '\nRequest connection Settings:', userBusSettings, '\nError:', err);
        // if relayerConnection is OK, send to deadletter exchange, and cancel reconnect
        // if relayerConnection is KO, we lost connection to broker. Maintain reconnect=true, eventually it should work.
        if (relayerConnectionIsOk) {
            // disable reconnect, since autoreconnect was enabled, connection will raise a 2nd error
            // for that reason, remove all error listeners and add a dummy listener, since the error is being handled now.
            _closeConnection(connection, destinationName);
            err.code = 401;
            err.codeDescription = 'Unauthorized';
            deadletterExchange.publish(destinationName, JSON.stringify({busMessage: busMessage, error: err, busSettings: userBusSettings}));
        } else {
            logger.warn('Lost connection to RabbitMQ. Error trying to publish on exchange: ', destinationName);
        }
    });
}

function _relayHTTPRequestToBus(httpRequest, body) {
    var busMessage = convertToBusMessage(httpRequest, body);
    if (! busMessage) {
        var requestSummary = {headers: httpRequest.headers
            , httpVersion: httpRequest.httpVersion
            , url: httpRequest.url
            , method: httpRequest.method
            , body: body
        };
        _sendToDeadletter('bad-request', requestSummary, 400, null);
        return;
    }
    logger.debug('About to send message to bus: ', busMessage, ' bus settings: ');
    var userBusSettings = _prepareBusUserSettings(busMessage);
    var destinationName = busMessage.destination;
    _openBusConnectionAndExchangeThenSend(userBusSettings, destinationName, busMessage);
}

function _finishHttpResponse(res, reqId, responseCode, startTs) {
    res.writeHead(responseCode);
    res.end();
    var totalMs = new Date().getTime() - startTs;
    logger.debug("<<<< (req:%s) response for request: %d [%dms]", reqId, responseCode, totalMs);
}

function _handleHttpRequest(req, res){
    var startTs = new Date().getTime();
    var reqId = uuid.v1();
    var body = '';

    logger.debug(">>>> (req:%s) %s request on %s", reqId, req.method, req.url);

    if ( ! auth.verifyRequest(req) ) {
        logger.debug('HTTP request not authorized. URL[', req.url,'] method[', req.method,
            '] AUTH: {card:', req.headers.card, ' signature:', req.headers.signature, '}');
        _finishHttpResponse(res, reqId, 401, startTs);
        return;
    }

    function _relayToBusAndRespondRequest() {
        req = _addTIDHeader(req);
        _relayHTTPRequestToBus(req, body);
        _finishHttpResponse(res, reqId, 200, startTs);
    }

    req.on('data', function(chunk){
        body += chunk;
    });
    req.on('end', _relayToBusAndRespondRequest);
}

function _addTIDHeader(req) {
    if(!req.headers['X-eyeos-TID']) {
        req.headers['X-eyeos-TID'] = uuid.v4();
    };
    return req;
}

function _logError(description){
    return function(error){
        logger.error(description, error);
    }
}

function initializeBrokerResourcesAndThen(doCallback, busSettings) {
    // init relayerConnection, deadletter exchange, queue and bind them. doCallback() when finished.
    busSettings = busSettings || {};
    relayerConnection = amqp.createConnection(busSettings);
    relayerConnection.on('ready', function () {
        relayerConnectionIsOk = true;
        logger.info('Creating', deadletterName, 'in:', relayerConnection.options);
        var queue = relayerConnection.queue(deadletterName, deadletterQueueOptions, function (deadletterQueue) {
            deadletterExchange = relayerConnection.exchange(deadletterName, deadletterExchangeOptions, function () {
                queue.bind(deadletterName, deadletterQueueRk, function () {
                    logger.info('Created queue[', deadletterName, '] exchange [', deadletterName, '] and binded with Routing Key [', deadletterQueueRk, ']');
                    if (doCallback) {
                        doCallback();
                    }
                })
            });
            deadletterExchange.on('error', _logError('Error creating deadletter exchange:'));
        });
        queue.on('error', _logError('Error creating deadletter queue: '));
    });
    relayerConnection.on('error', function (err) {
        logger.error('Error connecting to broker: ' + inspect(busSettings) + "Error: " + err);

        // eyeos-run-server should restart the service
        process.exit(1);
    });

    relayerConnection.on('close', function () {
        logger.info('Closed connection to broker: ' + inspect(busSettings));

        // eyeos-run-server should restart the service
        process.exit(1);
    });
}

function startHttpServer(callback){
    var port = settings.relayerHttpPort;
    var hostname =  settings.relayerHttpHostname;
    function listeningCallback (){
        logger.info('%s service listening on [%s:%s]', serviceName, hostname, port);
        logger.info('%s service is UP and RUNNING ========================', serviceName);
        if (callback) {
            callback();
        }
    }

    httpServer.listen(port, hostname, 511, listeningCallback);
}

function initializeSettings(initSettings){
    logger.info("initializing with Settings:", inspect(initSettings));
    settings = initSettings;
    USE_GUEST_FOR_REQUEST_RABBIT_AUTH = settings.USE_GUEST_FOR_REQUEST_RABBIT_AUTH || false;
    busSettings = settings.busSettings;
    serviceName = settings.serviceName;
    deadletterName = settings.deadletterName;
    deadletterQueueRk = settings.deadletterQueueRk;
    deadletterQueueOptions = settings.deadletterQueueOptions;
    deadletterExchangeOptions = settings.deadletterExchangeOptions;
    hostname = settings.relayerHttpHostname;
    port = settings.relayerHttpPort;
}

function start(startSettings, callback) {

    initializeSettings(startSettings);

    function startHttpServerAndCb(){
        startHttpServer(callback);
    }

    httpServer = http.createServer(_handleHttpRequest);
    initializeBrokerResourcesAndThen(startHttpServerAndCb, busSettings);
}

function stop(callback){
    httpServer.close(function(){
        _closeConnection(relayerConnection, 'stopping httpRelayServer', callback);
    })
}

module.exports.start = start;
module.exports.stop = stop;
module.exports.convertToBusMessage = convertToBusMessage;
