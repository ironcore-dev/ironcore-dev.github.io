# Networking Resources

## Network

A `Network` resource in IronCore refers to a logically isolated network (Layer 3). This further allows you to fully 
control your networking environment, including resource placement, connectivity, peering and security. 
The `NetworkReconciler` leverages this information to create a Network in the IronCore infrastructure.

### Example Network Resource

An example of how to define a `Network` resource in IronCore:

```yaml
apiVersion: networking.ironcore.dev/v1alpha1
kind: Network
metadata:
  name: network-sample
spec:
  peerings:
  - name: peering1
    networkRef:
      name: network-sample2
```

### Key Fields:
- `providerID`(`string`): Is the provider-internal ID of the network.
- `peerings`(`list`): Are the list of network peerings with this `Network` (optional).
- `incomingPeerings`(`list`): Is a list of `PeeringClaimRef`s which are peering claim references of other `Networks`.

### Reconciliation Process:

- **Network creation**: `ironcore-net` which is the network provider for IronCore realizes the `Network` resource via `apinetlet` controllers. When an IronCore `Network` is created, a corresponding `core.apinet.ironcore.dev/Network` is created in the apinet cluster. The name of the Network in the apinet cluster is the uid of the Network in the IronCore cluster.
  Once created and with an allocated ID, the IronCore `Network` will be patched with the corresponding provider ID of the apinet Network and set to state: `Available`. 
  Once the `Network` resource is in an available state. The format of a network provider ID is as follows:
  `ironcore-net://<namespace>/<name>/<id>/<uid>`

- **Network peering process**: Network peering is a technique used to interleave two isolated networks, allowing members of both networks to communicate with each
  other as if they were in the same networking domain, `NetworkPeeringController` facilitates this process.
    - Information related to the referenced `Network` to be paired with is retrieved from the `peering` part of the spec.
    - Validation is done to see if both Networks have specified a matching peering item (i.e. reference each other via `networkRef`) to mutually accept the peering.
    - The (binding) phase of a `spec.peerings` item is reflected in a corresponding `status.peerings` item with the same name.
      The phase can either be `Pending`, meaning there is no active peering or `Bound` meaning the peering as described in the `spec.peerings` item is in place.

- **Network Release Controller**: `NetworkReleaseController` continuously checks if claiming `Networks` in another Network's peerings section still exist if not present it will be removed from the `incomingPeerings` list.

## NetworkInterface

A `NetworkInterface` resource in IronCore represents a connection point between and a `Machine` and a virtual 
network. It encapsulates the configuration and life cycle management of the virtual network interface, ensuring 
seamless connectivity for `Machines`.

The `MachineEphemeralNetworkInterfaceReconciler` is responsible for managing the lifecycle of ephemeral network 
interfaces associated with `Machines`. Its primary function is to ensure that the actual state of these network 
interfaces aligns with the desired state specified in each machine's configuration.

### Example NetworkInterface Resource

An example of how to define a `NetworkInterface` resource in IronCore:

```yaml
apiVersion: networking.ironcore.dev/v1alpha1
kind: NetworkInterface
metadata:
  name: networkinterface-sample
spec:
  networkRef:
    name: network-sample
  ipFamilies:
    - IPv4
  ips:
    - value: 10.0.0.1 # internal IP
  virtualIP:
    virtualIPRef:
      name: virtualip-sample
```

### Key Fields

- `networkRef`(`string`): `NetworkRef` is the `Network` this `NetworkInterface` is connected to.
- `ipFamilies`(`list`): `IPFamilies` defines the list of IPFamilies this `NetworkInterface` supports. Supported values for IPFamily are `IPv4` and `IPv6`.
- `ips`(`list`): `IPs` are the list of provided internal IPs which should be assigned to this NetworkInterface
- `virtualIP`: `VirtualIP` specifies the public ip that should be assigned to this NetworkInterface.

### Reconciliation Process:

- **Generate Desired Ephemeral Network Interfaces**:
  Analyze the `Machine`'s specification to identify the desired ephemeral `NetworkInterface` resources.
  Construct a map detailing these desired `NetworkInterfaces`, including their configurations and expected states.

- **Fetch Existing NetworkInterfaces**:
  List all existing `NetworkInterface` resources within the same namespace as the Machine.

- **Compare and Reconcile**:
    - For each existing `NetworkInterface`:
      Determine if it is managed by the current `Machine` and whether it matches the desired state.
    - If unmanaged but should be managed, avoid adopting it to prevent conflicts.
    - For each desired `NetworkInterface` which is not present:
      Create the missing `NetworkInterface` and establish the Machine as its controller.

- **Handle Errors**:
  Collect any errors encountered during the reconciliation of individual `NetworkInterfaces`.
  Log these errors and schedule retries as necessary to ensure eventual consistency.

