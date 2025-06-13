# Project Design Principles

## 1. Declarative Kubernetes APIs
All functionality must be exposed via declarative Kubernetes APIs. Use Custom Resource Definitions (CRDs) or the API aggregation layer where appropriate. Services should model their state using Kubernetes resources.

## 2. Minimal API Surface
When introducing new features, expose only the essential fields. Avoid over-designing or leaking internal implementation details into the API.

## 3. Separation of Concerns
Clearly separate different problem domains. Don’t mix unrelated concerns in a single API or component. Define strict API contracts between boundaries.

## 4. Kubernetes API Conventions
Follow official Kubernetes API conventions when designing or extending APIs:  
➡️ [Kubernetes API Conventions Guide](https://github.com/kubernetes/community/blob/master/contributors/devel/sig-architecture/api-conventions.md)

## 5. No Scripting for Deployment
Avoid Bash, Python, or other scripting languages for deployment tasks. All components must be declaratively deployable using Kubernetes manifests or tools like Helm or Kustomize.
