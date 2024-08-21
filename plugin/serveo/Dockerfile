FROM ubuntu:latest

ARG USER=user
ARG UID=1000
ARG GID=1000

ENV SUBDOMAIN=""
ENV CONTAINER="default"

ADD ./bin/entrypoint.sh /entrypoint.sh

RUN apt-get update && apt-get install -y autossh && \
    useradd -u $UID -m -d /home/$USER -s /bin/bash $USER && \
    chown -R $USER:$USER /home/$USER && \
    chmod 0755 /entrypoint.sh

USER $USER

ENTRYPOINT ["/entrypoint.sh"]
CMD autossh -oStrictHostKeyChecking=no -oUserKnownHostsFile=/dev/null -R "${SUBDOMAIN:+$SUBDOMAIN.serveo.net:}80:$CONTAINER:80" serveo.net