- **Update Status**:
  After reconciling all `NetworkInterfaces`, log the successful reconciliation and update the `NetworkInterface` 
  status with the corresponding values for `ips`, `state`, and `virtualIP`, as shown below.

```yaml
status:
  ips:
  - 10.0.0.1
  lastStateTransitionTime: "2025-01-13T11:39:17Z"
  state: Available
  virtualIP: 172.89.244.23
```

The `state` is updated as one of the following lifecycle states based on the reconciliation result
- **Pending**
- **Available**
- **Error**

## VirtualIP

A `VirtualIP` (VIP) in  the IronCore API is an abstract network resource representing an IP address that that is
allocated and kept during the lifetime of the `VirtualIP` resource. It can be associated with a `NetworkInterface`
of a `Machine` exposing this `Machine` e.g. to the public internet.

### Examaple VirtualIP Resource

An example of how to define a `VirtualIP` resource in IronCore:

```yaml
apiVersion: networking.ironcore.dev/v1alpha1
kind: VirtualIP
metadata:
  name: virtualip-sample
spec:
  type: Public
  ipFamily: IPv4
```

### Key Fields
- `type`(`string`): Currently supported type is `public`, which allocates and routes a stable public IP.
- `ipFamily`(`string`): `IPFamily` is the ip family of the `VirtualIP`. Supported values for IPFamily are `IPv4` and `IPv6`.


### Reconciliation Process:

- **VirtualIP Creation**:
  A VirtualIP resource is created, specifying attributes like `ipFamily`: IPv4 or IPv6 and `Type`: public

- **Reconciliation and IP Assignment**:
  The VirtualIP reconciler
  Creates or updates a corresponding `apinet` IP in IronCore's apinet system.
  Ensures the IP is dynamically allocated and made available for use.

- **Error Handling**:
  If the creation or update of the `apinet` IP fails, update the `VirtualIP` status to indicate it is unallocated.
  Requeue the reconciliation to retry the operation.

- **Synchronize Status**:
  Update the `VirtualIP` status to reflect the actual state of the `apinet` `IP`.
  If successfully allocated, update the status with the assigned IP address.

  for example:
  ```yaml
  status:
    ip: 10.0.0.1 # This will be populated by the corresponding controller.
  ```
  
- **Networking Configuration**:
    - `Machine` Integration: The allocated `VirtualIP` is associated with the `Machine` in the `VirtualIP` part of the `NetworkInterface` spec.
    - Load Balancer Integration: If a load balancer is used, the `VirtualIP` is configured as the frontend IP to route requests to the `Machine`.

## NATGateway

In the IronCore API, a `NATGateway` (Network Address Translation Gateway) facilitates outbound internet connectivity in
private subnets, ensuring that instances in private subnets can access external services without exposing them to 
unauthorized inbound traffic.

It is a critical network service that provides secure and controlled internet access for private resources in the 
IronCore infrastructure. It is enforced by the underlying IronCore's network plugin called <a href="https://github.com/ironcore-dev/ironcore-net/blob/main/apinetlet/controllers/natgateway_controller.go"> ironcore-net </a>

### Example NATGateway Resource

An example of how to define a `NATGateway` resource in IronCore:

```yaml
apiVersion: networking.ironcore.dev/v1alpha1
kind: NATGateway
metadata:
  namespace: default
  name: natgateway-sample
spec:
  type: Public
  ipFamily: IPv4
  portsPerNetworkInterface: 64
  networkRef:
    name: network-sample
```

### Key Fields
- `type`(`string`): This represents a `NATGateway` type that allocates and routes a stable public IP. The supported value for type is `public`
- `ipFamily`(`string`): `IPFamily` is the IP family of the `NATGateway`. Supported values for IPFamily are `IPv4` and `IPv6`.
- `portsPerNetworkInterface`(`int32`): This Specifies the number of ports allocated per network interface and controls how many simultaneous connections can be handled per interface.
  If empty, 2048 (DefaultPortsPerNetworkInterface) is the default.
- `networkRef`(`string`): It represents which network this `NATGateway` serves.

### Reconciliation Process:

- **Fetch NATGateway Resource**: It fetches the current state of `NATGateways`, Based on user specifications the desired state of `NATGateway` is determined. This includes the number of NAT Gateways, their types, associated subnets, and routing configurations.
- **Compare and Reconcile**: The reconciler keeps monitoring the state of `NATGateways` to detect any changes or drifts from the desired state, triggering the reconciliation process as needed.
    - Creation: If a `NATGateway` specified in the desired state does not exist in the current state, it is created. For instance, creating a public NAT Gateway in a public subnet to provide internet access to instances in private subnets.
    - Update: If a `NATGateway` exists but its configuration differs from the desired state, it is updated accordingly. This may involve modifying routing tables or changing associated Elastic IPs.
    - Deletion: If a `NATGateway` exists in the current state but is not present in the desired state, it is deleted to prevent unnecessary resource utilization.
