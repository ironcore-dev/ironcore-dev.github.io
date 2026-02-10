# Cloud Controller Manager (IaaS)

[Cloud-Controller-Manager](https://kubernetes.io/docs/concepts/architecture/cloud-controller) (CCM) is the bridge 
between Kubernetes and a cloud-provider. CCM is responsible for managing cloud-specific infrastructure resources such 
as `Routes`, `LoadBalancer` and `Instances`. CCM uses the cloud-provider (IronCore in this case) APIs to manage these 
resources. The [cloud provider interface](https://github.com/kubernetes/cloud-provider/blob/master/cloud.go)
is implemented in the [`cloud-provider-ironcore`](https://github.com/ironcore-dev/cloud-provider-ironcore) repository.
Here is more detail on how these APIs are implemented in the IronCore IaaS cloud-provider for different objects.

## Node Lifecycle

The Node Controller within the CCM ensures that the Kubernetes cluster has an up-to-date view of the available `Nodes` 
and their status, by interacting with cloud-provider's API. This allows Kubernetes to manage workloads effectively and 
leverage cloud provider resources. 

Below is the detailed explanation on how APIs are implemented by `cloud-provider-ironcore` for `Node` instance.

### Instance Exists

- The `InstanceExists` method checks for the node existence. A Machine object from IronCore represents the Node instance.

### Instance Shutdown

- The `InstanceShutdown` method checks if the node instance is in shutdown state.

### Instance Metadata

The `InstanceMetadata` method returns metadata of a node instance, which includes:

- `ProviderID`: Provider is combination of ProviderName(Which is nothing but set to `IronCore`)
- `InstanceType`: InstanceType is set to referencing MachineClass name by the instance.
- `NodeAddresses`: Node addresses are calculated from the IP information available from NetworkInterfaces of the machine.
- `Zone`: Zone is set to referenced MachinePool name.


## Load Balancing for Services of Type LoadBalancer

A LoadBalancer service allows external access to Kubernetes services within a cluster, ensuring traffic is distributed
effectively. Within the CCM there is a controller that listens for Service objects of type LoadBalancer. It then
interacts with cloud provider specific APIs to provision, configure, and manage the load balancer. Below is the detailed
explanation on how APIs are implemented in IronCore cloud-provider.

### GetLoadBalancerName

- The `GetLoadBalancerName` method returns the LoadBalancer name based on the service name.

### Ensure LoadBalancer

- The `EnsureLoadBalancer` method gets the LoadBalancer name based on service name.
- It checks if an IronCore LoadBalancer object already exists. If not, it gets the `port`, `protocol`, and `ipFamily` information from the service and creates a new LoadBalancer object in IronCore.
- The newly created LoadBalancer is associated with the Network reference provided in the cloud configuration.
- A LoadBalancerRouting object is then created with the destination IP information retrieved from the nodes (note: LoadBalancerRouting is an internal object in IronCore). This information is used at the IronCore API level to describe the explicit targets in a pool that traffic is routed to.
- IronCore supports two types of LoadBalancer: `Public` and `Internal`. If the LoadBalancer needs to be of type Internal, you must set the `service.beta.kubernetes.io/ironcore-load-balancer-internal` annotation to true. Otherwise it is considered public.

### Update LoadBalancer

- The `UpdateLoadBalancer` method gets the LoadBalancer and LoadBalancerRouting objects based on service name.
- If there is any change in the nodes (added/removed), the LoadBalancerRouting destinations are updated.


### Delete LoadBalancer

- The `EnsureLoadBalancerDeleted` method gets the LoadBalancer name based on service name, checks if it exists, and deletes it.

## Managing Routes

The Route Controller within the CCM is specifically tasked with creating and maintaining network routes within the cloud
provider's infrastructure to enable pods on different nodes to communicate. IronCore cloud-provider implements below 
interfaces to ensure this functionality.

### Creating Routes

- The create route method retrieves the Machine object corresponding to the target node name.
- It iterates over all target node addresses and identifies the matching NetworkInterface using internal IPs.
- If a matching NetworkInterface is found, it proceeds with finding the prefix. If a prefix already exists, the route is already present.
- If the prefix is not found, it adds it to the NetworkInterface specification.

### Deleting Routes

- The delete route method retrieves the Machine object corresponding to the target node name.
- It iterates over all target node addresses and identifies the matching NetworkInterface using internal IPs.
- If a matching NetworkInterface is found, it attempts to remove the prefix.
- It checks for the prefix in the NetworkInterface spec and removes it if present.

### Listing Routes

- The list route method retrieves all NetworkInterfaces matching the given namespace, network, and cluster label.
- It iterates over each NetworkInterface and compiles route information based on its prefixes.
- It also verifies that the NetworkInterface is associated with a Machine reference and retrieves node addresses based on the Machine reference name.
- Based on all the collected information (Name, DestinationCIDR, TargetNode, TargetNodeAddresses), the Route list is returned.
