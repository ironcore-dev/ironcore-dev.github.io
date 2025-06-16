# Storage Resources

## Volume

The `Volume` resource is representing a block device in the IronCore API.  

### Example Volume Resource

An example of how to define a `Volume` resource in IronCore:

```yaml
apiVersion: storage.ironcore.dev/v1alpha1
kind: Volume
metadata:
  name: volume-sample
spec:
  volumeClassRef:
    name: volumeclass-sample
  # volumePoolRef:
  #   name: volumepool-sample
  resources:
    storage: 100Gi
```

### Key Fields:

- `volumeClassRef`(`string`): `volumeClassRef` refers to the name of an IronCore `volumeClass`( for eg: `slow`, `fast`, `super-fast` etc.) to create a volume,
- `volumePoolRef` (`string`): `VolumePoolRef` indicates which VolumePool to use for a volume. If unset, the scheduler will figure out a suitable `VolumePoolRef`.
- `resources`: `Resources` is a description of the volume's resources and capacity.

### Reconciliation Process:

- **Fetch Volume Resource**: Retrieve the `Volume` resource and clean up any orphaned `IRI` volumes if the resource is missing.
- **Check IRI Volumes**: List and identify `IRI` volumes linked to the `Volume` resource.
- **Create or Update Volume**:
    - Create a new IRI volume if none exists.
    - Update existing IRI volumes if attributes like size or encryption need adjustments.
- **Sync Status**: Reflect the IRI volume's state (e.g., Pending, Available) in the Kubernetes Volume resource's status.
- **Handle Deletion**: Safely delete all associated IRI volumes and remove the finalizer to complete the resource lifecycle.

## VolumeClass

The `VolumeClass` in IronCore defines the characteristics and capabilities of storage `Volume` like TPS and IOPs. 

### Example VolumeClass Resource

An example of how to define a `VolumeClass` resource in IronCore:

```yaml
apiVersion: storage.ironcore.dev/v1alpha1
kind: VolumeClass
metadata:
  name: volumeclass-sample
capabilities:
  tps: 100Mi
  iops: 100
```

### Key Fields:
- `capabilities`: Capabilities has tps and iops fields that need to be specified, it's a mandatory field,
    - `tps`(`string`): The `tps` represents transactions per second.
    - `iops`(`string`): `iops` is the number of input/output operations a storage device can complete per second.

### Usage

- **VolumeClass Definition**: Create a `VolumeClass` to set storage properties based on resource capabilities.
- **Associate with Volume**: Link a `VolumeClass` to a `Volume` using a reference in the Volume resource.
- **Dynamic configuration**: Update the `VolumeClass` to modify storage properties for all its Volumes.

### Reconciliation Process:

- **Fetches & Validates**: Retrieves the VolumeClass from the cluster and checks if it exists.
- **Synchronizes State**: Keeps the VolumeClass resource updated with its current state and dependencies.
- **Monitors Dependencies**: Watches for changes in dependent Volume resources and reacts accordingly.
- **Handles Errors**: Requeues the reconciliation to handle errors and ensure successful completion.
- **Handles Deletion**: Cleans up references, removes the finalizer, and ensures no dependent Volumes exist before deletion.

## VolumePool

A `VolumePool` is a resource in `Ironcore` that represents a pool of storage volume managed collectively. It defines 
the infrastructure's storage configuration used to provision and manage volumes, ensuring resource availability and 
compatibility with associated `VolumeClasses`.

### Example VolumePool Resource

An example of how to define a `VolumePool` resource in IronCore:

```yaml
apiVersion: storage.ironcore.dev/v1alpha1
kind: VolumePool
metadata:
  name: volumepool-sample
spec:
  providerID: ironcore://shared
```

### Key Fields:
- `providerID`(`string`): The `providerId` helps the controller identify and communicate with the correct storage system within the specific backened storage porvider.

### Reconciliation Process:

- **Volume Type Discovery**: It constantly checks what kinds of volumes (volumeClasses) are available in the `Ironcore` Infrastructure.
- **Compatibility Check**: Evaluating whether the volumePool can create and manage each volume type based on its capabilities.
- **Status Update**: Updating the VolumePool's status to indicate the volume types it supports, like a menu of available options.
- **Event Handling**: Watches for changes in VolumeClass resources and ensures the associated VolumePool is reconciled when relevant changes occur.

## Bucket

A `Bucket` in IronCore refers to an object storage resource that organizes and manages data, similar to the concept of buckets
in other cloud storage services. Buckets are containers for storing objects, such as files or data blobs.

