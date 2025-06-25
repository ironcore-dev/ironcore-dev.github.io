# CONTAINER_TOOL defines the container tool to be used for building images.
# Be aware that the target commands are only tested with Docker which is
# scaffolded by default. However, you might want to replace it to use other
# tools. (i.e. podman)
CONTAINER_TOOL ?= docker

# Docker image name for the mkdocs based local development setup
IMAGE=ironcore-dev/ironcore-dev.github.io

.PHONY: startdocs
startdocs: ## Start the local mkdocs based development environment.
	docker build -t $(IMAGE) -f docs/Dockerfile . --load
	docker run --rm -p 5173:5173 -v `pwd`/:/app $(IMAGE)

.PHONY: cleandocs
cleandocs: ## Remove all local mkdocs Docker images (cleanup).
	docker container prune --force --filter "label=project=ironcore_docs"
