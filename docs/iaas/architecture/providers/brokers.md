# Brokers

Brokers are a special type of provider that implement the `RuntimeInterface` for a specific resource group, such as compute or storage.
Instead of creating or reserving physical resources, brokers translate requests to another API server, which can be a 
different IronCore API cluster.

Below is an example of how a `machinepoollet` and `machinebroker` will translate resource from one API cluster to another:

![Brokers](/brokers.png)

Brokers are useful in scenarios where IronCore should not run in a single cluster but rather have a federated
environment. For example, in a federated environment, every hypervisor node in a compute cluster would announce its
MachinePool inside the compute cluster. A MachinePoollet/MachineBroker in this compute cluster could now announce
a logical MachinePool "one level up" as a logical compute pool in e.g. an availability zone cluster. The broker concept
allows you to design a cluster topology which might be important for large-scale deployments of IronCore (e.g., managing 
a whole datacenter region with multiple AZs).
