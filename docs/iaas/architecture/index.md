# IaaS Architecture

The Infrastructure as a Service (IaaS) layer of IronCore is a modular and scalable system designed to manage compute,
networking, and storage resources efficiently. This page provides an in-depth overview of the core components that 
make up the IaaS layer, their roles, and how they interact to deliver a seamless infrastructure management experience.

## Architecture Overview

The IaaS layer of IronCore is composed of several interconnected components, each responsible for a specific aspect 
of infrastructure management. The following diagram illustrates the architecture:

```mermaid
%%{
  init: {
    "theme": "neutral",
    "fontFamily": "monospace",
    "logLevel": "info",
    "flowchart": {
      "htmlLabels": true,
      "curve": "linear"
    },
    "sequence": {
      "mirrorActors": true
    }
  }
}%%
block-beta
    block:ID
        columns 2
        A["ironcore"]
        B["ironcore-net"]
        C["metalnet + dpservice"]
        D["metalbond"]
        E["libvirt-provider"]
        F["ceph-provider"]
    end
```

### Core Components

- **IronCore**  
  IronCore is the central component of the IaaS layer, implemented as an aggregated Kubernetes API server. It provides 
  a declarative, Kubernetes-style API for managing compute, networking, and storage resources. Through its scheduler, 
  poollets, and broker components, IronCore orchestrates resource allocation and coordination, ensuring that resources 
  are efficiently distributed and utilized across the infrastructure. By leveraging Kubernetes' API extension 
  mechanisms, IronCore offers a familiar and powerful interface for infrastructure management, serving as the backbone 
  of the IaaS layer.

- **IronCore-Net**  
  IronCore-Net is the global networking control plane for IronCore. It provides centralized management of networking 
  resources, enabling other components to request public IP addresses, LoadBalancer instances, or NatGateways. 
  IronCore-Net ensures consistent and scalable network operations, making it a critical component for global 
  connectivity within the platform.

- **Metalnet + DPService**  
  Metalnet and DPService together form the low-level Software-Defined Networking (SDN) implementation. They leverage 
  the DPDK (Data Plane Development Kit) framework to deliver high-performance networking. Additionally, these 
  components support hardware offloading of packet filtering to a Data Processing Unit (DPU), optimizing network 
  traffic handling and improving overall performance.

- **MetalBond**  
  MetalBond is a route reflector responsible for distributing routes across hypervisor nodes. It also manages routes 
  announced to the outside world, ensuring efficient and reliable network connectivity. By handling route distribution, 
  MetalBond enables seamless communication between internal resources and external networks.

- **Libvirt-Provider**  
  The Libvirt-Provider is the hypervisor manager that interacts with Libvirt to create and manage virtual machines on 
  hypervisor hosts. It uses Libvirt/QEMU to handle the lifecycle of virtual machines, providing a robust compute 
  foundation for the IaaS layer. This component ensures that compute resources are effectively provisioned and managed.

- **Ceph-Provider**  
  The Ceph-Provider is responsible for managing block and object storage by interfacing with a Ceph cluster. It enables 
  the provisioning of scalable storage resources for applications, supporting both block and object storage needs. 
  Importantly, IronCore does not manage the Ceph cluster itself—it makes no assumptions about how or where the Ceph 
  cluster is installed and operated, offering flexibility in storage deployment.

## How It Works Together

The components of the IaaS layer work in tandem to provide a cohesive infrastructure management experience:

- **IronCore** orchestrates the overall system, using its scheduler and broker to allocate resources efficiently.
- **IronCore-Net** and **Metalnet + DPService** handle networking, providing both global control and low-level SDN 
  capabilities, with MetalBond ensuring proper route distribution.
- **Libvirt-Provider** manages compute resources by interfacing with Libvirt/QEMU to deploy and manage virtual machines.
- **Ceph-Provider** integrates with a Ceph cluster to provision and manage storage resources, offering flexibility 
  for various storage needs.

This modular design allows each component to operate independently while integrating seamlessly, enabling IronCore to 
scale from small deployments to large, enterprise-grade clusters.

## Next Steps

TODO: define next steps for users to explore the IaaS layer further.

- Learn how to set up the IaaS layer: **[Get Started with IaaS](#)**
- Explore the APIs for managing resources: **[API Reference](#)**
- Dive into networking configurations: **[Networking Guide](#)**
- Understand storage integration: **[Storage Guide](#)**