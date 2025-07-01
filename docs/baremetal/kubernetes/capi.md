# Cluster API (CAPI) for IronCore Bare Metal

The [Cluster API (CAPI) for IronCore bare metal](https://github.com/ironcore-dev/cluster-api-provider-ironcore-metal) 
is a project that provides a declarative way to manage bare metal Kubernetes clusters using the Cluster API framework. 
It maps the CAPI concepts to the IronCore's `metal-operator` API types.

The diagram below illustrates the architecture of the Cluster API for IronCore bare metal:

```mermaid
graph TB
    subgraph "cluster.x-k8s.io/v1beta1"
        direction TB
        CAPI_Cluster[Cluster]
        CAPI_MachineDeployment[MachineDeployment]
        CAPI_Machine[Machine]
    end

    subgraph "infrastructure.cluster.x-k8s.io/v1beta1"
        direction TB
        Metal_Machine[MetalMachine]
    end

    subgraph "metal.ironcore.dev/v1alpha1"
        direction TB
        MetalOperator_ServerClaim[ServerClaim]
        MetalOperator_Server[Server]
    end

    CAPI_Cluster -->|creates| CAPI_MachineDeployment
    CAPI_MachineDeployment -->|creates| CAPI_Machine
    CAPI_Machine -->|creates| Metal_Machine
    Metal_Machine -->|creates| MetalOperator_ServerClaim
    MetalOperator_ServerClaim -->|provisions| MetalOperator_Server 
```
