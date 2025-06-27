# Kubernetes Integration

This section provides an overview of how you can run Kubernetes clusters on top of the Infrastructure as a Service layer
of IronCore.

## Provider Specific Integrations

The typical provider-specific integration points in Kubernetes are the following:

- **CNI**: Container Network Interface, used for networking in Kubernetes.
- **CSI**: Container Storage Interface, used for storage in Kubernetes.
- **CRI**: Container Runtime Interface, used for container runtimes in Kubernetes.
- **Loadbalancing**: Load balancing for services in Kubernetes.
- **Other Infrastructure specific Integrations**: This includes any other provider-specific integrations such as `Node` topology information.

As for CNI and CRI you can use almost any implementation that is compatible with Kubernetes.

For CSI, IronCore provider an own implementation of the [CSI interface](/iaas/kubernetes/csi-driver).

Additionally, the IronCore [Cloud Controller Manager](/iaas/kubernetes/cloud-controller-manager) provides the necessary
integration points of handling Loadbalancing and other provider specific integrations like the `Node` lifecycle and topology information.

## Gardener Integration

IronCore is also integrated with [Gardener](https://gardener.cloud/), a Kubernetes-native project for managing Kubernetes clusters at scale.
The section on [Gardener Integration](/iaas/kubernetes/gardener) provides more details on how to use IronCore with Gardener.
