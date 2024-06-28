#!/bin/sh

if [ ! "$(ls -A ~/.ssh)" ]; then
    sudo ssh-keygen -q -t rsa -N '' -f ~/.ssh/id_rsa
fi

exec "$@"
