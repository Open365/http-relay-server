#############################################################
# DOCKERFILE FOR HTTP RELAY SERVICE
#############################################################
# DEPENDENCIES
# * NodeJS (provided)
#############################################################
# BUILD FLOW
# 3. Copy the service to the docker at /var/service
# 4. Run the default installatoin
# 5. Add the docker-startup.sh file which knows how to start
#    the service
#############################################################

FROM docker-registry.eyeosbcn.com/eyeos-fedora21-node-base

WORKDIR ${InstallationDir}

ENV WHATAMI httprelay

CMD eyeos-run-server --serf ${InstallationDir}/src/eyeos-http-relay-server.js

COPY . ${InstallationDir}

EXPOSE 1080

RUN npm install --verbose && \
    npm cache clean
