HTTP-Relayer Server Service
===========================

## Overview

The **HTTP-Relayer** is a microservice that receives HTTP requests and asynchronizes them by sending them to the bus and responding immediately.

URLs are expected in the form:
/destinationName/apiVersion/param1/value1/param2/value2 ...

HTTP Requests are:
* Authenticated via **eyeos-auth**
* Transform the request to RestUtils-like messages
* Extract the target exchange name from the URL  ***(currently, only exchanges are supported)***
* In case the user is unauthorized, forbidden to publish or the exchange is not found, the message, and error information is sent to a deadletter queue (see settings).
* Routing Key is extracted from urlParameters or HttpHeaders (in this order) or empty ''
* Message is sent to the exchange with routing key

### Notice:
When rabbitmq is able to authorize users by their card/signature, process.env.EYEOS_HTTP_RELAY_USE_GUEST_FOR_REQUEST_RABBIT_AUTH
should be set to false (default value).

## How to use it

Example of client-side usage:
```bash 
curl -X POST -H 'signature: slkdfjlskdjfslkdjfslkf' -H 'card: {"username": "papito", "expiration": 6767676767667676}' -d '{"papito": 1}' http://localhost:1080/presence/v1/param1/val1/par2/val2/par3/val3/par4/val4/routingKey/logout
```

The message is sent to exchange *presence.v1* with Routing Key *logout*. Authentication is done the usual with card 
and signature. 

### Install and run
**[spyke-mode]** configured for having a rabbitmq in localhost. change code for configuring a different one :-)
```bash
npm install
node main.js
```

### Development Mode
Will skip HTTP authorization of the card, but it will be checked for correct format.
```bash
 export EYEOS_DEVELOPMENT_MODE=true && node http-relay-server.js
```

## Quick help

* Install modules

```bash
    $ npm install
```

* Check tests

```bash
    $ ./tests.sh
```