- **Error Handling and Logging**: Throughout the reconciliation process, any errors encountered are logged, schedule retries as necessary to ensure eventual consistency.
- **Update Status**:
  After reconciling all `NATGateways`, log the successful reconciliation and update the `NATGateways` status with the corresponding values for `ips`as shown below.

```yaml
status:
  ips:
  - name: ip1
    ip: 10.0.0.1
```

## LoadBalancer

A `LoadBalancer` resource is an L3 (IP-based) load balancer service implementation provided by IronCore. It provides an 
externally accessible IP address that sends traffic to the correct port on your cluster nodes. IronCore `LoadBalancer`
allows targeting multiple `NetworkInterfaces` and distributes traffic between them. This LoadBalancer supports single stack
(IPv4 or IPv6) or dual stack IP addresses (IPv4/IPv6).

### Example Network Resource

An example of how to define a `LoadBalancer` resource in IronCore:

```yaml
apiVersion: networking.ironcore.dev/v1alpha1
kind: LoadBalancer
metadata:
  namespace: default
  name: loadbalancer-sample
spec:
  type: Public
  ipFamilies: [IPv4]
  networkRef:
    name: network-sample
  networkInterfaceSelector:
    matchLabels:
      app: web
  ports:
  - port: 80

```

### Key Fields:
- `type`(`string`): The type of `LoadBalancer`. Currently, two types of `Loadbalancer` are supported:
    - `Public`: LoadBalancer that allocates public IP and routes a stable public IP.
    - `Internal`: LoadBalancer that allocates and routes network-internal, stable IPs.
- `ipFamilies`(`list`): ipFamilies are the IP families the LoadBalancer should have(Supported values are `IPv4` and `IPv6`).
- `ips`(`list`): The ips are the list of IPs to use. This can only be used when the type is LoadBalancerTypeInternal.
- `networkRef`(`string`): networkRef is the Network this LoadBalancer should belong to.
- `networkInterfaceSelector`(`labelSelector`): networkInterfaceSelector defines the NetworkInterfaces for which this LoadBalancer should be applied
- `ports`(`list`): ports are the list of LoadBalancer ports should allow
    - `protocol`(`string`): protocol is the protocol the load balancer should allow. Supported protocols are `UDP`, `TCP`, and `SCTP`, if not specified defaults to TCP.
    - `port`(`int`): port is the port to allow.
    - `endPort`(`int`): endPort marks the end of the port range to allow. If unspecified, only a single port `port` will be allowed.

### Reconciliation Process:

- **NetworkInterfaces selection**: LoadBalancerController continuously watches for `LoadBalancer` resources and reconciles. LoadBalancer resource dynamically selects multiple target `NetworkInterfaces` via a `networkInterfaceSelector` LabelSelector from the spec. Once the referenced Network is in `Available` state, the Loadbalancer destination IP list and referencing `NetworkInterface` is prepared by iterating over selected NetworkIntrefaces status information.
- **Preparing Routing State Object**: Once the destination list is available `LoadBalancerRouting` resource is created. `LoadBalancerRouting` describes `NetworkInterfaces` load balanced traffic is routed to. This object describes the state of the LoadBalancer and results of the LoadBalancer definition specifically `networkInterfaceSelector` and `networkRef`.
  Later this information is used at the Ironcore API level to describe the explicit targets in a pool traffic is routed to.

Sample `LoadBalancerRouting` object which is an internal type and is created by the `LoadBalancerController`:

```yaml
apiVersion: networking.ironcore.dev/v1alpha1
kind: LoadBalancerRouting
metadata:
  namespace: default
  name: loadbalancer-sample # Same name as the load balancer it originates from.
# networkRef references the exact network object the routing belongs to.
networkRef:
  name: network-sample
# destinations list the target network interface instances (including UID) for load balancing.
destinations:
  - name: my-machine-interface-1
    uid: 2020dcf9-e030-427e-b0fc-4fec2016e73a
  - name: my-machine-interface-2
    uid: 2020dcf9-e030-427e-b0fc-4fec2016e73d
```

**LoadBalancer status update**: The `LoadBalancerController` in ironcore-net takes care of allocating IPs for defined `ipFamilies` in the spec and updates them in its `status.ips`.

## NetworkPolicy

