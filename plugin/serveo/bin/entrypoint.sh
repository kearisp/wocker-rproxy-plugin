#!/bin/sh

if [ ! -e ~/.ssh/id_rsa -o ! -e ~/.ssh/id_rsa.pub ]; then
    ssh-keygen -q -t rsa -N '' -f ~/.ssh/id_rsa
fi

exec "$@"
