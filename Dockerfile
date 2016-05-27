#############################################################
# DOCKERFILE FOR HTTP RELAY SERVICE
#############################################################
# DEPENDENCIES
# * NodeJS (provided)
#############################################################
# BUILD FLOW
# 3. Copy the service to the docker at /var/service
# 4. Run the default installation
# 5. Add the docker-startup.sh file which knows how to start
#    the service
#############################################################

FROM docker-registry.eyeosbcn.com/alpine6-node-base

ENV WHATAMI httprelay

ENV InstallationDir /var/service/

WORKDIR ${InstallationDir}

CMD eyeos-run-server --serf ${InstallationDir}/src/eyeos-http-relay-server.js

COPY . ${InstallationDir}

EXPOSE 1080

RUN apk update && apk add --no-cache curl make gcc g++ git python dnsmasq bash krb5-dev && \
    npm install --verbose --production && \
    npm cache clean && \
    apk del openssl ca-certificates libssh2 curl binutils-libs binutils gmp isl bash \
    libgomp libatomic pkgconf pkgconfig mpfr3 mpc1 gcc musl-dev libc-dev g++ expat krb5-dev \
    pcre git make libbz2 libffi gdbm ncurses-terminfo-base ncurses-terminfo ncurses-libs readline sqlite-libs python && \
    rm -rf /etc/ssl /var/cache/apk/* /tmp/*
