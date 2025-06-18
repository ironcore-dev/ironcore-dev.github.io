# Core Resources

## ResourceQuota

A `ResourceQuota` in IronCore provides a mechanism to manage and limit the usage of resources across multiple 
requesting entities. This allows protecting the system from usage spikes and services can be kept responsive. With the 
help of `ResourceQuota` a hard limit with a list of resources along with `ScopeSelector` can be set for `Namespace` and
restricted hereby the amount of resources a user can create. 

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

- `hard`(`ResourceList`): Is a `ResourceList` of the strictly enforced number of resources. `ResourceList` is a list of ResourceName alongside their resource quantity.
- `scopeSelector`(`ResourceScopeSelector`): scopeSelector selects the resources that are subject to this quota. 

::: tip 
By using `scopeSelectors`, only certain resources like CPU and memory may be tracked.
:::

### Reconciliation Process:

- **Gathering matching evaluators**: The `ResourcequotaController` retrieves all the matching evaluators from the registry for the specified resources in hard spec. Each resource evaluator implements set of Evaluator interface methods which helps in retrieving the current usage of that particular resource type.
- **Calculating resource usage**: Resource usage is calculated by iterating over each evaluator and listing the namespace resource of that particular type. Listed resources are then filtered out by matching specified scope selector and accumulated usage is calculated.
- **Status update**: Once usage data is available, the `ResourceQuota` status is updated with the enforced hard resource limits and currently used resources.
- **Resource quota handling**: On request of create/update resources whether to allow creating/update based on `ResourceQuota` usage is handled via admission controller. Resources that would exceed the quota will fail with HTTP status code 403 Forbidden.
