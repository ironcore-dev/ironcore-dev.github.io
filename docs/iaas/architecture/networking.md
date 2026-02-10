# Networking

## Overview

IronCore's virtual networking architecture provides an end-to-end virtual networking solution for provisioned `Machine`s running in data centers, regardless they are bare metal machines or virtual machines. It is designed to enable robust, flexible and performing networking control plane and data plane.

- **Robust**: IronCore's virtual networking control plane is mainly implemented using Kubernetes controller model. Thus, it is able to survive component's failure and recover the running states by retrieving the desired networking configuration.
- **Flexible**: Thanks to the modular and layered architecture design, IronCore's virtual networking solution allows developers to implement and interchange components from the most top-level data center management system built upon defined IronCore APIs, to lowest-level packet processing engines depending on the used hardware.
- **Performing**: The data plane of IronCore's virtual networking solution is built with the packet processing framework [DPDK](https://www.dpdk.org), and currently utilizes the hardware offloading features of [Nvidia's Mellanox SmartNic serials](https://www.nvidia.com/en-us/networking/ethernet-adapters/) to speedup packet processing. With the DPDK's run-to-completion model, IronCore's networking data plane can achieve high performance even in the environment where hardware offloading capability is limited or disabled.

IronCore's virtual networking architecture is illustrated with the following figure. It consists of several components that work together to ensure network out and inbound connectivity and isolation for `Machine` instances.

![IronCore Virtual Networking](/ironcore-net-overview.png)

The main elements involved in IronCore's networking are:
- [**ironcore**](https://github.com/ironcore-dev/ironcore): Core networking component that manages network resources and configurations. For more details, see the 
[Networking usage guide](/iaas/usage-guides/networking).
- [**ironcore-net**](https://github.com/ironcore-dev/ironcore-net): Global coordination service that manages network resource in an IronCore instance.
- [**metalnet**](https://github.com/ironcore-dev/metalnet): A service that provides cluster-level networking capabilities for `Machines`.
- [**dpservice**](https://github.com/ironcore-dev/dpservice): A service that manages data plane operations, including network traffic routing and policies.
- [**metalbond**](https://github.com/ironcore-dev/metalbond): A component that handles route announcements in an IronCore instance, ensuring that networking routes are
correctly propagated across the IronCore installation.

## `ironcore` and `ironcore-net`

The `ironcore-net` service is a global coordination service within an IronCore installation. Therefore, it is a single instance and
the place where all network-related decisions like reservation of unique IP addresses, allocation of unique network IDs, etc. are made.

The `ironcore-net` service has, apart from its [own API](https://github.com/ironcore-dev/ironcore-net/tree/main/api/core/v1alpha1), two main components:
- **apinetlet**: This component is responsible for translating the user-facing API objects from the `networking` resource group into the internal representation used by `ironcore-net`. 
- **metalnetlet**: This component is interfacing with the `metalnet` API to manage cluster-level networking resources like `NetworkInterface` which are requested globally in the `ironcore-net` API but are implemented by `metalnet` on a hypervisor level.

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

The `IronCore` API server is agnostic on how the underlying global IP address is allocated and delegates this responsibility 
to `ironcore-net`.

A similar flow happens for `Network`, `LoadBalancer` and `NatGateway` resources, where the `apinetlet` is responsible
for translating and allocating the necessary resources in `ironcore-net` to ensure that the networking requirements are met.

### `metalnetlet` and `metalnet`

The `metalnetlet` and `metalnet` components work together to provide the necessary networking capabilities for Machines in an IronCore instance on
a hypervisor host. In a compute cluster, the `metalnetlet` will create for each `Node` in the cluster a corresponding
Node object in the `ironcore-net` API. This Node object represents the hypervisor host and is used to manage the networking resources
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

LoadBalancer and NATGateway resources follow a similar flow. Here, however, the compute provider is not involved.
The `apinetlet` translates the IronCore LoadBalancer or NATGateway resource into the corresponding `ironcore-net`
objects. Those are scheduled on `ironcore-net` Nodes. Once this is done, the `metalnetlet` watches those resources
and creates the corresponding `LoadBalancer` or `NATGateway` objects in the `metalnet` API.

### `metalnet`, `dpservice` and `metalbond`

As mentioned above, `metalnet` is responsible for cluster-level networking capabilities. It provides the necessary API
to manage `Networks`, `NetworkInterfaces`, and other networking resources that are required for `Machines` on a hypervisor host. `dpservice` receives configurations, such as an activated interface with configured IP address or networking policies, via gRPC interfaces from `metalnet`. Meanwhile, `metalbond` is responsible for distributing encapsulation routes among instances of `metalnet`. 

The following figure depicts the basic working flow of creating two interfaces for the same virtual private network. 

![Metalnet Dpservice Metalbond](/metalnet-dpservice-metalbond.png)

The `metalnet` controllers watch the metalnet objects such as Network and NetworkInterface. Upon arrival of a new NetworkInterface, `metalnet` communicates with `dpservice` to obtain a newly generated underlying IPv6 address for a corresponding interface's overlay IP address. For example, on `Server-A`, `metalnet` obtains an underlying IPv6 address, `2001:db8::1`, for `interface-A` with a private IP `10.0.0.1`. This encapsulation routing information is announced by the embedded `metalbond-client` to `metalbond-server` running on a region router, and further synchronized by other `metalbond` instances. For instance, `metalbond` on `Server-B` receives this `10.0.0.1@2001:db8::1` information and pushes it into its local `dpservice` via gRPC. The `dpservice` uses this routing information to perform overlay packet encapsulation and decapsulation to achieve communication among VMs running on different servers. Meanwhile, `metalnet` also picks a PCI address of a VF, such as `0000:3b:00.2`, and attaches it as part of the NetworkInterface status, which is further used by `ironcore-net` and `libvirt-provider` to create a VM.