### Example Bucket Resource

An example of how to define a `Bucket` resource in IronCore:

```yaml
apiVersion: storage.ironcore.dev/v1alpha1
kind: Bucket
metadata:
  name: bucket-sample
spec:
  bucketClassRef:
    name: bucketclass-sample
#  bucketPoolRef:
#    name: bucketpool-sample
```

### Key Fields:
- `bucketClassRef`(`string`):
    - Mandatory field
    - `BucketClassRef` is the `BucketClass` of a bucket

- `bucketPoolRef`(`string`):
    - Optional field
    - `bucketPoolRef` indicates which `BucketPool` to use for the `Bucket`, if not specified the controller itself picks the available `BucketPool`


### Usage
- **Data Storage**: Use `Buckets` to store and organize data blobs, files, or any object-based data.
- **Multi-Tenant Workloads**: Leverage buckets for isolated and secure data storage in multi-tenant environments by using separate BucketClass or BucketPool references.
- **Secure Access**: Buckets store a reference to the `Secret` securely in their status, and the `Secret` has the access credentials, which applications can retrieve access details from the `Secret`.

### Reconciliation Process:

- The controller detects changes and fetches bucket details.
- Creation/Update ensures the backend bucket exists, metadata is synced, and credentials are updated.
- The bucket will automatically sync with the backend storage system, and update the Bucket's state (e.g., `Available`, `Pending`, or `Error`) in the bucket's status.
- Access details and credentials will be managed securely using Kubernetes `Secret` and the bucket status will track a reference to the `Secret`.
- During deletion, resources will be cleaned up gracefully without manual intervention.
- If the bucket is not ready (e.g., backend issues), reconciliation will retry

## BucketClass

A `BucketClass` is a concept used to define and manage different types of storage buckets, typically based on resource 
capabilities. It is conceptually similar to Kubernetes `StorageClass`, enabling users to specify the desired properties 
for an Ironcore `Bucket` resource creation.

### Example BucketClass Resource

An example of how to define a `BucketClass` resource in IronCore:

```yaml
apiVersion: storage.ironcore.dev/v1alpha1
kind: BucketClass
metadata:
  name: bucketclass-sample
capabilities:
  tps: 100Mi
  iops: 100
```

### Key Fields:

- `capabilities`: Capabilities has `tps` and `iops` fields which need to be specified, it's a mandatory field,
    - `tps`(`string`): The `tps` represents transactions per second.
    - `iops`(`string`):  `iops` is the number of input/output operations a storage device can complete per second.

### Usage

- **BucketClass Definition**: Create a `BucketClass` to set storage properties based on resource capabilities.
- **Associate with buckets**: Link a `BucketClass` to a `Bucket` using a reference in the Bucket resource.
- **Dynamic configuration**: Update the `BucketClass` to modify storage properties for all its Buckets.

### Reconciliation Process:

- **Fetches & Validates**: Retrieves the `BucketClass` from the cluster and checks if it exists.
- **Synchronizes State**: Keeps the `BucketClass` resource updated with its current state and dependencies.
- **Monitors Dependencies**: Watches for changes in dependent Bucket resources and reacts accordingly.
- **Handles Errors**: Requeues the reconciliation to handle errors and ensure successful completion.
- **Handles Deletion**: Cleans up references, removes the finalizer, and ensures no dependent Buckets exist before deletion.

## BucketPool

A `BucketPool` is a resource in `Ironcore` that represents a pool of storage buckets managed collectively. It defines
the infrastructure's storage configuration used to provision and manage buckets, ensuring resource availability and 
compatibility with associated `BucketClasses`.

### Example BucketPool Resource

An example of how to define a `BucketPool` resource in IronCore:

```yaml
apiVersion: storage.ironcore.dev/v1alpha1
kind: BucketPool
metadata:
  name: bucketpool-sample
spec:
  providerID: ironcore://shared
```

### Key Fields:

- `ProviderID`(`string`):  The `providerId` helps the controller identify and communicate with the correct storage system within the specific backened storage porvider.

### Reconciliation Process:

- **Bucket Type Discovery**: It constantly checks what kinds of `BucketClasses` are available in the IronCore infrastructure.
- **Compatibility Check**: Evaluating whether the BucketPool can create and manage each bucket type based on its capabilities.
- **Status Update**: Updating the BucketPool's status to indicate the bucket types it supports, like a menu of available options.
- **Event Handling**: Watches for changes in BucketClass resources and ensures the associated BucketPool is reconciled when relevant changes occur.
