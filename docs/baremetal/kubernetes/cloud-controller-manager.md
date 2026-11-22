# Cloud Controller Manager (Bare Metal)

[Cloud-Controller-Manager](https://kubernetes.io/docs/concepts/architecture/cloud-controller) (CCM) is the bridge
between Kubernetes and a cloud-provider. CCM uses the cloud-provider (IronCore Bare Metal API in this case) API to manage these
resources. The [cloud provider interface](https://github.com/kubernetes/cloud-provider/blob/master/cloud.go)
is implemented in the [`cloud-provider-metal`](https://github.com/ironcore-dev/cloud-provider-metal) repository.
Here is more detail on how these APIs are implemented in the IronCore bare metal cloud-provider for different objects.

## Node Lifecycle

### InstanceExists

The `InstanceExists` method checks if a node with the given name exists in the cloud provider. In IronCore bare metal, a Node
is represented by a ServerClaim object. The `InstanceExists` method checks if a ServerClaim with the given name exists.

### InstanceShutdown

The `InstanceShutdown` method checks if a node with the given name is shut down in the cloud provider. Here, the instance controller
checks if the ServerClaim and the claimed Server object are in the `PowerOff` state.

### InstanceMetadata

The `InstanceMetadata` method retrieves the metadata of a node with the given name. In IronCore bare metal, this method retrieves
the topology labels from a Server object that is claimed by the ServerClaim of the node. Additional labels of the
Server object are also added to the Node object.

## Pod CIDR Assignment

The Node reconciler can assign pod CIDRs to Nodes. This behavior is disabled by default. Set `--pod-prefix-size` to a positive
value to enable it; zero or a negative value disables pod CIDR assignment.

For a Node with an empty `spec.podCIDR`, the reconciler:

1. Resolves the Node's `spec.providerID` to the corresponding `ServerClaim`.
1. Retrieves the claimed `Server` and reads its `metadata.metal.ironcore.dev/prefix` annotation, which specifies the prefix
   assigned to the Server in CIDR notation.
1. Derives a pod prefix with the size configured by `--pod-prefix-size` and validates that it is contained within the Server's prefix.
1. Patches the Node's `spec.podCIDR` and `spec.podCIDRs` fields with the derived pod CIDR.

The reconciler does not overwrite an existing `spec.podCIDR`. If the claimed Server or its prefix annotation is unavailable,
the reconciler leaves the pod CIDR unset.
