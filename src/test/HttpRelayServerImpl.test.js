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

var proxyquire = require("proxyquire").noCallThru();
var sinon = require('sinon');
var assert = require('chai').assert;

suite('HttpRelayServerImpl', function() {
    var httpRelayServerImpl, relayerConnection, stubs, logger;
    var slash, destinationName, version = 'v1', url, sut, req;

    setup(function(){
        slash = '/';
        destinationName = 'destiny';
        version = 'v1';
        url = slash+destinationName+slash+version;
        req = {
            url: url
        };
        logger = {
            info: sinon.stub(),
            debug: sinon.stub(),
            error: sinon.stub()
        };

        process.exit = sinon.stub();

        relayerConnection = {
            on: sinon.stub()
        };

        stubs = {
            amqp: {createConnection: sinon.stub().returns(relayerConnection)},
            log2out: {getLogger: sinon.stub().returns(logger)}
        };

        httpRelayServerImpl = proxyquire("../lib/httpRelayServerImpl", stubs);
        sut = httpRelayServerImpl;
    });

    suite('#convertToBusMessage', function(){
        test('request destination is correctly parsed and set with no url params', function(){

            var busMsg = sut.convertToBusMessage(req);

            assert.equal(busMsg.url, url);
            assert.equal(busMsg.destination, destinationName+'.'+version);
            assert.deepEqual(busMsg.parameters, {});

        });

        test('request url parameters are correctly parsed and set', function(){
            req.url = req.url + '/param1/val1/param2/val2';

            var busMsg = sut.convertToBusMessage(req);

            assert.deepEqual(busMsg.parameters, {'param1': 'val1', 'param2': 'val2'});

        });

        test('request to relay routingKey can be set as url parameter', function(){
            req.url = req.url + '/param1/val1/param2/val2/routingKey/aRoutingKey';

            var busMsg = sut.convertToBusMessage(req);

            assert.equal(busMsg.routingKey, 'aRoutingKey');

        });

        test('request to relay routingKey can be set as url parameter', function(){
            req.url = req.url + '/param1/val1/param2/val2/routingKey/aRoutingKey';

            var busMsg = sut.convertToBusMessage(req);

            assert.equal(busMsg.routingKey, 'aRoutingKey');

        });

        test('request to relay routingKey can be set as an Http header', function(){
            req.headers = {'routingKey': 'aRoutingKey'};

            var busMsg = sut.convertToBusMessage(req);

            assert.equal(busMsg.routingKey, 'aRoutingKey');

        });

        test('http request fields: method, headers, url and body are directly mapped to busMsg', function(){
            var method = 'POST';
            var headers = {'h1': 'h2'};
            var body = 'a nice message';
            var newReq = Object.create(req);
            newReq.method = method;
            newReq.headers = headers;

            var busMsg = sut.convertToBusMessage(newReq, body);

            assert.equal(busMsg.method, method);
            assert.deepEqual(busMsg.headers, headers);
            assert.equal(busMsg.document, body);
        });
    });

    suite("#start", function () {
        var settings;

        setup(function () {
    	    settings = {};
    	});

        suite("when the amqp connection fails", function () {
            var err;

            setup(function () {
                err = new Error("BROKEN AMQP CONNECTION");
                relayerConnection.on.withArgs('error').callsArgWith(1, err);
            });
            
            test("should kill the service", function () {
                sut.start(settings);
                sinon.assert.called(process.exit);
            });
        });

        suite("when the amqp connection closes", function () {
            setup(function () {
                relayerConnection.on.withArgs('close').callsArg(1);
            });

            test("should kill the service", function () {
                sut.start(settings);
                sinon.assert.called(process.exit);
            });
        });
    });


});

