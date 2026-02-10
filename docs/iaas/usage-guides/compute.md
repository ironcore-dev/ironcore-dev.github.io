# Compute Resources

IronCore compute resources are Machines, their associated MachineClasses, and MachinePools that allow you to define, provision, and manage virtual machines. This guide explains the core compute resource types and how to use them.

## Machine

A `Machine` resource in IronCore is used to represent a compute resource or a virtual machine. It serves as a means to 
configure network, storage, type of machine and other information needed to create a compute instance.

### Example Machine Resource

An example of how to define a Machine resource:

```yaml
apiVersion: compute.ironcore.dev/v1alpha1
kind: Machine
metadata:
  name: machine-sample
spec:
  machineClassRef:
    name: machineclass-sample
  image: my-image
  volumes:
    - name: rootdisk # first disk is the root disk
      volumeRef:
        name: my-volume
  networkInterfaces:
    - name: primary
      networkInterfaceRef:
        name: networkinterface-sample
  ignitionRef:
    name: my-ignition-secret
```

**Key Fields**:

- `machineClassRef` (`string`): Is a reference to the `MachineClass` of the machine.
- `machinePoolRef` (`string`): Defines the `MachinePool` to run the `Machine` on. If empty, the IronCore scheduler will figure out an appropriate pool to run the `Machine` on.
- `image` (`string`): Image is the optional URL providing the operating system image to memory boot the `Machine`. A detailed description of OS images can be found in the corresponding [section](/iaas/architecture/os-images).
- `volumes` (`list`): Are list of `Volumes` attached to this machine. Here the first volume is considered as the root disk. Each volume is defined with a name and a reference to the `Volume` resource.
- `networkInterfaces` (`list`): Define a list of network interfaces present on the machine.
- `ignitionRef` (`string`): Is a reference to a `Secret` containing the ignition YAML for the machine to boot up. If the `key` value is empty, the `DefaultIgnitionKey=ignition` will be used as a fallback.

Detailed e2e examples on `Machine` creation with ephemeral/non-ephemeral `Volume` and `NetworkInterface`
- [Machine with ephemeral resources](https://github.com/ironcore-dev/ironcore/tree/main/config/samples/e2e/machine-with-ephemeral-resources)
- [Machine with non ephemeral resources](https://github.com/ironcore-dev/ironcore/tree/main/config/samples/e2e/machine-with-non-ephemeral-resources)

## MachineClass

A `MachineClass` is an IronCore resource used to represent a class/flavor of a `Machine`. It serves as a means to 
define the number of resources a `Machine` object can have as capabilities (e.g. CPU, memory) associated with a particular class. 

### Example MachineClass Resource

An example of how to define a `MachineClass` resource:

```yaml
apiVersion: compute.ironcore.dev/v1alpha1
kind: MachineClass
metadata:
  name: machineclass-sample
capabilities:
  cpu: 4
  memory: 16Gi
```

**Key Fields**:

- `capabilities` (`ResourceList`): Capabilities are used to define a list of resources a Machine can have, along with its capacity.

## MachinePool

A `MachinePool` is a resource in IronCore that represents a pool of compute resources managed collectively. It defines 
the infrastructure's compute configuration used to provision and manage `Machines`, ensuring resource availability and 
compatibility with associated `MachineClasses`.
 
> Note: One `machinepoollet` is responsible for one MachinePool.

Details on how `MachinePools` are announced and used can be found in the [Pools and Poollets](/iaas/architecture/scheduling) section.

### Example MachinePool Resource

An example of how to define a MachinePool resource:

```yaml
apiVersion: compute.ironcore.dev/v1alpha1
kind: MachinePool
metadata:
  name: machinepool-sample
spec:
  providerID: ironcore://shared
```

**Key Fields**:

- `providerID` (`string`): The `providerId` helps the controller identify and communicate with the correct compute system within the specific backend compute provider.
