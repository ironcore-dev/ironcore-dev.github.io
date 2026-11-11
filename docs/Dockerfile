# NOTE: Once the base image is bumped to 27-alpine, it should ship with `npm@12`. Remove the
# explicit `npm install` below.
FROM node:26-alpine

LABEL project=ironcore_docs

# Install bash (optional but useful)
RUN apk add --no-cache bash

# Bump npm to latest stable
RUN npm install -g npm@12.2.2

# Set working directory
WORKDIR /app

# Expose dev port
EXPOSE 5173

# Default command to start VitePress dev
ENTRYPOINT ["./hack/start-docs.sh"]
