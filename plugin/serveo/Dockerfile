FROM ubuntu:latest

ARG USER=user
ARG UID=1000
ARG GID=1000
ENV SUBDOMAIN=""
ENV CONTAINER="default"

RUN apt-get update && apt-get install -y sudo autossh
RUN useradd -u $UID -m -d /home/$USER -s /bin/bash $USER && \
    adduser $USER sudo && \
    echo '%sudo ALL=(ALL) NOPASSWD:ALL' >> /etc/sudoers

ADD ./bin/entrypoint.sh /entrypoint.sh
RUN chmod 0755 /entrypoint.sh

USER $USER

ENTRYPOINT ["/entrypoint.sh"]
CMD autossh -R "${SUBDOMAIN:+$SUBDOMAIN.serveo.net:}80:$CONTAINER:80" serveo.net
