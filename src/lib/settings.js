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

var settings = {
    EYEOS_DEVELOPMENT_MODE: process.env.EYEOS_DEVELOPMENT_MODE === 'true' || false,
	USE_GUEST_FOR_REQUEST_RABBIT_AUTH: process.env.EYEOS_HTTP_RELAY_USE_GUEST_FOR_REQUEST_RABBIT_AUTH === 'true' || true,
    relayerHttpHostname: process.env.EYEOS_HTTP_RELAY_HTTP_HOST || '0.0.0.0',
    relayerHttpPort: parseInt(process.env.EYEOS_HTTP_RELAY_HTTP_PORT, 10) || 1080,
    busSettings: {
        host: process.env.EYEOS_HTTP_RELAY_BROKER_HOST || 'rabbit.service.consul',
        port: parseInt(process.env.EYEOS_HTTP_RELAY_BROKER_PORT, 10) || 5672,
        login: process.env.EYEOS_BUS_MASTER_USER || 'guest',
        password: process.env.EYEOS_BUS_MASTER_PASSWD || 'guest'
    },
    serviceName: 'HTTP-Relay',
    deadletterName: 'http-relay.deadletter',
    deadletterQueueRk: '#',
    deadletterQueueOptions: {
        autoDelete: false,
        durable: true,
        arguments: {'x-max-length': 1000} //WARNING: to change this length, the queue in the broker has to be deleted.
    },
    deadletterExchangeOptions: {
        type: 'topic',
        durable: true
    }
};

module.exports = settings;