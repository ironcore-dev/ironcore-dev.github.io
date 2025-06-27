# Cloud Controller Manager (Bare Metal)

[Cloud-Controller-Manager](https://kubernetes.io/docs/concepts/architecture/cloud-controller) (CCM) is the bridge
between Kubernetes and a cloud-provider. CCM uses the cloud-provider (IronCore Bare Metal API in this case) API to manage these
resources. We have implemented the [cloud provider interface](https://github.com/kubernetes/cloud-provider/blob/master/cloud.go)
in the [`cloud-provider-metal`](https://github.com/ironcore-dev/cloud-provider-metal) repository.
Here's a more detail on how these APIs are implemented in the IronCore bare metal cloud-provider for different objects.

## Node lifecycle

### InstanceExists

`InstanceExists` checks if a node with the given name exists in the cloud provider. In IronCore bare metal a `Node`
is represented by a `ServerClaim` object. The `InstanceExists` method checks if a `ServerClaim` with the given name exists.

### InstanceShutdown

`InstanceShutdown` checks if a node with the given name is shutdown in the cloud provider. Here, the instane controller
checks if the `ServerClaim` and the claimed `Server` object are in the `PowerOff` state.

### InstanceMetadata

`InstanceMetadata` retrieves the metadata of a node with the given name. In IronCore bare metal, this method retrieves
the topology labels from a `Server` object which is claimed by the `ServerClaim` of the node. Additional labels of the
`Server` object are also added to the node object.
