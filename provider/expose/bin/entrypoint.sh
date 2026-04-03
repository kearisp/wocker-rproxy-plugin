#!/usr/bin/env sh

if [ -n "$EXPOSE_TOKEN" ]; then
    expose token $EXPOSE_TOKEN
fi

expose share "http://$CONTAINER:$PORT"
