# IPAM Resources

This guide explains how to use IronCore's integrated IP address management (IPAM) resources to define and manage IP prefixes and allocations.

## Prefix

A `Prefix` resource provides a fully integrated IP address management (IPAM) solution inside IronCore. It serves as a 
means to define IP prefixes along with prefix length to a reserved range of IP addresses. It is also possible to define
child prefixes with the specified prefix length referring to the parent prefix.

### Example Prefix Resource

An example of how to define a root `Prefix` resource in IronCore:

```yaml
apiVersion: ipam.ironcore.dev/v1alpha1
kind: Prefix
metadata:
  name: root
  labels:
    root-prefix: customer-1
spec:
  prefix: 10.0.0.0/24
```

An example of how to define a child `Prefix` resource in IronCore:

```yaml
apiVersion: ipam.ironcore.dev/v1alpha1
kind: Prefix
metadata:
  name: child-prefix
spec:
  ipFamily: IPv4
  prefixLength: 9
  parentSelector:
    matchLabels:
      root-prefix: customer-1
```

### Key Fields:

- `ipFamily` (`string`): Is the IPFamily of the prefix. If unset but `Prefix` is set, this can be inferred.
- `prefix` (`string`): 	`prefix` is the IP prefix to allocate for this Prefix.
- `prefixLength` (`int`): `prefixLength` is the length of prefix to allocate for this Prefix.
- `parentRef` (`string`): `parentRef` references the parent to allocate the Prefix from. If `parentRef` and `parentSelector` is empty, the Prefix is considered a root prefix and thus allocated by itself.
- `parentSelector` (`LabelSelector`): `parentSelector` is the LabelSelector to use for determining the parent for this Prefix.

Once prefix allocation is successful, status is updated to `Allocated`. In the case of sub-prefixes once the prefix is allocated the parent Prefix's status gets updated with the used prefix IPs list.

Below is the sample `Prefix.status`:

```yaml
status:
  lastPhaseTransitionTime: "2024-10-21T20:56:24Z"
  phase: Allocated
  used:
  - 10.0.0.1/32
  - 10.0.0.2/32
```
