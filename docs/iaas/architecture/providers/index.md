# Provider Concept

Providers in IronCore are implementors of the [IronCore RuntimeInterfaces](/iaas/architecture/runtime-interface).
They are responsible for managing the lifecycle of resources, such as compute instances, storage volumes and buckets,
across various backends. The IRI and the provider concept allow IronCore to be extensible and adaptable to different
environments. By using gRPC as the communication protocol, providers can be implemented in any language.

As described in the [RuntimeInterface](/iaas/architecture/runtime-interface) documentation, providers can be implemented 
for those three resource groups:

- Compute
- Block Storage
- Object Storage

One special case of a provider are [Brokers](/iaas/architecture/providers/brokers). Brokers implement the `RuntimeInterface`
of a specific resource group but instead of creating/reserving physical resources, they broker the resource to another
API server. 
