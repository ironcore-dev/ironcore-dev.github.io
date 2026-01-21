# Networking Resources

This guide describes the core networking resources in IronCore, such as `Networks`, `NetworkInterfaces`, `VirtualIPs`, `NAT gateways`, `LoadBalancers`, and `NetworkPolicies`.

## Network

A `Network` resource in IronCore refers to a logically isolated network (Layer 3). This further allows you to fully 
control your networking environment, including resource placement, connectivity, peering and security. 

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

- `peerings` (`list`): Are the list of network peerings with this `Network` (optional).
### More about IronCore Network:

- **Network creation**: [ironcore-net](https://github.com/ironcore-dev/ironcore-net) is the network plugin for IronCore that realizes the `Network` resource. When an IronCore `Network` is created, a corresponding `core.apinet.ironcore.dev/Network` is created in the ironcore-net(apinet) cluster.
Once created and with an allocated ID, the IronCore `Network` will be patched with the corresponding providerID of the apinet Network and set to state: `Available`. 
The format of a network providerID is as follows:
`ironcore-net://<namespace>/<name>/<id>/<uid>`

- **Network peering process**: Network peering is a technique used to interleave two isolated networks, allowing members of both networks to communicate with each other as if they were in the same networking domain.
    - Information related to the referenced `Network` to be paired with is retrieved from the `peering` part of the spec.
    - Validation is done to see if both Networks have specified a matching peering item (i.e. reference each other via `networkRef`) to mutually accept the peering.
    - The `binding` phase of a `spec.peerings` item is reflected in a corresponding `status.peerings` item with the same name. The phase can either be `Pending`, meaning there is no active peering or `Bound` meaning the peering as described in the `spec.peerings` item is in place.


After successful reconciliation, the IronCore `Network` resource gets updated with `providerID`, `incomingpeerings` and `status`.

```yaml
apiVersion: networking.ironcore.dev/v1alpha1
kind: Network
metadata:
  name: network-sample
spec:
  peerings:
    - name: peering1
      networkRef:
      - name: network-sample2
  incomingPeerings:
    - name: network-sample2
  providerID: ironcore-net://ironcore-net-system/15e43205-3cfe-4b27-a29c-4ade42b94fca/11621310/292f19b4-2ff4-41e8-b324-075550340786
status:
  peerings:
  - name: peering1
    state: Ready
  state: Available
```

For detailed e2e example on network peering
- [e2e example networkpeering](https://github.com/ironcore-dev/ironcore/tree/main/config/samples/e2e/network-peering)

## NetworkInterface

A `NetworkInterface` resource in IronCore represents a connection point between a `Machine` and a virtual 
network. It encapsulates the configuration and life cycle management of the virtual network interface, ensuring 
seamless connectivity for `Machines`.

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

- `networkRef` (`string`): `NetworkRef` is the `Network` this `NetworkInterface` is connected to.
- `ipFamilies` (`list`): `IPFamilies` defines the list of IPFamilies this `NetworkInterface` supports. Supported values for IPFamily are `IPv4` and `IPv6`.
- `ips` (`list`): `IPs` are the list of provided internal IPs which should be assigned to this NetworkInterface
- `virtualIP`: `VirtualIP` specifies the public ip that should be assigned to this NetworkInterface.

After successful reconciliation of all `NetworkInterfaces`, the status gets updated with the corresponding values for `ips`, `state`, and `virtualIP`, as shown below.

```yaml
status:
  ips:
  - 10.0.0.1
  lastStateTransitionTime: "2025-01-13T11:39:17Z"
  state: Available
  virtualIP: 172.89.244.23
```

## VirtualIP

A `VirtualIP` (VIP) in the IronCore API is an abstract `Network` resource representing an IP address that is
allocated and kept during the lifetime of the `VirtualIP` resource. It can be associated with a `NetworkInterface`
of a `Machine` exposing this `Machine` e.g. to the public internet.

### Example VirtualIP Resource

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
- `type` (`string`): Currently supported type is `Public`, which allocates and routes a stable public IP.
- `ipFamily` (`string`): `IPFamily` is the IP family of the `VirtualIP`. Supported values for IPFamily are `IPv4` and `IPv6`.


 After successful reconciliation of the `VirtualIP` resource, the status gets updated with the corresponding public IP address.

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
private subnets, ensuring that instances in private subnets can access external services without exposing them to unauthorized inbound traffic.

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
- `type` (`string`): This represents a `NATGateway` type that allocates and routes a stable public IP. The supported value for type is `public`
- `ipFamily` (`string`): `IPFamily` is the IP family of the `NATGateway`. Supported values for IPFamily are `IPv4` and `IPv6`.
- `portsPerNetworkInterface` (`int32`): This Specifies the number of ports allocated per network interface and controls how many simultaneous connections can be handled per interface. If empty, 2048 (DefaultPortsPerNetworkInterface) is the default.
- `networkRef` (`string`): It represents which network this `NATGateway` serves.

After reconciling all `NATGateways`, the status gets updated with the corresponding values for `ips` as shown below.

```yaml
status:
  ips:
  - name: ip1
    ip: 10.0.0.1
```

## LoadBalancer

A `LoadBalancer` resource is an L3 (IP-based) load balancer service implementation provided by IronCore. It provides an 
externally accessible IP address that sends traffic to the correct port on your cluster nodes. IronCore `LoadBalancer`
allows targeting multiple `NetworkInterfaces` and distributes traffic among them. This LoadBalancer supports single stack
(IPv4 or IPv6) or dual stack IP addresses (IPv4/IPv6).

### Example LoadBalancer Resource

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
- `type` (`string`): The type of `LoadBalancer`. Currently, two types of `Loadbalancer` are supported:
  - `Public`: LoadBalancer that allocates public IP and routes a stable public IP.
  - `Internal`: LoadBalancer that allocates and routes network-internal, stable IPs.
- `ipFamilies` (`list`): ipFamilies are the IP families the LoadBalancer should have(Supported values are `IPv4` and `IPv6`).
- `ips` (`list`): The ips are the list of IPs to use. This can only be used when the type is LoadBalancerTypeInternal.
- `networkRef` (`string`): networkRef is the Network this LoadBalancer should belong to.
- `networkInterfaceSelector` (`labelSelector`): networkInterfaceSelector defines the NetworkInterfaces for which this LoadBalancer should be applied.
- `ports` (`list`): ports are the list of LoadBalancer ports should allow
  - `protocol` (`string`): protocol is the protocol the load balancer should allow. Supported protocols are `UDP`, `TCP`, and `SCTP`, if not specified defaults to TCP.
  - `port` (`int`): port is the port to allow.
  - `endPort` (`int`): endPort marks the end of the port range to allow. If unspecified, only a single port `port` will be allowed.

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

The `LoadBalancerController` in [ironcore-net](https://github.com/ironcore-dev/ironcore-net/blob/main/apinetlet/controllers/loadbalancer_controller.go) takes care of allocating IPs for defined `ipFamilies` in the spec and updates them in its `status.ips`.

For a detailed e2e example on LoadBalancer 
- [e2e example LoadBalancer](https://github.com/ironcore-dev/ironcore/tree/main/config/samples/e2e/loadbalancer-public)

## NetworkPolicy

In IronCore, `NetworkPolicies` are implemented based on the standard Kubernetes `NetworkPolicy` approach, which is 
enforced by the underlying IronCore's network plugin [ironcore-net](https://github.com/ironcore-dev/ironcore-net/blob/main/apinetlet/controllers/networkpolicy_controller.go) and other components. 
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

- `networkRef` (`string`): NetworkRef is the Network to regulate using this NetworkPolicy.
- `networkInterfaceSelector` (`labelSelector`): NetworkInterfaceSelector defines the target `NetworkInterfaces` for which this `NetworkPolicy` should be applied.
- `policyTypes` (`list`): There are two supported policyTypes `Ingress` and `Egress`.
- `ingress` (`list`): An Ingress section in a `NetworkPolicy` defines a list of `NetworkPolicyIngressRules` that specify which incoming traffic is allowed. Each `NetworkPolicy` can have multiple ingress rules, and each rule allows traffic that satisfies both the from and ports criteria.

  For example, a `NetworkPolicy` with a single ingress rule may permit traffic on a specific port and only from one of the following sources:
  - An IP range, defined using an ipBlock.
  - A set of resources identified by an objectSelector.
- `egress` (`list`): egress defines the list of `NetworkPolicyEgressRules`. Each NetworkPolicy may include a list of allowed egress rules. Each rule allows traffic that matches both `to` and `ports` sections. The example policy contains a single rule, which matches traffic on a single port to any destination in 10.0.0.0/24.


The IronCore project is responsible for managing the lifecycle of `NetworkPolicy` 
resources. Its primary function is to ensure that the rules specified by the user in the `NetworkPolicy` resource are 
enforced and applied on the target `NetworkInterface`.

For more detailed e2e example on `NetworkPolicy`
- [e2e example on NetworkPolicy](https://github.com/ironcore-dev/ironcore/tree/main/config/samples/e2e/network-policy)