In IronCore, `NetworkPolicies` are implemented based on the standard Kubernetes `NetworkPolicy` approach, which is 
enforced by the underlying IronCore's network plugin <a href="https://github.com/ironcore-dev/ironcore-net/blob/main/apinetlet/controllers/networkpolicy_controller.go"> ironcore-net </a> and other components. 
These policies use label selectors to define the source and destination of allowed traffic within the same network 
and can specify rules for both ingress (incoming) and egress (outgoing) traffic.

In IronCore, the `NetworkPolicy` has the following characteristics:

- NetworkPolicy is applied exclusively to `NetworkInterfaces` selected using label selectors.
- These `NetworkInterfaces` must belong to the same network.
- The policy governs traffic to and from other `NetworkInterfaces`, `LoadBalancers`, etc., based on the rules defined in the NetworkPolicy.

### Example NetworkPolicy Resource

An example of how to define a `NetworkPolicy` resource in IronCore:

```yaml
apiVersion: networking.ironcore.dev/v1alpha1
kind: NetworkPolicy
metadata:
  namespace: default
  name: my-network-policy
spec:
  networkRef:
    name: my-network
  networkInterfaceSelector:
    matchLabels:
      app: db
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - ipBlock:
        cidr: 172.17.0.0/16
    - objectSelector:
        kind: NetworkInterface
        matchLabels:
          app: web
    - objectSelector:
        kind: LoadBalancer
        matchLabels:
          app: web
    # Ports always have to be specified. Only traffic matching the ports
    # will be allowed.
    ports:
    - protocol: TCP
      port: 5432
  egress:
  - to:
    - ipBlock:
        cidr: 10.0.0.0/24
    ports:
    - protocol: TCP
      port: 8080
```

### Key Fields

- `networkRef`(`string`): NetworkRef is the Network to regulate using this NetworkPolicy.
- `networkInterfaceSelector`(`labelSelector`): NetworkInterfaceSelector defines the target `NetworkInterfaces` for which this `NetworkPolicy` should be applied.
- `policyTypes`(`list`): There are two supported policyTypes `Ingress` and `Egress`.
- `ingress`(`list`): An Ingress section in a `NetworkPolicy` defines a list of `NetworkPolicyIngressRules` that specify which incoming traffic is allowed. Each `NetworkPolicy` can have multiple ingress rules, and each rule allows traffic that satisfies both the from and ports criteria.
  For example, a `NetworkPolicy` with a single ingress rule may permit traffic on a specific port and only from one of the following sources:
    - An IP range, defined using an ipBlock.
    - A set of resources identified by an objectSelector.
- `egress`(`list`): egress defines the list of `NetworkPolicyEgressRules`. Each NetworkPolicy may include a list of allowed egress rules. Each rule allows traffic that matches both `to` and `ports` sections. The example policy contains a single rule, which matches traffic on a single port to any destination in 10.0.0.0/24.

### Reconciliation Process:

The `NetworkPolicyReconciler` in the IronCore project is responsible for managing the lifecycle of `NetworkPolicy` 
resources. Its primary function is to ensure that the rules specified by the user in the `NetworkPolicy` resource are 
enforced and applied on the target `NetworkInterface`.

The <a href="https://github.com/ironcore-dev/ironcore-net/blob/main/apinetlet/controllers/networkpolicy_controller.go"> apinetlet </a> 
component in `ironcore-net` plugin is responsible for translating the policy rules into another `apinet` resource named
`NetworkPolicyRule`. Finally, the <a href="https://github.com/ironcore-dev/ironcore-net/blob/main/metalnetlet/controllers/networkinterface_controller.go"> metalnetlet </a> 
component in `ironcore-net` and propagates these rules for enforcement at `metalnet` level in the IronCore infrastucture.

The reconciliation process involves several key steps:

- **Fetching the NetworkPolicy Resource**: The reconciler retrieves the `NetworkPolicy` resource specified in the reconciliation request. If the resource is not found, it may have been deleted, and the reconciler will handle this scenario appropriately.
- **Validating the NetworkPolicy**: The retrieved `NetworkPolicy` is validated to ensure it confirms the expected specifications. This includes checking fields such as `NetworkRef`, `NetworkInterfaceSelector`, `Ingress`, `Egress`, and `PolicyTypes` to ensure they are correctly defined.
- **Fetching Associated Network Interfaces**: Using the `NetworkInterfaceSelector`, the reconciler identifies the network interfaces that are subject to the policy.
- **Applying Policy Rules**: The reconciler translates the ingress and egress rules defined in the `NetworkPolicy` into configurations that can be enforced by the underlying network infrastructure. This involves interacting with other components responsible for `NetworkPolicy` or Firewall rule enforcement.
- **Handling Errors and Reconciliation Loops**: If errors occur during any of the above steps, the reconciler will log the issues and may retry the reconciliation. 
