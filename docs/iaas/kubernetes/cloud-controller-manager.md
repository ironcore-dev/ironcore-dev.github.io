# Cloud Controller Manager

<a href="https://kubernetes.io/docs/concepts/architecture/cloud-controller/">Cloud-controller-manager</a> (CCM) is the bridge between Kubernetes and a cloud-provider. CCM is responsible for managing cloud-specific infrastructure resources such as `Routes`, `LoadBalancer` and `Instances`.
CCM uses the clou-provider (IronCore in this case) APIs to manage these resources.
We have implemented the <a href="https://github.com/kubernetes/cloud-provider/blob/master/cloud.go">cloud provider interface</a> in the <a href="https://github.com/ironcore-dev/cloud-provider-ironcore">cloud-provider-ironcore</a> repository. 
Here's a more detail on how these API's implemented in IronCore cloud-provider for different objects.


## Node lifecycle
The Node Controller within the CCM ensures that the Kubernetes cluster has an accurate and up-to-date view of the available nodes and their status, by interacting with cloud-provider's API. This allows Kubernetes to manage workloads effectively and leverage cloud provider resources. 

Below is the detailed explanation on how API's are implemented by cloud-provider-ironcore for Node instance.

**Instance Exists**

- InstanceExists method checks for the node existence. `Machine` object from IronCore represents the `Node` instance.

**Instance Shutdown**

- InstanceShutdown checks if the node instance is in shutdown state

**Instance Metadata**

InstanceMetadata returns metadata of a node instance, which includes :

- `ProviderID`:  Provider is combination of ProviderName(Which is nothing but set to `IronCore`)
- `InstanceType`:  InstanceType is set to referencing MachineClas name by the instance.
- `NodeAddresses`: Node addresses are calculated from the IP information available from NetworkInterfaces of the machine.
- `Zone`:  Zone is set to referenced MachinePool name.


## Load balancing for Services of type LoadBalancer
`LoadBalancer` service allows external access to Kubernetes services within a cluster, ensuring traffic is distributed effectively. Within the CCM there is a controller that listens for `Service` objects of type `LoadBalancer`. It then interacts with cloud provider specific API's to provision, configure, and manage the load balancer. Below is the detailed explaination on how API's are implemeted in IronCore cloud-provider.

**Get LoadBalancer Name**

- GetLoadBalancerName return LoadBalancer's name based on the service name

**Ensure LoadBalancer**

- EnsureLoadBalancer gets the LoadBalancer name based on service name.
- Checks if IroncCore `LoadBalancer` object already exists. If not it gets the `port` and `protocol`,  `ipFamily` information from the service and creates new LoadBalancer object in the Ironcore. 
- Newly created LoadBalancer will be associated with Network reference provided in cloud configuration.
- Then `LoadBalancerRouting` object is created with the destination IP information retrieved from the nodes (Note: `LoadBalancerRouting` is internal object to Ironcore). Later this information is used at the Ironcore API level to describe the explicit targets in a pool traffic is routed to.
- Ironcore supports two types of LoadBalancer `Public` and `Internal`. If LoadBalancer has to be of type Internal, "service.beta.kubernetes.io/ironcore-load-balancer-internal" annotation needs to be set to true, otherwise it will be considered as public type.

**Update LoadBalancer**

- UpdateLoadBalancer gets the `LoadBalancer` and `LoadBalancerRouting` objects based on service name.
- If there is any change in the nodes(added/removed), LoadBalancerRouting destinations are updated.


**Delete LoadBalancer**

- EnsureLoadBalancerDeleted gets the LoadBalancer name based on service name, check if it exists and deletes it.

## Managing Routes
The Route Controller within the CCM is specifically tasked with creating and maintaining network routes within the cloud provider's infrastructure to enable pods on different nodes to communicate. IronCore cloud-provider implements below interfaces to ensure this functionality.

**Creating Routes**

- Create route method retrieve the machine object corresponding to the target node name. 
- Iterates over all target node addresses and identify the matching network interface using internal IPs.
- If a matching network interface is found, proceed with finding prefix. If prefix already exist that means route is already present.
- If the prefix is not found, adds it to the network interface specification.

**Deleting Route**

- Delete route method retrieve the machine object corresponding to the target node name. 
- Then iterates over all target node addresses and identify the matching network interface using internal IPs.
- If a matching network interface is found, attempt to remove the prefix.
- Checks for the prefix in the network interface's spec and remove it if present.

**List Routes**

- List route method retrieves all the network interfaces matching the given namespace, network, and cluster label.
- Iterates over each network interface and compile route information based on its prefixes.
- It also verifies that the network interface is associated with a machine reference and retrieves node addresses based on the machine reference name. 
- Based on all the collected information(Name, DestinationCIDR, TargetNode, TargetNodeAddresses) `Route` list is returned.
