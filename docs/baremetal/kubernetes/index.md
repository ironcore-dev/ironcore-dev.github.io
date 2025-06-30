# Kubernetes Integration

This section provides an overview of how you can run Kubernetes clusters on top of the Bare Metal API of IronCore.

## Provider Specific Integrations

The typical provider-specific integration points in Kubernetes are the following:

- **CNI**: Container Network Interface, used for networking in Kubernetes.
- **CSI**: Container Storage Interface, used for storage in Kubernetes.
- **CRI**: Container Runtime Interface, used for container runtimes in Kubernetes.
- **Loadbalancing**: Load balancing for services in Kubernetes.
- **Other Infrastructure specific Integrations**: This includes any other provider-specific integrations such as `Node` topology information.

As for CNI and CRI you can use almost any implementation that is compatible with Kubernetes.

For CSI, there is no IronCore bare metal-specific implementation of the CSI interface as we do not at the moment provide 
a dynamic provisioning of volumes for bare metal servers. However, you could use
the [local](https://kubernetes.io/docs/concepts/storage/volumes/#local) volume type to use local storage on the bare metal servers.
Alternatively, any local storage implementation that is compatible with Kubernetes can be used.

Additionally, the IronCore [Cloud Controller Manager](/baremetal/kubernetes/cloud-controller-manager) provides the necessary
integration points of handling the `Node` lifecycle and topology information.

Load balancing for `Services` of type `LoadBalancer` is done by the [metal-load-balancer-controller](/baremetal/kubernetes/metal-loadbalancer-controller).

## Cluster API Provider

The [Cluster API Provider for Bare Metal](https://github.com/ironcore-dev/cluster-api-provider-ironcore-metal) is
a Kubernetes project that provides a declarative way to manage bare metal clusters using the Cluster API (CAPI) framework.

More details on the Cluster API provider for bare metal can be found in the [Cluster API Provider](/baremetal/kubernetes/capi) section.

## Gardener Integration

IronCore is also integrated with [Gardener](https://gardener.cloud/), a Kubernetes-native project for managing Kubernetes clusters at scale.
The section on [Gardener Integration](/baremetal/kubernetes/gardener) provides more details on how to use IronCore with Gardener.
