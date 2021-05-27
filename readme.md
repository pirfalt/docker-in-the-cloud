# Docker containers in the cloud, an easier way

Introduction. New project. Evaluating compute on azure.

TLDR: Both Azure and AWS have integrations with Docker which let's you `docker-compose.yml` files to configure production environments.

Azure Container Instances

- https://docs.microsoft.com/en-us/azure/container-instances/container-instances-overview
- https://docs.microsoft.com/en-us/azure/container-instances/quickstart-docker-cli

Docker

- https://docs.docker.com/cloud/aci-integration/
- https://docs.docker.com/cloud/ecs-integration/

## Docker overview

Linux program running in _well known_ environment.

Locked down network by default.

`docker` or `docker-compose` locally. "Real" orchestration in production, kubernetes, (docker swarm) or something cloud specific. Notice that we don't use `docker-compose` in production.

### Input

```sh
# Server and client, without docker
node app/index.js

curl http://localhost:8000/
```

### Build and image

```sh
docker build -t cloud-app:0.1 ./app

docker image ls cloud-app
```

### Server

```sh
# Start a local webserver
docker run --init cloud-app:0.1

# With open port
docker run --init -p 9000:8000 cloud-app:0.1

# Show
docker ps
```

### Client

```
curl http://localhost:8000/
curl http://localhost:9000/
```

### `docker-compose`

```sh
docker-compose --file local-app/docker-compose.yml up

docker-compose --file local-app-network/docker-compose.yml up
docker-compose --file local-app-network/docker-compose.yml up -- client
```

## Docker image hosting

- Public on docker hub.
- Private in a image repository.

```sh
## Show available cloud account
# Azure resource group using `azure-cli`
az group list --output table
# AWS profile using `aws-cli`
aws configure list-profiles
```

### AWS

```sh
# Create repository
aws --profile 'sandbox-emil.pirfalt' --region eu-west-1 \
    ecr create-repository --repository-name cloud-app

aws --profile 'sandbox-emil.pirfalt' --region eu-west-1 \
    ecr describe-repositories

# Login
image_repo='253680342693.dkr.ecr.eu-west-1.amazonaws.com'
login_password=$(aws --profile 'sandbox-emil.pirfalt' ecr get-login-password --region eu-west-1)
echo $login_password | docker login --username AWS --password-stdin $image_repo

# Tag and push
docker image ls cloud-app
docker image ls $image_repo/cloud-app

docker tag cloud-app:0.1 $image_repo/cloud-app:0.1
docker push $image_repo/cloud-app:0.1
```

### Azure

```sh
# Create repository
az acr create \
    --resource-group 'sandbox-emil.pirfalt' \
    --name 'jaywaysandboxemil' \
    --sku Basic

# Login
image_repo='jaywaysandboxemil.azurecr.io'
az acr login --name 'jaywaysandboxemil'

# Tag and push
docker image ls cloud-app
docker image ls $image_repo/cloud-app

docker tag cloud-app:0.1 $image_repo/cloud-app:0.1
docker push $image_repo/cloud-app:0.1
```

## Docker context

```sh
## Docker context
# Context help
docker context --help
docker context create --help

# List available docker context:s
docker context list

# Create a new docker context for the azure resource group
docker context create aci 'azure-jayway-sandbox' \
    --resource-group 'sandbox-emil.pirfalt' \
    --location 'westeurope'

# Create a new docker context for aws profile
docker context create ecs 'aws-jayway-sandbox' \
    --profile 'sandbox-emil.pirfalt'

# List available docker context:s again
docker context list
```

### Using docker context without compose

```sh
## Context
context='aws-jayway-sandbox'
context='azure-jayway-sandbox'

# Start a webserver
docker --context "$context" run -p 80:80 nginx:1.21-alpine

# Show & test
docker --context "$context" ps
host=$(docker --context "$context" ps --format json | jq '.[0].Ports[0] | split("->") | .[0]' -r)
echo $host
curl $host

# Start with domain name
docker --context "$context" run \
    --publish 80:80 \
    --name nginx-test-1 \
    --domainname 'jayway-sandbox-nginx-test-1' \
    nginx:1.21-alpine

curl 'jayway-sandbox-nginx-test-1.westeurope.azurecontainer.io'

# Start with domain name, detached
docker --context "$context" run \
    --publish 80 \
    --name nginx-test-2 \
    --domainname 'jayway-sandbox-nginx-test-2' \
    --detach \
    nginx:1.21-alpine

curl 'jayway-sandbox-nginx-test-2.westeurope.azurecontainer.io'
until curl 'jayway-sandbox-nginx-test-2.westeurope.azurecontainer.io' --connect-timeout 3 2> /dev/null; do printf . ; done
```

## `docker compose` (not `docker-compose`)

```
docker --help
docker compose --help
```

```sh
image_repo='jaywaysandboxemil.azurecr.io'
context='azure-jayway-sandbox'

image_repo='253680342693.dkr.ecr.eu-west-1.amazonaws.com'
context='aws-jayway-sandbox'
```

```sh
# Run in the cloud
docker --context $context compose --workdir cloud-app ps

time \
image_repo=$image_repo \
    docker --context $context compose --workdir cloud-app up

time \
image_repo=$image_repo \
    docker --context $context compose --workdir cloud-app down

# Inspect
docker --context $context compose --workdir cloud-app ps
host=$(
  docker --context $context compose --workdir cloud-app ps --format json | jq '.[0].Publishers[0].URL | split("->") | .[0]' -r
)

curl http://$host
```

## TLS (Bonus)

In network reverse proxy with tls termination.

```sh
# Azure
domainname='jayway-sandbox-emil'
host_url="$domainname.westeurope.azurecontainer.io"

# AWS
host_url=localhost
host_url=$(
  docker --context $context compose --workdir reverse-proxy-app ps --format json | jq '.[] | select(.Service == "revers-proxy").Publishers[0].URL | split(":") | .[0]' -r
)



domainname=$domainname \
image_repo=$image_repo \
host_url=$host_url \
    docker --context $context compose --workdir reverse-proxy-app up

docker --context $context compose --workdir reverse-proxy-app ps

domainname=$domainname \
image_repo=$image_repo \
host_url=$host_url \
    docker --context $context compose --workdir reverse-proxy-app down


echo $host_url
curl "https://$host_url"
```

## Discussion

Cons

- It's not "real" orchestration.
- It's more expensive than App Service (on Azure).
- No automatic scaling.
- It's less mature than App Service.
- _Much_ less configuration.

Pros

- _Much_ less configuration.
- It's _more_ cloud independent.
- It's _very_ similar to running locally.
