FROM alpine:latest

ARG USER=user
ARG UID=1000
ARG GID=1000

RUN apk update && apk add --no-cache bash curl tar libstdc++ libc6-compat && \
    adduser -u "$UID" -D "$USER" && \
    chown -R $USER:$USER /home/$USER

SHELL ["/bin/bash", "-c"]
USER $USER

ENV NODE_VERSION 16.13.0
ENV NVM_DIR=/home/$USER/.nvm
ENV NODE_PATH=$NVM_DIR/versions/node/v$NODE_VERSION/bin

RUN touch /home/$USER/.bashrc && chmod +x /home/$USER/.bashrc && \
    echo $NODE_VERSION > /home/$USER/.nvmrc && \
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.5/install.sh | bash && \
    source /home/$USER/.bashrc && \
    nvm alias default $NODE_VERSION && \
    nvm use default && \
    npm install --quiet -g localtunnel

CMD ["bash"]
