# CONTAINER_TOOL defines the container tool to be used for building images.
# Be aware that the target commands are only tested with Docker which is
# scaffolded by default. However, you might want to replace it to use other
# tools. (i.e. podman)
CONTAINER_TOOL ?= docker

# Docker image name for the VitePress based local development setup
IMAGE=ironcore-dev/ironcore-dev.github.io

.PHONY: startdocs
startdocs: ## Start the local VitePress based development environment.
	$(CONTAINER_TOOL) build -t $(IMAGE) -f docs/Dockerfile . --load
	$(CONTAINER_TOOL) run --rm -p 5173:5173 -v `pwd`/:/app -v /app/node_modules $(IMAGE)

.PHONY: cleandocs
cleandocs: ## Remove all local VitePress Docker images (cleanup).
	$(CONTAINER_TOOL) image prune --all --force --filter "label=project=ironcore_docs"
