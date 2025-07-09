# IronCore Runtime Interface (IRI)

The IronCore Runtime Interface (IRI) is a key concept in the IronCore architecture, designed to provide a consistent
and unified interface for interacting with various compute and storage providers. The IRI abstracts the underlying 
complexities of different providers.

There are three main runtime interfaces in IronCore:
- `MachineRuntime`: This interface is used for managing compute resources, such as virtual machines.
- `VolumeRuntime`: This interface is used for managing storage resources, such as block storage.
- `BucketRuntime`: This interface is used for managing object storage, such as S3-compatible buckets.

Implementations of these interfaces are done by provider-specific components. More infomation about the provider can
be found in the [provider concept documentation](/iaas/architecture/providers/).

The definition of the runtime interfaces can be found in IronCore's [`iri` package](https://github.com/ironcore-dev/ironcore/tree/main/iri/).

## MachineRuntime Interface

The `MachineRuntime` is responsible for managing compute resources in IronCore. It provides methods for creating,
deleting and managing `Machine` instances and their associated resources.

```proto
service MachineRuntime {
    rpc Version(VersionRequest) returns (VersionResponse) {};
    rpc ListEvents(ListEventsRequest) returns (ListEventsResponse) {};

    rpc ListMachines(ListMachinesRequest) returns (ListMachinesResponse) {};
    rpc CreateMachine(CreateMachineRequest) returns (CreateMachineResponse) {};
    rpc DeleteMachine(DeleteMachineRequest) returns (DeleteMachineResponse) {};
    rpc UpdateMachineAnnotations(UpdateMachineAnnotationsRequest) returns (UpdateMachineAnnotationsResponse);
    rpc UpdateMachinePower(UpdateMachinePowerRequest) returns (UpdateMachinePowerResponse);
    rpc AttachVolume(AttachVolumeRequest) returns (AttachVolumeResponse) {};
    rpc DetachVolume(DetachVolumeRequest) returns (DetachVolumeResponse) {};
    rpc AttachNetworkInterface(AttachNetworkInterfaceRequest) returns (AttachNetworkInterfaceResponse);
    rpc DetachNetworkInterface(DetachNetworkInterfaceRequest) returns (DetachNetworkInterfaceResponse);

    rpc Status(StatusRequest) returns (StatusResponse);

    rpc Exec(ExecRequest) returns (ExecResponse);
}
```

The general idea is that a `machinepoollet` ensures that the API level dependencies are met. For example, a `Machine`'s `Volume` which is used as a root disk is in the state `Available`. If those prerequisites are met, the `poollet` will call the corresponding `CreateMachine` method of the `RuntimeInterface` to create the `Machine` resource.

The `ListMachines` and `Status` methods are used to retrieve a list of all `Machine` instances managed by the provider. 
The result of those methods is then used to propagate `Machine` state changes. Those methods are periodically called by 
the `machinepoollet`.

Additionally, the `machinepoollet` invokes the `AttachVolume`/`DetachVolume` or `AttachNetworkInterface`/`DetachNetworkInterface` 
methods to attach volumes or network interfaces to a `Machine` if a change in the `Machine` `spec` is detected.

## VolumeRuntime Interface

Similar to the `MachineRuntime`, the `VolumeRuntime` interface is responsible for managing block storage resources in IronCore.
Here the `volumepoollet` takes a similar role as the `machinepoollet` for the `MachineRuntime` and invokes `CreateVolume`,
`DeleteVolume`, `ExpandVolume`, and other methods to manage `Volume` resources.

```proto
service VolumeRuntime {
  rpc Version(VersionRequest) returns (VersionResponse) {};
  rpc ListEvents(ListEventsRequest) returns (ListEventsResponse) {};
  rpc ListVolumes(ListVolumesRequest) returns (ListVolumesResponse) {};
  rpc CreateVolume(CreateVolumeRequest) returns (CreateVolumeResponse) {};
  rpc ExpandVolume(ExpandVolumeRequest) returns (ExpandVolumeResponse) {};
  rpc DeleteVolume(DeleteVolumeRequest) returns (DeleteVolumeResponse) {};

  rpc Status(StatusRequest) returns (StatusResponse) {};
}
```

## BucketRuntime Interface

The `BucketRuntime` interface is responsible for managing object storage resources in IronCore. It provides methods
for creating, deleting and managing `Bucket` instances and their associated resources. The invocation of those methods
are handled by the `bucketpoollet`.

```proto
service BucketRuntime {
  rpc Version(VersionRequest) returns (VersionResponse) {};
  rpc ListEvents(ListEventsRequest) returns (ListEventsResponse) {};
  rpc ListBuckets(ListBucketsRequest) returns (ListBucketsResponse) {};
  rpc CreateBucket(CreateBucketRequest) returns (CreateBucketResponse) {};
  rpc DeleteBucket(DeleteBucketRequest) returns (DeleteBucketResponse) {};

  rpc ListBucketClasses(ListBucketClassesRequest) returns (ListBucketClassesResponse) {};
}
```
