FROM alpine:latest

ARG USER=ubuntu
ARG UID=1000
ARG GID=1000

ENV AUTOSSH_PORT="0"
ENV SUBDOMAIN=""
ENV CONTAINER="default"
ENV PORT="80"

ADD ./bin/entrypoint.sh /entrypoint.sh

RUN apk update && apk add --no-cache bash autossh && \
    adduser -u "$UID" -D "$USER" && \
    chown -R $USER:$USER /home/$USER && \
    chmod 0755 /entrypoint.sh

USER $USER

ENTRYPOINT ["/entrypoint.sh"]
CMD autossh -oStrictHostKeyChecking=no -oUserKnownHostsFile=/dev/null -R "${SUBDOMAIN:+$SUBDOMAIN.serveo.net:}80:$CONTAINER:$PORT" serveo.net
