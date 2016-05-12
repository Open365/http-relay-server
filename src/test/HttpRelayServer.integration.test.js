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

'use strict';

/**
 * HttpRelayServer Integration Tests.
 * work in lazy mode:
 * if a rabbitmq is available with default settings in localhost, test is executed.
 * if rabbitmq is not available, test is skipped.
 */

var AMQPDeclarer = require('eyeos-amqp').AMQPDeclarer;
var request = require('request');
var sinon = require('sinon');
var assert = require('chai').assert;

process.env.EYEOS_DEVELOPMENT_MODE='true'; //setting development mode for both relayServer and eyeosAuth.
var settings = require('../lib/settings');
var httpRelayServer = require('../lib/httpRelayServerImpl');



suite('HttpRelayServer.integration', function(){
    var connectionSettings = {host:'localhost', port: 5672, login:'guest', password:'guest'},
        sut,
        declarer,
        rabbitAvailable = false,
        connection,
        queue;
    var destinationName = 'a.destination.httprelayserver.integration.test';
    var version = 'v1';
    var queueName = destinationName + '.' + version;
    var queueOptions = {durable: false};//, exclusive: true, autoDelete: true};
    var exchangeName = destinationName + '.' + version;
    var exchangeOptions = {type: 'fanout', durable: false, exclusive: true, autoDelete: true};


    setup(function(done){
        // initialize connection to local rabbit, if not present, skip the test.
        try {
            connection = require('amqp').createConnection(connectionSettings, {reconnect: false});
            connection.on('ready', function(){
                rabbitAvailable = true;
                declarer = new AMQPDeclarer(connection);
                declarer.declareExchange(exchangeName, exchangeOptions, function(){
                    declarer.declareQueue(queueName, queueOptions, function(q){
                        queue  = q;
                        queue.bind(exchangeName, '', function(){
                            httpRelayServer.start(settings, done);
                        });
                    })
                })
            });
            connection.on('error', function(err){
                console.log('********************* Skipping HttpRelayServer.integration test due to error: ', err);
                rabbitAvailable = false;
                done();
                return;
            });
        } catch (err){
            console.log('********************* Skipping HttpRelayServer.integration test due to error CATCHED: ', err);
        }
    });

    suite('#HttpRelayServer.Server', function(){
        setup(function(done){
            done();
        });

        teardown(function(done){
            done();
        });

        test('Http post publishes a message into the queue', function(done){
            if (!rabbitAvailable) {
                console.log('********************* Skipping HttpRelayServer.integration test due to Rabbit not available. THIS IS NOT AN ERROR.');
                return done();
            }

            var subscriptionSpy = sinon.spy();

            queue.subscribe(subscriptionSpy);

            var url = 'http://localhost:1080/'+destinationName + '/' + version;
            var requestObject = {method: 'POST'
                , 'content-type': 'application/json'
                , 'headers': {'card': '{"username": "amazing.user", "expiration": 676767676767676767676}'
                    , 'signature': 'random.signature.lskdfjuro35kljnvlw999459r'
                }
                , 'body': JSON.stringify({'foo': 'bar', 'this': 'self', 'that': 'this'})
            };
            request(url, requestObject, function (error, response, body) {
                assert.notOk(error, 'HTTP request not expected to return error.');
                assert.equal(response && response.statusCode, 200);
                console.log('*******************response.statusCode', response.statusCode);
            });

            setTimeout(function(){
                //give some time to rabbitmq, amqp client and code to do their work, then assert.
                assert.isTrue(subscriptionSpy.called, 'Expected to receive msg through subscription.');
                console.log("**************CALLED", subscriptionSpy.called);
                done();
            }, 200);
        });

    });
});

