# Compute Resources

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
- `image` (`string`): Image is the optional URL providing the operating system image to memory boot the `Machine`. A detailed description of OS images can be found the corresponding [section](/iaas/architecture/os-images).
- `volumes` (`list`): Are list of `Volumes` attached to this machine. Here the first volume is considered as the root disk. Each volume is defined with a name and a reference to the `Volume` resource.
- `networkInterfaces` (`list`): Define a list of network interfaces present on the machine.
- `ignitionRef` (`string`): Is a reference to a `secret` containing the ignition YAML for the machine to boot up. If the `key` value is empty, the `DefaultIgnitionKey=ignition` will be used as a fallback.


### Reconciliation Process

1. **Machine Scheduling**:
   The `MachineScheduler` controller continuously watches for `Machines` without an assigned `MachinePool` and tries to schedule it on available and matching MachinePool.
- **Monitor Unassigned Machines**: The scheduler continuously watches for machines without an assigned `machinePoolRef`.
- **Retrieve Available Machine Pools**: The scheduler fetches the list of available machine pools from the cache.
- **Make Scheduling Decisions**: The scheduler selects the most suitable machine pool based on resource availability and other policies.
- **Update Cache**: The scheduler updates the cache with recalculated allocatable `machineClass` quantities.
- **Assign MachinePoolRef**: The scheduler assigns the selected `machinePoolRef` to the machine object.

More information on how the IRI contract works can be found in the [IronCore Runtime Interface (IRI)](/iaas/architecture/runtime-interface) section.

4. **Network Interface handling**: `MachineControllerNetworkinterface` takes care of attaching/detaching `NetworkInterfaces` defined for the `Machine`. Once the attachment is successful status is updated from `Pending` to `Attached`.

5. **Volume handling**: `MachineControllerVolume` takes care of attach/detach of `Volumes` defined for a `Machine`. Once the attachment is successful status is updated from `Pending` to `Attached`.

6. **Ephemeral resource handling**:
- The `Volume` and `NetworkIntreface` can be bound with the lifecycle of the Machine by creating them as ephemeral resources. (`Note`: For more details on how to create ephemeral resources refer to <a href="https://github.com/ironcore-dev/ironcore/tree/main/config/samples/e2e/machine-with-ephemeral-resources">Machine with ephemeral resources</a>)
- If a `NetworkIntreface` or a `Volume` is defined as ephemeral `MachineEphemeralControllers` takes care of creating and destroying respective objects on creation/deletion of the machine.

### Lifecycle and States

A Machine can be in the following states:
1. **Pending**:  A Machine is in a Pending state when the Machine has been accepted by the system, but not yet completely started. This includes time before being bound to a MachinePool, as well as time spent setting up the Machine on that MachinePool.
2. **Running**: A Machine in Running state when the machine is running on a MachinePool.
2. **Shutdown**: A Machine is in a Shutdown state.
3. **Terminating**: A Machine is Terminating.
2. **Terminated**: A Machine is in the Terminated state when the machine has been permanently stopped and cannot be started.

## MachineClass

A `MachineClass` is an IronCore resource used to represent a class/flavor of a `Machine`. It serves as a means to 
define the number of resources a `Machine` object can have as capabilities (e.g. CPU, memory) associated with a 
particular class. 

### Example Machine Resource

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

- capabilities (`ResourceList`): capabilities are used to define a list of resources a Machine can have along with its capacity.

## MachinePool

A `MachinePool` is a resource in IronCore that represents a pool of compute resources managed collectively. It defines 
the infrastructure's compute configuration used to provision and manage `Machines`, ensuring resource availability and 
compatibility with associated `MachineClasses`. (`Note`: One `machinepoollet` is responsible for one `MachinePool`)

Details on how `Pools` are announced and used can be found in the [Pools and Poollets](/iaas/architecture/scheduling) section.

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

- `ProviderID`(`string`):  The `providerId` helps the controller identify and communicate with the correct compute 
  system within the specific backend compute provider.
