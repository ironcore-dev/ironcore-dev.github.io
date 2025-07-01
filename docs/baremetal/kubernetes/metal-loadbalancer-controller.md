# Metal Loadbalancer Controller

The [metal-loadbalancer-controller](https://github.com/ironcore-dev/metal-load-balancer-controller) is responsible
for managing the lifecycle of `Services` of type `LoadBalancer` in a Kubernetes cluster running on bare metal servers.
The project consists of two main components: 
- **Controller**: The main component that watches for changes in `Service` resources and manages the lifecycle of load balancers.
- **Speaker**: Is responsible for announcing the load balancer IP address to `metalbond` which acts as a route reflector
  to the bare metal servers. 

The `metal-loadbalancer-controller` is designed to work in an IPv6 only environment.

## Controller

The controller component has the following responsibilities:
- Watches for changes in `Service` resources of type `LoadBalancer` and uses the `ClusterIP` of a `Service` and patches the
  `LoadBalancer` status using this `ClusterIP`.
- Setting the `PodCIDRs` on the `Node` resources to ensure that the load balancer can route traffic to the pods. Here it 
  takes the main `Node` IP address and the configured `node-cidr-mask-size` and patches the `Node.spec.podCIDRs` field.

## Metalbond-Speaker

The speaker is typically deployed as a `DaemonSet` in a bare metal cluster. It is responsible for announcing
the load balancer IP address to the `metalbond` service, which acts as a route reflector to the bare metal servers.
The speaker can be configured to which `VNI` the load balancer IP address should be announced.
