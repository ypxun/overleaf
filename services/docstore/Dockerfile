# This file was auto-generated, do not edit it directly.
# Instead run bin/update_build_scripts from
# https://github.com/overleaf/internal/

FROM node:22.17.0 AS base

WORKDIR /overleaf/services/docstore

# Google Cloud Storage needs a writable $HOME/.config for resumable uploads
# (see https://googleapis.dev/nodejs/storage/latest/File.html#createWriteStream)
RUN mkdir /home/node/.config && chown node:node /home/node/.config

FROM base AS app

COPY package.json package-lock.json /overleaf/
COPY services/docstore/package.json /overleaf/services/docstore/
COPY libraries/ /overleaf/libraries/
COPY patches/ /overleaf/patches/

RUN cd /overleaf && npm ci --quiet

COPY services/docstore/ /overleaf/services/docstore/

FROM app
USER node

CMD ["node", "--expose-gc", "app.js"]
