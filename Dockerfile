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

RUN /scripts-base/buildDependencies.sh --production --install && \
    npm install --verbose --production && \
    npm cache clean && \
    /scripts-base/buildDependencies.sh --production --purgue && \
    rm -rf /etc/ssl /var/cache/apk/* /tmp/*
