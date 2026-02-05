FROM php:8.4-cli-alpine

ENV EXPOSE_TOKEN=""
ENV EXPOSE_SUBDOMAIN=""
ENV EXPOSE_SERVER="sharedwithexpose.com"
ENV CONTAINER="default"
ENV PORT="80"

ADD ./bin/entrypoint.sh /entrypoint.sh

RUN apk add --no-cache curl libcap && \
    curl -Lo /usr/local/bin/expose https://github.com/beyondcode/expose/raw/master/builds/expose && \
    chmod +x /usr/local/bin/expose && \
    chmod 0755 /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
#CMD ["/usr/local/bin/expose", "share", "$CONTAINER:$PORT", "--subdomain=$EXPOSE_SUBDOMAIN", "--server=$EXPOSE_SERVER"]
#CMD ["/usr/local/bin/expose", "share", "$CONTAINER:$PORT"]
