# Networking

## Overview

IronCore's networking architecture is designed to provide a robust and flexible networking solution. It consists of 
several components that work together to ensure network out and inbound connectivity and isolation for `Machine` instances.

The main elements involved in IronCore's networking are:
- [**ironcore**](https://github.com/ironcore-dev/ironcore): Core networking component that manages network resources and configurations. For more details, see the 
  [Networking usage guide](/iaas/usage-guides/networking).
- [**ironcore-net**](https://github.com/ironcore-dev/ironcore-net): Global coordination service that manages network resource in an IronCore instance.
- [**metalnet**](https://github.com/ironcore-dev/metalnet): A service that provides cluster-level networking capabilities for `Machines`.
- [**dpservice**](https://github.com/ironcore-dev/dpservice): A service that manages data plane operations, including network traffic routing and policies.
- [**metalbond**](https://github.com/ironcore-dev/metalbond): A component that handles route annoucements in an IronCore instance, ensuring that networking routes are
    correctly propagated across the IronCore installation.

## `ironcore` and `ironcore-net`

`ironcore-net` is a global coordination service within an IronCore installation. Therefore, it is a single instance and 
the place where all network related decisions like reservation of unique IP addresses, allocation of unique network IDs, etc. are made.

`ironcore-net` has apart from its [own API](https://github.com/ironcore-dev/ironcore-net/tree/main/api/core/v1alpha1) two main components:
- **apinetlet**: This component is responsible from translating the user-facing API objects from the `networking` resource group into the 
  internal representation used by `ironcore-net`. 
- **metalnetlet**: This component is interfacing with the `metalnet` API to manage cluster-level networking resources like `NetworkInterface` which
  are requested globally in the `ironcore-net` API but are implemented by `metalnet` on a hypervisor level.

### Example `apinetlet` flow

When a user creates a `VirtualIP` resource in IronCore:

```yaml
apiVersion: networking.ironcore.dev/v1alpha1
kind: VirtualIP
metadata:
  name: virtualip-sample
spec:
  type: Public
  ipFamily: IPv4
```

The `apinetlet` will reconcile this `VirtualIP` by performing the following steps:
1. Create an `IP` object in the `ironcore-net` API, which reserves a unique IP address.
2. Update the `VirtualIP` status with the allocated IP address.

The `ironcore` API server is agnostic on how the underlying global IP address is allocated and delegates this responsibility 
to `ironcore-net`.

A similar flow happens for `Networks`, `LoadBalancer` and `NatGateways` resources, where the `apinetlet` is responsible
for translating and allocating the necessary resources in `ironcore-net` to ensure that the networking requirements are met.

### `metalnet` and `dpservice`

As mentioned above, `metalnet` is responsible for cluster-level networking capabilities. It provides the necessary API
to manage `Networks`, `NetworkInterfaces`, and other networking resources that are required for `Machines` on a hypervisor host.

TODO: describe how `metalnet` and `dpservice` work in detail and interact with each other.

![Cluster Level Networking](/cluster-networking.png)

### `metalnetlet` and `metalnet`

`metalnetlet` and `metalnet` work together to provide the necessary networking capabilities for `Machines` in an IronCore on 
a hypervisor host. In a compute cluster, the `metalnetlet` will create for each `Node` in the cluster a corresponding
`Node` object in the `ironcore-net` API. This `Node` object represents the hypervisor host and is used to manage the networking resources
which should be available on this host.

The image below illustrates the relationship between `metalnetlet` and `metalnet`:

![Provider Level Networking](/provider-networking.png)

The `NetworkInterface` creation flow will look like this:
1. A provider (in this case `libvirt-provider`) will create a virtual machine against the libvirt daemon on a hypervisor host.
In case a `NetworkInterface` should be attached to this virtual machine, the `machinepoollet` will call the corresponding
`AttachNetworkInterface` method on the [`MachineRuntime`](/iaas/architecture/runtime-interface#machineruntime-interface) 
interface implemented by the `libvirt-provider`. The `libvirt-provider` itself then has a plugin into the `ironcore-net` 
API to create a `NetworkInterface` resource in the `ironcore-net` API.
2. The `metalnetlet` will then watch for changes to the `NetworkInterface` resource and create the corresponding `NetworkInterface` 
object in the `metalnet` API using the `NodeName` of the hypervisor host where the virtual machine is running.
3. Once `metalnet` has created the virtual network interface on the hypervisor host, it will propagate the PCI address of this
virtual network interface back to the `ironcore-net` API by updating the status of the `NetworkInterface` resource.
4. The `libvirt-provider` will poll the `ironcore-net` API to get the updated status of the `NetworkInterface` and will 
use the PCI address in the status to attach the virtual network interface to the virtual machine instance.

`LoadBalancer` and `NATGateways` resources follow a similar flow. Here, however, the compute provider is not involved. 
The `apinetlet` will translate the `ironcore` `LoadBalancer` or `NATGateway` resource into the corresponding `ironcore-net`
objects. Those will be scheduled on `ironcore-net` `Nodes`. Onces this is done, the `metalnetlet` will watch those resources
and create the corresponding `LoadBalancer` or `NATGateway` objects in the `metalnet` API. 

### Role of `metalbond`

TODO: describe the role of `metalbond` in route announcements and how it interacts with `dpservice` and `metalnet`.
