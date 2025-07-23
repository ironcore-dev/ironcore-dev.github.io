# Core Resources

This guide describes the core resource types in IronCore and how to use them to manage and limit resource usage.

## ResourceQuota

A `ResourceQuota` in IronCore provides a mechanism to manage and limit the usage of resources across multiple 
requesting entities. This allows protecting the system from usage spikes and services can be kept responsive. With the 
help of `ResourceQuota`, you can set a hard limit with a list of resources and a `ScopeSelector` for a `Namespace`, restricting the amount of resources a user can create. 

::: tip
`ResourceQuota` is a namespaced resource, and it can only limit resource count/accumulated resource usage within a defined namespace.
:::

### Example ResourceQuota Resource

An example of how to define a `ResourceQuota` in IronCore:

```yaml
apiVersion: core.ironcore.dev/v1alpha1
kind: ResourceQuota
metadata:
  name: resource-quota-sample
spec:
  hard: # Hard is the mapping of strictly enforced resource limits.
    requests.cpu: "10"
    requests.memory: 100Gi
    requests.storage: 10Ti
```

### Key Fields:

- `hard` (`ResourceList`): Is a `ResourceList` of the strictly enforced number of resources. `ResourceList` is a list of ResourceName alongside their resource quantity.
- `scopeSelector` (`ResourceScopeSelector`): scopeSelector selects the resources that are subject to this quota. 

::: tip 
By using `scopeSelectors`, only certain resources like CPU and memory may be tracked.
:::
