# Container Storage Interface (CSI) Driver

The [Container Storage Interface (CSI)](https://kubernetes.io/docs/concepts/storage/volumes/#csi) driver is a standardized 
way for Kubernetes to interact with storage systems. The IronCore CSI driver enables Kubernetes to manage IronCore 
volumes as Persistent Volumes (PVs) and Persistent Volume Claims (PVCs). The driver implements the 
[CSI specification](https://github.com/container-storage-interface/spec/blob/master/spec.md) to provide storage 
management capabilities.

## IronCore CSI Driver Integration

The [Ironcore CSI Driver](https://github.com/ironcore-dev/ironcore-csi-driver) is implemented as a Kubernetes storage 
plugin that bridges the gap between Kubernetes storage management and IronCore's `storage` resource types. 

The core components of the IronCore CSI driver include:

- **CSI Controller Plugin**: Runs as a deployment in the Kubernetes cluster and handles volume provisioning, deletion, and attachment operations
- **CSI Node Plugin**: Runs as a DaemonSet on each Kubernetes node and manages volume mounting and unmounting operations

## `StorageClass` Configuration

The CSI driver supports various storage class parameters for customizing volume provisioning:

- **Volume Type**: Specifies the type of volume to be created (e.g., standard, high-performance)
- **AllowVolumeExpansion**: This Specifies the Volume can be resized if set to `true` and the respective volume Type has `ResizePolicy` set to `ExpandOnly` 

### Volume Management

The CSI driver integrates with IronCore's `storage` API to provide:

- Dynamic provisioning of volumes based on PVC specifications
- Volume attachment and detachment operations
- Volume resizing capabilities

### Node Integration

On each Kubernetes node, the CSI driver:

- Manages the mounting and unmounting of volumes
- Handles volume formatting and filesystem operations
- Ensures proper volume permissions and access control
- Manages volume attachment and detachment operations

## Volume Lifecycle Management

The CSI driver manages the complete lifecycle of volumes in Kubernetes, from creation to deletion. Here's a detailed 
explanation of how the APIs are implemented in the IronCore CSI driver for different volume operations.

### Volume Creation

- `CreateVolume` method is called when a new `PersistentVolumeClaim` is created
- Validates the storage class parameters and volume capabilities
- Create a new `Volume` object in IronCore with specified parameters
- Set up the volume with the appropriate size, access mode, and other configurations
- Returns a unique volume ID that will be used to identify the volume in later operations

### Volume Deletion

- `DeleteVolume` method is called when a `PersistentVolume` is deleted
- Retrieve the volume using the volume ID
- Performs cleanup operations if necessary
- Delete the `Volum`e object from IronCore
- Ensures all associated resources are properly cleaned up

## Node Operations

The CSI driver runs as a node plugin on each Kubernetes node to handle volume mounting and unmounting operations.

### Volume Publishing

- `NodePublishVolume` is called when a volume needs to be mounted on a node
- Validates the volume capabilities and access mode
- Create the necessary mount point on the node
- Mounts the volume using the appropriate filesystem
- Set up the required permissions and mount options

### Volume Unpublishing

- `NodeUnpublishVolume` is called when a volume needs to be unmounted from a node
- Unmounts the volume from the specified mount point
- Clean up any temporary files or directories
- Ensures the volume is properly detached from the node

## Controller Operations

The CSI driver also runs as a controller plugin to manage volume provisioning and attachment.

### Volume Attachment

- `ControllerPublishVolume` is called when a volume needs to be attached to a node
- Validates the node information and volume capabilities
- Attaches the `Volume` to the specified node
- Returns the device path that will be used for mounting

### Volume Detachment

- `ControllerUnpublishVolume` is called when a volume needs to be detached from a node
- Detaches the volume from the specified node
- Perform any necessary cleanup operations
- Ensures the volume is properly detached before returning

## Volume Expansion

The CSI driver supports online volume expansion (if allowed by the `StorageClass`), allowing volumes to be resized without downtime.

- `ExpandVolume` is called when a volume needs to be resized
- Validates the new size and volume capabilities
- Resizes the `Volume` in IronCore
- Update the filesystem if necessary
- Returns the new size of the volume
