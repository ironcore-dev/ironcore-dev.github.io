---
outline: [2, 4]
---

# Management Cluster Bootstrap Guide

::: info
The ansible roles referenced in this guide will be published soon. Until then, all steps can be executed manually from the manifests and commands shown here.
:::

## Overview

The goal of this bootstrap guide is to stand up a self-managed CAPI Kubernetes cluster on bare metal, running the full IronCore metal stack. This cluster is the foundation of a new availability zone (AZ), and every workload cluster in that AZ will be provisioned from it. Once complete, the cluster provisions and manages itself: adding, replacing, or upgrading its own control-plane nodes through Cluster API.

Since IronCore needs a running Kubernetes cluster to manage bare metal machines, we solve the chicken-and-egg problem with a temporary bootstrap: install a single-node Kubernetes on the first management server (mgmt-1) with kubeadm, deploy the metal stack on it, and use it to provision a proper CAPI-managed cluster on a second server (mgmt-2). Once the CAPI cluster is up, we pivot all CAPI resources over (via `clusterctl move`) and scale it to three control-plane nodes by joining mgmt-1 and mgmt-3. The mgmt-1 host is *reused*: it first runs the temporary single-node bootstrap cluster, then - after pivot - is reprovisioned by CAPI as a regular control-plane node. The final cluster is mgmt-1 + mgmt-2 + mgmt-3, a HA CAPI-self-managed management cluster.

```text
mgmt-1 (bootstrap)  -->  mgmt-2 (CAPI CP)  -->  mgmt-1, mgmt-3 join
   Install K8s              Boot via CAPI          Scale to 3 CP
   Deploy metal stack       Take over
   Create CAPI cluster      Pivot workloads
```

---

## Conventions

Addressing and placeholder conventions used throughout this guide:

- All IPv6 addresses come from the RFC 3849 documentation prefix `2001:db8::/32`. Replace this with your real base (`ipv6_base`) everywhere.
- `1111` is the example zone's `ipv6_block`, so the zone prefix is `2001:db8:1111::/48` throughout: `ipv6_prefix = <ipv6_base>:<ipv6_block>`. Each zone gets its own `ipv6_block`, which must match what is configured for the zone in the roles.
- The fourth hextet carves the zone prefix into functions: `1234` is the service range (`SVC_CIDR` = `2001:db8:1111:1234::/112`), and `0001`/`0002`/`0003` are the per-node `/64` host prefixes for mgmt-1/2/3. There is no cluster-wide pod range: each node's `podCIDR` is a `/112` carved out of its own host `/64`, offset to `::1:0` so it never overlaps the node's own `::1` loopback (e.g. mgmt-1's pod CIDR is `2001:db8:1111:1::1:0/112`, sub-range of `2001:db8:1111:1::/64`), and the node's loopback / `INTERNAL-IP` is the `::1` of its `/64` (e.g. `2001:db8:1111:1::1` for mgmt-1).
- A LoadBalancer service with cluster IP `SVC_CIDR::xyz` gets the external, publicly routable counterpart `SVC_CIDR::1:xyz` (see [1.3](#_1-3-post-install)).
- `<zone>` stands for your zone name (e.g. `zone1` in the delivery), `<capi_version>` / `<k8s_version>` / `<tag>` for versions you pin.
- Code blocks are pasteable once you have exported `SVC_CIDR` and `ZONE` for your environment:
  ```bash
  export SVC_CIDR=2001:db8:1111:1234::/112   # your zone's service range
  export ZONE=zone1                          # your zone name
  ```

### Versions used in this guide

The guide was validated against the versions below. Newer releases may change behavior — check these first if instructions don't match what you see.

| Component | Version in this guide | Notes |
|---|---|---|
| Kubernetes (kubeadm/kubelet) | v1.34.6 | also the version of the CAPI-provisioned cluster |
| Cluster API / clusterctl | v1.12.2 | same version for `clusterctl init` and `clusterctl move` |
| cert-manager | v1.19.1 | must match `CertManagerDefaultVersion` of the chosen CAPI release (see [2.2](#_2-2-cluster-api)) |
| Calico | v3.31.5 | pinned by the kubernetes role |
| metal-operator | v0.7.x (≥ v0.7.1) | the FeDHCP integration requires the v0.7 series; **do not use ≥ v0.8.0** (incompatible, blocked by [FeDHCP#456](https://github.com/ironcore-dev/FeDHCP/issues/456): FeDHCP does not yet create `BMC` resources during discovery). Bundled metaldata requires ≥ v0.7.1. |
| metalprobe | `<tag>` | part of metal-operator; keep the probe image tag in lockstep with your metal-operator release |
| GardenLinux CAPI image | `<tag>` | the CAPI variant (kubeadm/kubelet bundled), see [3.2](#_3-2-capi-resources) |
| FeDHCP | v0.8.7 (`config/default`) | OOB + inband; well-known LB addresses in [2.4](#_2-4-data-plane-and-services) |
| cloud-provider-metal (CCM) | v0.6.0 | assigns node addresses and offset pod CIDRs on the CAPI cluster ([4.2.1](#_4-2-1-cloud-controller-manager)) |

---

## Prerequisites (before running any phase)

- **Three management servers** (mgmt-1, mgmt-2, mgmt-3). One used initially as the bootstrap host, the other two joined as CAPI control-plane nodes during scale-up.
- Hardware racked, cabled, powered.
- Network configured. Routers and switches provisioned with BGP and the zone's IPv6 prefix; south-facing switch ports (facing mgmt/compute/storage servers) have a DHCP relay pointed at the well-known FeDHCP address.
- NAT64 + DNS64 egress for the IPv6-only nodes. A NAT64 gateway on the routers (e.g. [Jool](https://www.jool.mx/)) translates IPv6 traffic to IPv4, and a DNS64 resolver reachable from the inband machines (e.g. Google Public DNS64 at `2001:4860:4860::64`) synthesizes AAAA records for IPv4-only destinations. Together they let IPv6-only nodes look up and reach IPv4-only internet services - needed even before Kubernetes is up (to install packages from IPv4-only apt mirrors) and throughout the stack: the IronCore manifests and container images are pulled from [GitHub](https://github.com) and [ghcr.io](https://ghcr.io), both IPv4-only endpoints.
- Metalbond running on the routers for the network overlay (announces reachability for tenant VM prefixes across the fabric).
- The zone's addresses and prefixes per [Conventions](#conventions) are properly assigned: routers/switches know the zone prefix, and per-host `/64`s, the service range, and pod ranges are unambiguous.

### Config files to prepare

- BMC MAC addresses collected for every management/compute/storage server.
- `metal-config-<zone>.yaml` prepared. FeDHCP discovery plugin configuration (hostname -> MAC); see the example in [6.2](#_6-2-update-discovery-configuration).
- `oob-mac-prefixes-<zone>.yaml` prepared. Used by metal-operator for BMC discovery (MAC prefix -> BMC creds); see the example in [6.2](#_6-2-update-discovery-configuration).

> **Checkpoint.** mgmt-1 is up with working IPv6, NAT64, and DNS64 connectivity, ready for the bootstrap process.
>
> Verify end-to-end egress to an IPv4-only host (proves DNS64 + NAT64 together):
> ```bash
> curl -6 -sS -o /dev/null -w '%{http_code}\n' https://github.com   # expect 200 or 3xx
> ```

---

## Phase 1: Install Kubernetes (mgmt-1)

Install a single-node Kubernetes cluster on the first management server using kubeadm. This cluster is temporary. It only needs to live long enough to run the IronCore metal stack and provision the real CAPI cluster on the second management machine.

### 1.1 Host preparation

For the first management server follow the upstream guide for the standard steps (OS deps, containerd runtime, kernel modules, sysctls, apt repo, installing `kubelet`/`kubeadm`/`kubectl`):

- [Installing kubeadm](https://kubernetes.io/docs/setup/production-environment/tools/kubeadm/install-kubeadm/)

IronCore-specific additions on top of the upstream guide:

- **Overlay module options**: Set `metacopy=off redirect_dir=on` in `/etc/modprobe.d/overlay.conf`. Required for containerd layer extraction on the kernels we ship.
- **containerd CNI bin dir**: Use `/var/lib/containerd/io.containerd.grpc.v1.cri.cni` (matches what Calico is configured to install into later).

> **Checkpoint.** mgmt-1 has containerd running, `kubelet`/`kubeadm`/`kubectl` installed and pinned, kernel modules and sysctls in place. The host is ready to run `kubeadm init`.
>
> Verify the runtime and tooling are active:
> ```bash
> systemctl is-active containerd kubelet   # expect: active
> kubeadm version -o short                 # expect: v1.34.x
> ```

### 1.2 kubeadm init

Follow the upstream guide for the general `kubeadm init` flow and options:

- [Creating a cluster with kubeadm](https://kubernetes.io/docs/setup/production-environment/tools/kubeadm/create-cluster-kubeadm/)

Define once for the zone:

- **Service CIDR block (`SVC_CIDR`)**: The zone service subnet, e.g. `2001:db8:1111:1234::/112` - the `1234` service range layered on top of the zone prefix (`ipv6_prefix`, see [Prerequisites](#prerequisites-before-running-any-phase)). Used for both the bootstrap cluster and the CAPI-managed cluster that replaces it. Keeping them identical is important: the DHCP relays on the switches are already configured to forward requests to the FeDHCP LoadBalancer IP inside this range. Changing the CIDR between bootstrap and CAPI cluster would force a switch reconfiguration, which we want to avoid.

IronCore-specific settings for the kubeadm config:

- **IPv6-only**: `advertiseAddress` and `controlPlaneEndpoint` are the node's global IPv6 /128 (the loopback announced via BGP). No IPv4.
- **Service subnet**: Set `serviceSubnet` to `SVC_CIDR`.
- **No control-plane taint**: Set `nodeRegistration.taints: []`. This is a single-node bootstrap that must schedule workloads.
- **Kubelet serving certs via CSR**: `serverTLSBootstrap: true` in the KubeletConfiguration. CSRs get approved in the post-install step.
- **Bind controller-manager and scheduler to `::1`**: IPv6-only cluster.
- **Cluster DNS**: Pin explicitly to `SVC_CIDR::a` to mirror the IPv4 convention (kubeadm's default IPv4 service CIDR `10.96.0.0/12` places CoreDNS at `10.96.0.10`, the 10th IP in the range). Exposed as a LoadBalancer service in Phase 2 via metal-load-balancer-controller + FRR.

Then run `kubeadm init --config /root/kubeadm-init.yaml`.

> **Checkpoint.** `kubeadm init` completed successfully on mgmt-1. The Kubernetes API server, etcd, controller-manager, and scheduler are running on IPv6-only, the components bound to `::1` and the API server advertising the node's global `/128`.
>
> Verify the API server is up and serving over IPv6:
> ```bash
> export KUBECONFIG=/etc/kubernetes/admin.conf
> kubectl cluster-info          # control plane running at https://[2001:db8:1111:1::1]:6443
> kubectl get --raw='/readyz'   # expect: ok
> kubectl get node mgmt-1       # registered (NotReady - no CNI yet)
> ```

### 1.3 Post-install

After `kubeadm init` completes, a few IronCore-specific fixups:

- **Approve kubelet serving CSRs**: Because we set `serverTLSBootstrap: true`, the kubelet requests its serving certificate via CSR. Approve the pending CSRs signed by `kubernetes.io/kubelet-serving`.
- **Patch the node's `podCIDRs`**: kubeadm does not assign pod CIDRs, those are assigned by the cloud-controller-manager on CAPI clusters only. Patch the node manually with the node's `/112` pod CIDR - a sub-range of its `/64` host prefix, offset to `::1:0` so it does not overlap the node's own `::1` loopback (see [Prerequisites](#prerequisites-before-running-any-phase)), e.g. `2001:db8:1111:1::1:0/112` for mgmt-1.
- **Prepend the cluster DNS to `/etc/resolv.conf`**: Add the CoreDNS *external* LoadBalancer address (`SVC_CIDR::1:a`) as the first nameserver on the inband machines so kubectl and curl can resolve in-cluster service names like `metaldata.example.com` and `boot.onmetal.de` that CoreDNS rewrites internally. In Phase 2 we deploy CoreDNS as a `LoadBalancer` service; the load balancer assigns each `SVC_CIDR::XYZ` cluster IP a publicly routable counterpart at `SVC_CIDR::1:XYZ`. In this case: cluster IP `SVC_CIDR::a` maps to external IP `SVC_CIDR::1:a`. The inband machines use the external address because they do not sit on the cluster's service network. We use [metal-load-balancer-controller](https://github.com/ironcore-dev/metal-load-balancer-controller) with FRR to announce these addresses via BGP; alternatively, use a publicly available load balancer like MetalLB.

Once these are done, the bootstrap cluster is a functional single-node Kubernetes ready to receive the metal stack (Phase 2).

> **Checkpoint.** mgmt-1 has its `podCIDRs` patched, kubelet serving CSRs approved, and the host's `/etc/resolv.conf` points at the future CoreDNS LoadBalancer address. The bootstrap Kubernetes cluster is up and ready to receive the metal stack (Phase 2). Note: the node is still `NotReady` - Calico gets deployed in Phase 2.
>
> Verify the post-install fixups landed:
> ```bash
> export KUBECONFIG=/etc/kubernetes/admin.conf
> kubectl get csr | grep -c Pending                              # expect zero matches (all serving CSRs approved)
> kubectl get node mgmt-1 -o jsonpath='{.spec.podCIDRs}' ; echo # expect: ["2001:db8:1111:1::1:0/112"]
> grep -m1 nameserver /etc/resolv.conf                           # expect: the SVC_CIDR::1:a LB address
> ```

---

## Phase 2: Deploy Metal Stack (bootstrap cluster)

Deploy the IronCore metal stack on the bootstrap cluster. This installs all CRDs, controllers, and network services needed to discover and provision bare metal servers. Everything runs on the bootstrap cluster so we can use it to bring up the *real* CAPI-managed cluster in Phase 3. In this phase the bootstrap cluster **is** the metal API cluster - the Kubernetes cluster whose API the metal controllers talk to in order to read and write metal CRs (`Server`, `ServerClaim`, `IroncoreMetalMachine`, ...). The one exception is the cloud-controller-manager, which is not deployed on the bootstrap cluster at all (it is CAPI-cluster-only, see [Phase 4](#phase-4-deploy-metal-stack-on-capi-cluster)); on the bootstrap cluster pod CIDRs are patched manually instead ([1.3](#_1-3-post-install)). The metal API is repointed at the CAPI cluster in Phase 6.

For per-component details refer to the upstream docs:

- IronCore metal stack overview: [ironcore.dev/baremetal](https://ironcore.dev/baremetal/)
- metal-operator quickstart: [ironcore.dev/metal-operator/quickstart.html](https://ironcore.dev/metal-operator/quickstart.html)
- Cluster API core: [cluster-api.sigs.k8s.io](https://cluster-api.sigs.k8s.io/)
- Calico: [docs.tigera.io](https://docs.tigera.io/calico/)
- cert-manager: [cert-manager.io/docs](https://cert-manager.io/docs/)

### 2.1 CNI and TLS baseline

#### 2.1.1 Calico

IPv6 CNI. Applied via kustomize with patches to the upstream `calico.yaml`:
- **`calico-config` ConfigMap** (`patch-configmap-ipv6.yaml`):
  - `calico_backend: none` - policy-only mode, BIRD/BGP disabled (the fabric BGP from the network prerequisites handles reachability).
  - CNI plugin config: `host-local` IPAM with `subnet: usePodCidrIPv6`, `assign_ipv4: false`, `assign_ipv6: true`; `portmap.snat: false`.
- **`calico-node` DaemonSet** (`patch-daemonset-ipv6.yaml`):
  - Env: `IP=none`, `IP6=autodetect`, `FELIX_IPV6SUPPORT=true`, `USE_POD_CIDR=true`, `CALICO_IPV4POOL_IPIP=Never`.
  - Liveness/readiness probes reduced to `-felix-live` / `-felix-ready` (BIRD checks removed).

#### 2.1.2 cert-manager

TLS certificate lifecycle for webhooks. Installed *manually* (not via `clusterctl init --core-provider`) so it stays under our control across upgrades.
- Applied via kustomize pointing at the upstream release `https://github.com/cert-manager/cert-manager/releases/download/<version>/cert-manager.yaml`.
- The version **must match** what `clusterctl` would install for the chosen CAPI version; otherwise `clusterctl init` will try to install its own copy and conflict. Look up `CertManagerDefaultVersion` for your `capi_version` at [cluster-api/cmd/clusterctl/client/config/cert_manager_client.go](https://github.com/kubernetes-sigs/cluster-api/blob/<capi_version>/cmd/clusterctl/client/config/cert_manager_client.go).
- If you do not need any kustomization on top of the upstream manifests, you can skip this step entirely: `clusterctl init` in [2.2](#_2-2-cluster-api) will install cert-manager automatically.

> **Checkpoint.** Calico and cert-manager are running; the bootstrap cluster node is `Ready` and admission webhooks can be served.
>
> Verify:
> ```bash
> kubectl get node mgmt-1                                       # registered and Ready now with CNI
> kubectl -n kube-system rollout status daemonset/calico-node   # calico-node rolled out
> kubectl -n cert-manager wait --for=condition=Available deployment --all --timeout=120s   # cert-manager, cainjector, webhook ready
> ```

### 2.2 Cluster API

#### 2.2.1 clusterctl

download the binary matching `capi_version` from the [CAPI releases page](https://github.com/kubernetes-sigs/cluster-api/releases). Same version used both for `clusterctl init` and for `clusterctl move` later.

#### 2.2.2 CAPI core + kubeadm providers

set `EXP_KUBEADM_BOOTSTRAP_FORMAT_IGNITION=true` in the environment before running `clusterctl init` (the GardenLinux OS image in Phase 3 consumes an Ignition userdata format, which the kubeadm bootstrap provider only emits when this feature gate is enabled), then initialize:
```bash
EXP_KUBEADM_BOOTSTRAP_FORMAT_IGNITION=true clusterctl init \
  --core cluster-api:<capi_version> \
  -b kubeadm:<capi_version> \
  -c kubeadm:<capi_version>
```

#### 2.2.3 cluster-api-provider-ironcore-metal

the IronCore-specific CAPI infrastructure provider. Installs the `IroncoreMetalCluster` / `IroncoreMetalMachine` / `IroncoreMetalMachineTemplate` CRDs. Apply the latest release from [cluster-api-provider-ironcore-metal](https://github.com/ironcore-dev/cluster-api-provider-ironcore-metal/releases).

### 2.3 Metal control-plane

At this stage only **mgmt-2** is listed in `metal-config-<zone>.yaml` (FeDHCP) and `oob-mac-prefixes-<zone>.yaml` (metal-operator). That way it is the only server discovered on the bootstrap cluster - just enough to bring up the CAPI cluster in Phase 3. mgmt-1 and mgmt-3 are added later in Phase 6.

#### 2.3.1 boot-operator

HTTP and/or iPXE boot server. Serves OS images to servers being provisioned. Applied via kustomize on top of `github.com/ironcore-dev/boot-operator/config/default`.

**Common (both boot flavors).**
- **Service**: A dedicated `boot-operator-service` of type `LoadBalancer` in the `boot-operator-system` namespace, exposing port `8083`. The `clusterIP` is pinned explicitly (e.g. `SVC_CIDR::efac`) so the address is stable and predictable - metal-load-balancer-controller then assigns the corresponding external `SVC_CIDR::1:efac`. The same service is reused for HTTP boot and iPXE.
- **Controllers**: enable the flavor(s) you need via `--controllers=`:
  - HTTP boot: `httpbootconfig,serverbootconfighttp`
  - iPXE boot: `ipxebootconfig,serverbootconfigpxe`

  Prefer one flavor per environment: enabling both is racy on current boot-operator releases (see [boot-operator#292](https://github.com/ironcore-dev/boot-operator/pull/292)) and dual-mode support may be dropped upstream.

**HTTP boot.**
- **Controllers**: `httpbootconfig,serverbootconfighttp`. Reconcile `HTTPBootConfig` objects and serve them.
- **Bind address**: `--boot-server-address=:8083`.
- **Image proxy**: `--image-proxy-server-address=:8084`. Serves the OS image artifacts to provisioning servers over HTTP (separate from the HTTP-boot config endpoint on `:8083`).
- **Image server URL**: `--image-server-url=http://[SVC_CIDR::1:efac]:8083/httpboot`. This is what boot-operator embeds into `HTTPBootConfig` resources - it must be the **external** LB address, because bare metal servers being provisioned reach it from outside the cluster network.
- **Default OS image**: `--default-httpboot-oci-image=ghcr.io/ironcore-dev/gardenlinux:2150.0.0-metal`. (Older deployments use `--default-httpboot-uki-url=http://[<lb>]:8083/httpboot/gl-uki.efi` pointing at a UKI - the flag is deprecated in favour of the OCI variant but still works.)

**iPXE boot.**
- **Controllers**: `ipxebootconfig,serverbootconfigpxe`. Reconcile `IPXEBootConfig` objects and serve them.
- **iPXE service URL**: `--ipxe-service-url=http://[SVC_CIDR::1:efac]:8083`. Setting this directly is the simplest path - it overrides the default `--ipxe-service-port=5000` and the `IPXE_SERVER_ADDRESS` env-var fallback. Must be the **external** LB address, same reason as above.

#### 2.3.2 metal-operator

BMC discovery and lifecycle. Applied via kustomize on top of [metal-operator](https://github.com/ironcore-dev/metal-operator) v0.7.1 (`config/default`) with these additions/patches:
- **MAC prefix DB**: The `oob-mac-prefixes-<zone>.yaml` file (see [Prerequisites](#prerequisites-before-running-any-phase)) is generated as a `macdb` Secret in the `metal-operator-system` namespace and mounted at `/etc/macdb/macdb.yaml`.
- **`hostNetwork: true`**: The controller talks to BMCs directly on the OOB network; it must run on the host's network namespace, not through the CNI. Deployment strategy set to `Recreate` (only one instance can bind the host ports).
- **Registry service**: A dedicated `metal-registry-service` of type `LoadBalancer`, port `30010` -> target `10000` (the manager's discovery registry). The `clusterIP` is pinned (e.g. `SVC_CIDR::cafe`) so the external LB address is `SVC_CIDR::1:cafe`. `--registry-url` is set to that external address so probing servers - which sit outside the cluster network - can reach the registry during first-boot discovery.
- **Controller args**:
  - `--mac-prefixes-file=/etc/macdb/macdb.yaml` - path to the mounted MAC DB.
  - `--probe-image=ghcr.io/ironcore-dev/metalprobe:<tag>` - the probe binary/image pulled by servers being inspected.
  - `--probe-os-image=ghcr.io/ironcore-dev/gardenlinux:2150.0.0-metal` - OS image used by the probe phase.
  - `--registry-url=http://[SVC_CIDR::1:cafe]:30010` - external LB URL of `metal-registry-service`, embedded into probe workflows. Must be the **external** LB address, same reason as boot-operator. This registry is the endpoint a server posts its hardware capabilities back to during the probe phase; metal-operator consumes those posted capabilities to populate the `Server` resource's `.status` (inventory, CPU, memory, storage, NICs), which is what drives a server from discovery into the `Available` state a `ServerClaim` can bind.
- **Boot behavior**: metal-operator runs with `--enforce-first-boot=true` from the start (needed for mgmt-1 in Phase 6, see [6.3](#_6-3-wait-for-server-discovery)); any mgmt server that is already powered on at discovery time will be power-cycled into its first boot.

### 2.4 Data plane and services

#### 2.4.1 FeDHCP

OOB and inband DHCPv6 servers. Two separate deployments, one per network plane. The pods listen on UDP `1547` (FeDHCP runs unprivileged and cannot bind the privileged port 547), while each `LoadBalancer` service keeps the standard DHCPv6 port `547` on the front and forwards to `1547` on the pod. That way the switch DHCP relays only need to know the service IP - the port is the well-known DHCPv6 one. The switches **must be configured** to relay to these well-known addresses: **OOB switch ports** relay DHCPv6 to `SVC_CIDR::1:1547` (the OOB FeDHCP LB), and **inband switch ports** relay to `SVC_CIDR::1:547` (the inband FeDHCP LB). Applied via kustomize on top of [FeDHCP](https://github.com/ironcore-dev/FeDHCP) v0.8.7 (`config/default`).

**OOB (BMC discovery network).**
- **Service**: `LoadBalancer`, `clusterIP` pinned to `SVC_CIDR::1547` -> external `SVC_CIDR::1:1547`. This is the well-known FeDHCP address the switch DHCP relays point at (see [Prerequisites](#prerequisites-before-running-any-phase)).
- **Plugins enabled** (in order):
  1. `server_id` - DHCPv6 server DUID.
  2. `searchdomains` - DNS search domains to hand out.
  3. `dns` - upstream resolvers (public DNS64).
  4. `ntp` - NTP servers, from `ntp-config.yaml`.
  5. `stateless` - stateless address configuration.
  6. `metal` - matches incoming DHCP requests by client MAC against `metal-config-<zone>.yaml` (mgmt-2 only at this stage) and creates an `Endpoint` CR (an IronCore metal-operator CRD) for each seen client MAC. metal-operator reconciles those `Endpoint`s and drives the BMC discovery flow from there (see [metal-operator architecture](https://ironcore.dev/metal-operator/architecture.html)). This is why a BMC's DHCPv6 request is the trigger for discovery, not the DHCP lease itself.
  7. `leases` - lease bookkeeping, from `leases-config.yaml`.
- **ConfigMaps**: The OOB kustomization applies a `nameSuffix: -oob`, so the generated ConfigMaps are `metal-config-oob`, `leases-config-oob`, and `ntp-config-oob`, and the deployment is `fedhcp-oob` (all referenced with these suffixed names). FeDHCP's main `config` ConfigMap is likewise suffixed. Generated via `configMapGenerator`. The `-oob`-suffixed names are what [6.2](#_6-2-update-discovery-configuration) updates with the full mgmt server MAC set.

**Inband (data network).**
- **Service**: `LoadBalancer`, `clusterIP` pinned to `SVC_CIDR::547` -> external `SVC_CIDR::1:547`.
- **Plugins enabled** (in order):
  1. `server_id` - DHCPv6 server DUID (different from OOB).
  2. `dns` - cluster CoreDNS + public DNS64 fallbacks.
  3. `ntp` - same NTP config as OOB.
  4. `stateless` - stateless address configuration.
  5. `httpboot` - returns the boot-operator HTTP boot URL, from `httpboot-config.yaml` (points at `http://[SVC_CIDR::1:efac]:8083/httpboot`).
  6. `leases` - lease bookkeeping.
- **ConfigMaps**: All plugin config files (`httpboot-config`, `leases-config`, `ntp-config`) and FeDHCP's main `config` are generated via `configMapGenerator`.
- **PXE / iPXE variant**: For iPXE boot instead of HTTP boot, replace the `httpboot` plugin with the `pxeboot` plugin. Configure it with the TFTP server address serving the iPXE loader and the iPXE script URL the loader should chainload, `http://[SVC_CIDR::1:efac]:8083/ipxe` (served by boot-operator, see [2.3](#_2-3-metal-control-plane)). iPXE additionally requires a TFTP server serving the iPXE binary from [ipxe.org](https://ipxe.org/) - FeDHCP hands out the boot filename via `pxeboot`, and the client fetches the iPXE loader over TFTP before chainloading over HTTP to that URL.

#### 2.4.2 metaldata

instance metadata service, reachable at `metaldata.example.com` (rewritten by CoreDNS - see [CoreDNS](#_2-4-4-coredns)). At first provisioning, the OS image's Ignition config queries this service's v1 API (`/v1`, with a `Metadata-Flavor: IronCore Metal` request header) to fetch the node's per-host metadata - primarily its `server-name` (`<type>-<zone>-<index>`, e.g. `mgmt-zone1-1`) and IPv6 `prefix`. The host's first-boot logic then derives the hostname, zone, and index from `server-name` and renders FRR/BGP config, hostname, and network interface files from that metadata. Without metaldata, first-boot provisioning cannot complete. Since metal-operator v0.7.1 the metaldata DaemonSet is bundled inside metal-operator, so the service runs in the `metal-operator-system` namespace as Service `metal-operator-metaldata`. Applied via kustomize on top of [metal-operator](https://github.com/ironcore-dev/metal-operator) v0.7.1.

- **User-defined metadata attributes**: Beyond the built-in fields, the operator can attach arbitrary key-value pairs to the response by annotating (or labeling) the `Server` resource with `metadata.metal.ironcore.dev/<key>: <value>`; every such key is surfaced as a top-level field in the `/v1/` JSON (and individually at `/v1/<key>`). A separate `user-data` map (served at `/v1/user-data` and `/v1/user-data/<key>`) is delivered through the `ServerClaim`'s `UserDataRef`, which points at a `Secret` holding the user-data - this is also how a fully-rendered Ignition can be handed to a host via `ignition.config.url=metaldata.example.com/v1/user-data/ignition` on the kernel cmdline. The bootstrap roles only consume the built-in `server-name`/`prefix` fields, but custom first-boot logic can rely on these user attributes the same way. See [IEP-18](https://github.com/ironcore-dev/enhancements/blob/main/ieps/18-metaldata.md) for the full API.

#### 2.4.3 metal-load-balancer-controller (MLBc)

announces `LoadBalancer` service IPs via BGP/FRR. Maps each `SVC_CIDR::XYZ` cluster IP to a publicly routable `SVC_CIDR::1:XYZ` address (see [1.3](#_1-3-post-install)). Applied via kustomize on top of the latest release of [metal-load-balancer-controller](https://github.com/ironcore-dev/metal-load-balancer-controller) (`config/default`) with these additions/patches:
- **Manager on the host network**: `hostNetwork: true` and `hostPID: true` so the controller can peer with the host's FRR instance (set up as part of the network prerequisites) and announce the external LB addresses over the fabric BGP session.
- **Metalbond speaker disabled**: The upstream chart ships a `metal-load-balancer-speaker-controller` DaemonSet (for setups that use metalbond to announce LB IPs). We announce via the fabric BGP directly, so this DaemonSet is deleted via a kustomize `$patch: delete`.

#### 2.4.4 CoreDNS

replace the default cluster DNS with an IronCore-tuned Corefile. Deployed by patching the existing `kube-system/coredns` ConfigMap (kustomize `configMapGenerator` for the `Corefile` key) and switching the `kube-dns` service to `LoadBalancer` so it gets an external IP announced via BGP. Cluster IP stays `SVC_CIDR::a`, external LB becomes `SVC_CIDR::1:a` (see [1.3](#_1-3-post-install)).

Key Corefile differences from the upstream default:
- **k8s_external for the zone domain**: `k8s_external <zone>.example.com` - lets DNS resolve `<svc>.<ns>.<zone>.example.com` from outside the cluster (via the external LB IP of the service). Used by the DNS rewrites below.
- **DNS64 upstreams**: `forward . 2001:4860:4860::6464 2001:4860:4860::64` - IPv6-only hosts resolve IPv4 destinations through Google Public DNS64.
- **Cache exceptions**: `cache 30 { disable success cluster.local; disable denial cluster.local }` - never cache in-cluster lookups (avoids stale results across pod restarts).
- **Rewrites for well-known bootstrap names**:
  - `rewrite name boot.onmetal.de boot-operator-service.boot-operator-system.<zone>.example.com` - the domain `boot.onmetal.de` is **hard-coded into the GardenLinux UKI images**, so HTTP boot needs this rewrite to reach boot-operator. Can be dropped if you only use PXE (iPXE) boot instead of HTTP boot with UKI images.
  - `rewrite name metaldata.example.com metal-operator-metaldata.metal-operator-system.<zone>.example.com` - first-boot Ignition resolves the metadata service (see [metaldata](#_2-4-2-metaldata)). The metal-operator kustomize applies `namePrefix: metal-operator-`, so the bundled DaemonSet's Service is `metal-operator-metaldata` (namespace `metal-operator-system`, from metal-operator v0.7.1 onwards).

> **Checkpoint.** The bootstrap cluster runs the full IronCore metal stack: Calico, cert-manager, CAPI core + IronCore metal provider, boot-operator, metal-operator (with bundled metaldata), MLBc, FeDHCP, and CoreDNS. Servers begin appearing as `Server` resources as their BMCs are discovered.
>
> Verify the stack is up:
> ```bash
> kubectl get pods -A                                                # all Ready
> kubectl get crds | grep -E 'metal.ironcore.dev|boot.ironcore.dev|ironcoremetal'
> kubectl get svc -n kube-system kube-dns                            # LoadBalancer with EXTERNAL-IP ${SVC_CIDR%%/*}::1:a
> kubectl get node mgmt-1 -o wide                                    # STATUS=Ready, INTERNAL-IP=2001:db8:1111:1::1
> kubectl get node mgmt-1 -o jsonpath='{.spec.taints}' ; echo        # expect: [] (or unset)
> kubectl get node mgmt-1 -o jsonpath='{.spec.podCIDRs}' ; echo      # expect: ["2001:db8:1111:1::1:0/112"]
> kubectl get servers.metal.ironcore.dev                             # mgmt-2 discovered
> ```

> **Checkpoint (connectivity).** The full data path works end-to-end: CoreDNS resolves and rewrites, MLBc announces the external LB addresses over BGP, and the boot/metal/FeDHCP services are reachable from mgmt-1. Once this passes, the bootstrap cluster is ready to define the CAPI cluster in Phase 3.
>
> Verify from mgmt-1 (proves MLBc + BGP routing works):
> ```bash
> dig +short @${SVC_CIDR%%/*}::1:a kubernetes.default.svc.cluster.local AAAA           # CoreDNS answers
> dig +short @${SVC_CIDR%%/*}::1:a boot.onmetal.de AAAA                                # CoreDNS rewrites to boot-operator external LB
> curl -6 -sS -o /dev/null -w '%{http_code}\n' http://[${SVC_CIDR%%/*}::1:efac]:8083/  # boot-operator responds
> curl -6 -sS -o /dev/null -w '%{http_code}\n' http://[${SVC_CIDR%%/*}::1:cafe]:30010/ # metal-registry responds
> curl -6 -sS -o /dev/null -w '%{http_code}\n' http://metaldata.example.com/      # metaldata reachable via CoreDNS rewrite
> nc -6 -uz ${SVC_CIDR%%/*}::1:1547 547                                                # FeDHCP OOB port open
> nc -6 -uz ${SVC_CIDR%%/*}::1:547 547                                                 # FeDHCP inband port open
> ```

---

## Phase 3: Create CAPI Cluster

Use the bootstrap cluster to provision the *real* management cluster on mgmt-2 via CAPI. Once mgmt-2 is discovered as a `Server` resource (see [3.1](#_3-1-prepare-the-server-resource)), it boots the GardenLinux CAPI image (provided by boot-operator via HTTPBoot from [2.3](#_2-3-metal-control-plane)), the kubeadm bootstrap provider drops an Ignition userdata onto it, and `kubeadm init` brings up a single-node CAPI-managed control plane. Its API becomes reachable at the zone's external API address (`SVC_CIDR::1:1`) once the node announces it via BGP (see [3.3](#_3-3-ignition-userdata)), and we fetch its kubeconfig for the next phases.

For the CAPI resource model refer to the upstream docs:

- [Cluster API concepts](https://cluster-api.sigs.k8s.io/user/concepts.html)
- [KubeadmControlPlane](https://cluster-api.sigs.k8s.io/tasks/control-plane/kubeadm-control-plane) and [kubeadm bootstrap provider](https://cluster-api.sigs.k8s.io/tasks/bootstrap/kubeadm-bootstrap)
- [cluster-api-provider-ironcore-metal](https://github.com/ironcore-dev/cluster-api-provider-ironcore-metal)

### 3.1 Prepare the Server resource

Wait for mgmt-2's `Server` resource to reach `state: Available` on the bootstrap cluster (metal-operator discovers it via the OOB flow set up in Phase 2). This can take several minutes depending on the BMC's DHCP lease cycle - discovery only starts when the BMC sends a DHCPv6 request to the OOB FeDHCP, which triggers the `metal` plugin to create an `Endpoint` CR. metal-operator watches for `Endpoint` creation and begins the BMC discovery flow from there (see [metal-operator architecture](https://ironcore.dev/metal-operator/architecture.html)). If the BMC already holds a valid lease from before FeDHCP was deployed, it won't re-request until that lease expires. A BMC reboot or manual DHCP release speeds this up.

> **If mgmt-2 does not reach `Available` within a few minutes**, work the discovery chain back to front:
> ```bash
> kubectl get server.metal.ironcore.dev -w                     # .status.state and .status.powerState
> kubectl get endpoint.metal.ironcore.dev                      # did FeDHCP see the BMC's DHCPv6 request? (none = DHCP/relay/lease issue)
> kubectl get serverbootconfiguration.metal.ironcore.dev       # .status.state - Error means the boot config could not be served
> kubectl -n fedhcp logs deploy/fedhcp-oob | tail              # OOB DHCPv6 traffic from the BMC
> kubectl -n metal-operator-system logs deploy/metal-operator-controller-manager | tail   # discovery/probe errors (BMC creds, Redfish)
> kubectl -n boot-operator-system logs deploy/boot-operator-controller-manager | tail     # boot-config / image-fetch errors
> ```
> Common causes, in order:
> - **No `Endpoint`**: the BMC never sent a DHCPv6 request - stale lease (reboot the BMC or release its lease), or a relay/FeDHCP misconfiguration.
> - **`Server` stuck in `Initial`/discovery**: BMC credentials (`oob-mac-prefixes`) or Redfish reachability.
> - **`ServerBootConfiguration` in `Error`**: the server was discovered but its boot configuration could not be served - typically shaky or broken inband network (image/Ignition fetch from the boot-operator LB fails). While the `ServerBootConfiguration` stays in `Error` the server never boots the probe/OS image, so its `powerState` never changes. Fix the network path to the boot-operator LB (`SVC_CIDR::1:efac`) and the config reconciles.

Then annotate and label it:

- **`metadata.metal.ironcore.dev/prefix`.** The per-host `/64` prefix consumed by the metal CAPI provider when it renders the machine's cloud-init/Ignition userdata. For mgmt-2: `prefix: 2001:db8:1111:2::/64` (see [Prerequisites](#prerequisites-before-running-any-phase)). The node's `/128` loopback is derived from this prefix by the CCM (its `::1` address, see [4.2.1](#_4-2-1-cloud-controller-manager)). The prefix feeds the same metaldata service the host queries on first boot (see [metaldata](#_2-4-2-metaldata)); the FRR template on the node substitutes it into its BGP config.
- **`type=mgmt` and `clusterapi-controlplane=` labels**: The `IroncoreMetalMachineTemplate` uses `serverSelector.matchLabels: {clusterapi-controlplane: ""}` to pick eligible Servers. Set both explicitly - `type=mgmt` is informational, `clusterapi-controlplane=` is what selects the machine.

### 3.2 CAPI resources

Four resources define the cluster. Apply as a single kustomization:

1. **`Cluster`** - top-level CAPI object.
   - `spec.controlPlaneEndpoint.host: SVC_CIDR::1:1`. This is the *external* API address announced by the control-plane node via BGP once its API is healthy (see [api-health-check](#_3-3-ignition-userdata) below). Do **not** use a per-node loopback here: on scale-up in Phase 6 the endpoint must remain stable across control-plane replacements.
   - `spec.clusterNetwork.services.cidrBlocks: [SVC_CIDR]`. **Must match the bootstrap cluster's service CIDR** ([1.2](#_1-2-kubeadm-init)) so the switch DHCP relays and BGP announcements set up in Phase 2 keep working unchanged.
2. **`IroncoreMetalCluster`** - infrastructure counterpart, essentially empty. The metal provider fills in status once the endpoint is reachable.
3. **`IroncoreMetalMachineTemplate`** - the machine spec used by the control plane.
   - `image: ghcr.io/ironcore-dev/gardenlinux/capi:<tag>`. The **CAPI variant** of the GardenLinux image (bundles kubeadm/kubelet), distinct from the plain metal image used by the metal-operator probe phase in [2.3](#_2-3-metal-control-plane).
   - `serverSelector.matchLabels: {clusterapi-controlplane: ""}` - picks up the label set in [3.1](#_3-1-prepare-the-server-resource).
4. **`KubeadmControlPlane`** - CAPI kubeadm control-plane provider config.
   - `machineTemplate.spec.infrastructureRef` points at the `IroncoreMetalMachineTemplate` above. `deletion.nodeDeletionTimeoutSeconds: 0` and `nodeDrainTimeoutSeconds: 0` - bare metal nodes are wiped on removal, so drain/deletion timeouts are meaningless; set to zero to avoid hanging on unresponsive nodes during scale-down or replacement.
   - `replicas: 1` initially. Scaled to 3 in Phase 6 once the pivot is complete and the remaining Servers are discovered.
   - `version: <k8s_version>` - **same minor as the bootstrap cluster** ([1.1](#_1-1-host-preparation)); mismatches force an immediate upgrade cycle after pivot.
   - `format: ignition` - required because the OS image consumes Ignition. Matches the `EXP_KUBEADM_BOOTSTRAP_FORMAT_IGNITION` feature gate enabled during `clusterctl init` in [2.2](#_2-2-cluster-api).
   - `clusterConfiguration.apiServer.certSANs`. Include `SVC_CIDR::1:1` (the external endpoint), each control-plane node's future `/128` loopback, and the DNS names for mgmt-1/2/3. Missing SANs surface as opaque TLS errors on `clusterctl move` and node join.
   - `initConfiguration`/`joinConfiguration` kubelet args: `cloud-provider=external`, `cluster-dns=SVC_CIDR::a`, `node-ip=::`. Same rationale as the bootstrap cluster ([1.2](#_1-2-kubeadm-init)).
   - Extra apiserver/scheduler/controller-manager args bind to `::1` (IPv6-only) and set `allocate-node-cidrs=false` (pod CIDRs come from the CCM — the cloud-controller-manager, which assigns node addresses and pod CIDRs — deployed in [Phase 4](#phase-4-deploy-metal-stack-on-capi-cluster)).

### 3.3 Ignition userdata

The control-plane Ignition config is attached to the `KubeadmControlPlane`'s `containerLinuxConfig.additionalConfig` as a file. Highlights of what it does:

- **Users / SSH keys**: Operator SSH keys for access to the provisioned nodes.
- **systemd-networkd**: Two `.network` files matched by NIC name for the inband (100 Gbps, MTU 9100, DHCPv6) and OOB (10 Gbps, MTU 1500) interfaces. NIC names are hardware-specific - **adjust the `Name=` globs to match your servers**.
- **FRR template + configure-frr.sh**: `/etc/frr/frr-template.conf` ships with `__PLACEHOLDERS__` for hostname, loopback, prefix, AS number, router-id, service range, and fabric/OOB NIC names. On first boot, `fetch-metadata.sh` pulls the metaldata v1 API (`/v1`, `Metadata-Flavor: IronCore Metal` header) into `/opt/metadata.json`, then `configure-frr.sh` parses the `server-name` (`<type>-<zone>-<index>`) from it, looks up the `type` offset, and derives the AS number and router-id from `(type_offset * 1000 + index)`; it auto-detects NICs by link speed (100000 = fabric, 10000 = OOB) and `sed`s the template into `/etc/frr/frr.conf`. See [metaldata](#_2-4-2-metaldata) for what the metadata service returns.
- **api-health-check.timer**: Runs every 10 s. Polls `https://[::1]:6443/readyz`. When healthy:
  - Adds `SVC_CIDR::1:1/128` to `lo` and announces it via BGP - **this is what makes the CAPI cluster's control-plane endpoint reachable in the fabric**. Until this fires, `controlPlaneEndpoint.host` from [3.2](#_3-2-capi-resources) resolves to nothing.
  - After kubeadm finishes, a marker file `/opt/magic-file-gonzo` (touched by `postKubeadmCommands`) flips the script into "announce the whole `SVC_CIDR::/64` service range" mode. Post-pivot, this is what makes every LoadBalancer service in the CAPI cluster reachable, replacing the announcement previously done by the bootstrap host's FRR (see [Phase 4](#phase-4-deploy-metal-stack-on-capi-cluster)).
- **`preKubeadmCommands`**: Wait for DNS, wait for the control-plane endpoint (join case only), then install kubelet/kubeadm/kubectl matching `k8s_version` from `pkgs.k8s.io`, and use `yq` to patch `advertiseAddress` in `/etc/kubeadm.yml` with the loopback IP from `/opt/ip` (written by `configure-frr.sh`). The stock kubeadm bootstrap provider does not know the loopback address; this is the workaround.
- **containerd config**: Overrides `bin_dir`/`conf_dir` to the CRI v1 defaults. Analogous to the bootstrap cluster's containerd config in [1.1](#_1-1-host-preparation) but adjusted for what the GardenLinux CAPI image ships with.
- **GardenLinux `dracut.end` hook**: First-boot disk partitioning via `systemd-repart` + `bootctl install`, then reboot. The node boots into a live ramdisk via HTTPBoot, this hook installs to the first PCI disk, and subsequent boots come off local disk. **Beware BMC virtual media** - it can appear as the first PCI disk and get wiped; unmount before provisioning.

### 3.4 Fetch the CAPI kubeconfig

Once the `KubeadmControlPlane` reports `initialized: true` and the API is reachable at `[SVC_CIDR::1:1]:6443`, fetch the kubeconfig for the CAPI cluster with `clusterctl get kubeconfig mgmt-<zone> -n capi-provider-ironcore-metal-system` (run on the bootstrap cluster) and save it to `/etc/kubernetes/capi.kubeconfig`. Phase 4 reuses this kubeconfig to deploy the metal stack a second time, this time on the CAPI cluster.

> **Checkpoint.** mgmt-2 is a healthy single-node CAPI control-plane member. It runs FRR announcing its `/64` prefix and the external API endpoint, kubeadm has completed, and the `<cluster>-kubeconfig` secret contains a working kubeconfig pointing at `[SVC_CIDR::1:1]:6443`.
>
> Verify from the bootstrap cluster:
> ```bash
> export KUBECONFIG=/etc/kubernetes/admin.conf
> kubectl get cluster mgmt-${ZONE}                                              # PHASE=Provisioned
> kubectl get kubeadmcontrolplane mgmt-${ZONE}-controlplane                     # INITIALIZED=true, READY=true, REPLICAS=1
> kubectl get ironcoremetalmachines -A                                         # one machine, READY=true
> kubectl -n capi-provider-ironcore-metal-system get secret mgmt-${ZONE}-kubeconfig -o jsonpath='{.data.value}' | base64 -d > /etc/kubernetes/capi.kubeconfig
> KUBECONFIG=/etc/kubernetes/capi.kubeconfig kubectl get --raw='/readyz'        # expect: ok
> KUBECONFIG=/etc/kubernetes/capi.kubeconfig kubectl get nodes                  # mgmt-2 NotReady (no CNI on CAPI cluster yet - Phase 4)
> ```

---

## Phase 4: Deploy Metal Stack on CAPI Cluster

Deploy the same metal stack from [Phase 2](#phase-2-deploy-metal-stack-bootstrap-cluster) onto the CAPI cluster, but configured for its future role as the self-managing production cluster. The CAPI cluster is still a single node (mgmt-2) at this point; the metal/discovery controllers (boot-operator, metal-operator, FeDHCP) are scaled to zero so they do not start competing with the bootstrap cluster's controllers before pivot.

### 4.1 Preparation

Before deploying onto the CAPI cluster:

1. **Hand over the service-CIDR announcement from mgmt-1 to mgmt-2**: mgmt-2 has already started announcing the aggregate `SVC_CIDR::/64` - its `api-health-check` timer flips into "announce the whole service range" mode at the end of Phase 3, when `postKubeadmCommands` touches the `/opt/magic-file-gonzo` marker (see [3.3](#_3-3-ignition-userdata)). So by the start of Phase 4 both hosts are announcing, and the overlap must be closed here. Withdrawing mgmt-1 is safe **only after confirming mgmt-2 is announcing** - otherwise no host advertises the range and every LB VIP goes dark. Sequence: (a) verify mgmt-2 announces `SVC_CIDR::/64` (check its FRR / BGP sessions); (b) comment out the `network SVC_CIDR::/64` line in `/etc/frr/frr.conf` on mgmt-1 and restart FRR; (c) confirm from the fabric that `SVC_CIDR::/64` still routes via mgmt-2 and CoreDNS at `SVC_CIDR::1:a` still answers (kubeadm already deployed it on mgmt-2). mgmt-2 sole-announcing while FeDHCP/boot-operator/metal-operator are still at zero replicas is fine - no provisioning happens until Phase 6, and the CAPI API (`SVC_CIDR::1:1`, a `/128` announced solely by mgmt-2) is unaffected by the aggregate handover.
2. **Use the CAPI kubeconfig**: Reuse the `/etc/kubernetes/capi.kubeconfig` fetched in [3.4](#_3-4-fetch-the-capi-kubeconfig); it targets the CAPI cluster's API at `[SVC_CIDR::1:1]:6443`.
3. **Wait for the CAPI API to respond**: Verify `KUBECONFIG=/etc/kubernetes/capi.kubeconfig kubectl get nodes` succeeds before proceeding.

### 4.2 Deployment differences from Phase 2

The same components are deployed (Calico, cert-manager, CAPI core, IronCore metal provider, boot-operator, metal-operator with the bundled metaldata, MLBc, FeDHCP, CoreDNS) using the same bootstrap role, but with the following flags that alter behavior:

| Flag | Effect |
|------|--------|
| `bootstrap_install_ccm: true` | Deploys the cloud-controller-manager. On the CAPI cluster, nodes have a `providerID` set by the metal CAPI provider, so the CCM can match nodes to `IroncoreMetalMachine` objects and assign pod CIDRs. (On the bootstrap cluster in Phase 2 this was `false` - there is no CAPI machine object for mgmt-1, and pod CIDRs are patched manually.) |
| `bootstrap_scale_metal_deployments_to_zero` | Scales boot-operator, metal-operator, and FeDHCP deployments to 0 replicas after applying their CRDs and RBAC, and **deletes metal-operator's `ValidatingWebhookConfiguration`**. The controllers must **not** run on the CAPI cluster until after pivot ([Phase 5](#phase-5-pivot-clusterctl-move)) - otherwise two sets of controllers would reconcile the same resources simultaneously. The webhook is removed because, with the controller scaled to zero, no pod serves the webhook endpoint: any admission request would hang until timeout and fail, breaking every `kubectl apply` that touches a metal CRD on the CAPI cluster. It is restored in [Phase 5](#phase-5-pivot-clusterctl-move) once the controller runs again. |

Control-plane nodes of the CAPI cluster carry no `node-role.kubernetes.io/control-plane` taint: workers are scheduled onto the control plane by default, and workload-specific taints are applied per worker node pool (e.g. `node-role.ironcore.dev/compute` / `node-role.ironcore.dev/storage`) in the landscape repos. Because the metal stack has no taints to tolerate here, the bootstrap kustomizations carry no `control-plane` toleration and do not pin deployments to the control plane via `nodeSelector`; the components land on mgmt-2 (and later mgmt-1/3) via normal scheduling.

Additionally, the play overrides the `KUBECONFIG` variable to `capi.kubeconfig` (instead of the host's default `admin.conf`), so all `kubectl apply` commands target the CAPI cluster.

### 4.2.1 Cloud Controller Manager

`bootstrap_install_ccm: true` brings in the cloud-controller-manager (metal-cloud-controller-manager, v0.6.0), which was not deployed on the bootstrap cluster. It assigns node addresses and pod CIDRs on the CAPI cluster by matching nodes to `IroncoreMetalMachine` objects (nodes here carry a `providerID` set by the metal CAPI provider, which the bootstrap node lacked). Node addresses are computed from the `metadata.metal.ironcore.dev/prefix` annotation on the `Server` resource ([3.1](#_3-1-prepare-the-server-resource)) - the node's loopback / `INTERNAL-IP` is the `::1` of that `/64`. Applied via kustomize on top of `github.com/ironcore-dev/cloud-provider-metal` with these patches:

- `metal-kubeconfig` Secret containing the kubeconfig of the metal API cluster, mounted at `/etc/metal/metal-kubeconfig`. In Phase 4 this is created from the bootstrap cluster's `/etc/kubernetes/admin.conf`, so it points at the **bootstrap cluster** as the metal API (the `IroncoreMetalMachine` CRs the CCM matches against still live there until [Phase 5](#phase-5-pivot-clusterctl-move) moves them over). It is switched to the CAPI cluster's `capi.kubeconfig` in [Phase 6](#phase-6-scale-to-3-control-plane-nodes), after the pivot.
- `cloud-provider-config` ConfigMap with `cloudprovider.conf`: `clusterName: mgmt-<zone>` (matching the CAPI `Cluster` name from [3.2](#_3-2-capi-resources)) and `networking.configureNodeAddresses: true`.
- Extra args: `--metal-kubeconfig=/etc/metal/metal-kubeconfig` (path to the metal API cluster kubeconfig), `--metal-namespace=capi-provider-ironcore-metal-system` (namespace where the metal CRDs live), `--cloud-config=/etc/kubernetes/cloudprovider/cloudprovider.conf`, `--configure-cloud-routes=false`.
- Zone-specific args: `--cluster-cidr=SVC_CIDR` (the cluster's service range, used by the CCM to distinguish cluster-internal addresses) and `--pod-prefix-size=112` (the size of the `podCIDR` the CCM assigns per node - a `/112` carved out of each node's `/64` host BGP range and offset to `::1:0` to avoid the node's `::1` loopback, e.g. `2001:db8:1111:2::1:0/112` for mgmt-2 from [1.3](#_1-3-post-install); the host BGP prefix itself stays a `/64`).

### 4.3 What this achieves

After Phase 4, the CAPI cluster has:
- All IronCore CRDs registered (metal-operator, boot-operator, CAPI provider, FeDHCP).
- RBAC, service accounts, and webhook configurations in place.
- Calico running (node moves to `Ready`).
- CCM running and assigning pod CIDRs.
- cert-manager running (webhooks can serve).
- Controllers for boot-operator, metal-operator, and FeDHCP at **zero replicas** - they will be scaled up after pivot. metal-operator's `ValidatingWebhookConfiguration` is **deleted** for the same reason (no controller pod to serve it); restored after pivot.
- CoreDNS with the same Corefile rewrites as the bootstrap cluster.

The cluster is ready to receive the CAPI resources via `clusterctl move` in Phase 5.

> **Checkpoint.** The CAPI cluster has the full metal stack installed (CRDs, RBAC, network services) but metal-operator/boot-operator/FeDHCP controllers are scaled to zero. The node is `Ready`, CCM is running, and the service range is announced by mgmt-2 (not mgmt-1).
>
> Verify from mgmt-1:
> ```bash
> export KUBECONFIG=/etc/kubernetes/capi.kubeconfig
> kubectl get nodes                                                    # mgmt-2 Ready
> kubectl get node mgmt-${ZONE}-2 -o wide                                # STATUS=Ready, INTERNAL-IP=2001:db8:1111:2::1
> kubectl get node mgmt-${ZONE}-2 -o jsonpath='{.spec.podCIDRs}' ; echo # expect: ["2001:db8:1111:2::1:0/112"] (CCM-assigned, not patched)
> kubectl get pods -A | grep -E 'metal-operator|boot-operator|fedhcp'  # no Running pods (scaled to zero)
> kubectl get pods -A | grep -E 'calico|cert-manager|coredns'          # all Running
> for ns in metal-operator-system boot-operator-system fedhcp-system; do
>   kubectl get deploy -n "$ns" -o jsonpath='{range .items[*]}{.metadata.name}={.spec.replicas}{"\n"}{end}'
> done                                                                 # each deployment shows replicas=0
> ```

---

## Phase 5: Pivot (clusterctl move)

Move all CAPI and IronCore metal resources from the bootstrap cluster to the CAPI cluster so it becomes fully self-managing. After this phase, the bootstrap cluster on mgmt-1 is no longer needed - it gets torn down and the server is reprovisioned by CAPI as a regular control-plane node in Phase 6.

`clusterctl move` transfers CAPI objects (Cluster, Machine, KubeadmControlPlane, etc.) and any resources whose CRDs are labelled for move. However it does **not** move status subresources - both `Server` status (hardware inventory, power state) and `ServerClaim` status (the `Bound` phase linking a claim to its server) arrive empty on the target. Both must be restored manually after the move, before scaling up controllers (see [5.3](#_5-3-restore-status)).

### 5.1 Prepare the bootstrap cluster

1. **Scale down metal-operator, boot-operator, and FeDHCP on the bootstrap cluster**: Each is stopped for a distinct reason:
   - **metal-operator and boot-operator** reconcile IronCore CRs and must be stopped before the move - if they're running while `clusterctl move` deletes the source objects, they may react to the deletion (e.g. power off a server, release a claim).
   - **FeDHCP** (both planes) is scaled down because the CAPI cluster brings up its own FeDHCP in [5.4](#_5-4-scale-up-controllers-on-capi-cluster). With both clusters serving DHCPv6 on the same relayed OOB and inband networks, two live servers would hand out conflicting/duplicate leases.

   Scale all four to zero:
   - `metal-operator-system/metal-operator-controller-manager`
   - `boot-operator-system/boot-operator-controller-manager`
   - `fedhcp/fedhcp-oob`
   - `fedhcp/fedhcp` (inband)

2. **Label IronCore CRDs for move**: `clusterctl move` only transfers resources whose CRDs carry the `clusterctl.cluster.x-k8s.io/move` label (see [clusterctl move contract](https://cluster-api.sigs.k8s.io/developer/providers/contracts/clusterctl#move)). The upstream CAPI CRDs already have it; the IronCore-specific ones (groups `metal.ironcore.dev`, `boot.ironcore.dev`, and `infrastructure.cluster.x-k8s.io/ironcoremetal*`) do not by default. Label them:
   ```bash
   kubectl --kubeconfig /etc/kubernetes/admin.conf label crd <crd-name> clusterctl.cluster.x-k8s.io/move= clusterctl.cluster.x-k8s.io= --overwrite
   ```

3. **Capture the Server and ServerClaim objects (full JSON)**: From the bootstrap cluster, save the mgmt-2 `Server` resource and the `ServerClaim` that binds it to the CAPI machine - both including their `.status`. They are the only Server and ServerClaim on the bootstrap cluster (see [2.3](#_2-3-metal-control-plane)). These JSONs are used in [5.3](#_5-3-restore-status) to patch back status after the move, since `clusterctl move` drops status subresources.
   ```bash
   kubectl --kubeconfig /etc/kubernetes/admin.conf get server.metal.ironcore.dev -o json | jq '.items[0]' > server-mgmt-2.json
   kubectl --kubeconfig /etc/kubernetes/admin.conf -n capi-provider-ironcore-metal-system get serverclaim.metal.ironcore.dev -o json | jq '.items[0]' > serverclaim-mgmt-2.json
   ```

### 5.2 Run clusterctl move

Run on the bootstrap cluster (source = `/etc/kubernetes/admin.conf`, target = the CAPI cluster via `--to-kubeconfig`):

```bash
clusterctl move --kubeconfig /etc/kubernetes/admin.conf -n capi-provider-ironcore-metal-system --to-kubeconfig /etc/kubernetes/capi.kubeconfig
```

This transfers all CAPI resources (Cluster, KubeadmControlPlane, IroncoreMetalCluster, IroncoreMetalMachine, IroncoreMetalMachineTemplate) and all labelled IronCore resources (Server, ServerClaim, BMC, BMCSecret, ServerBootConfiguration, etc.) from the bootstrap cluster to the CAPI cluster. `clusterctl` creates the objects on the target first, waits until they're observed, and only then removes them from the source - so the objects briefly exist on both clusters during the move.

The namespace on the target is the same as the source: `capi-provider-ironcore-metal-system`.

**Idempotency note.** If the move has already been performed (the `Cluster` object already exists on the CAPI cluster), skip steps 5.2 and 5.3. The pivot role checks for this before proceeding.

### 5.3 Restore status

After the move, two status subresources need manual patching on the CAPI cluster:

1. **Restore Server status**: Patch the mgmt-2 `Server` resource's `.status` subresource from the JSON captured in [5.1](#_5-1-prepare-the-bootstrap-cluster). The name and status are both taken from the captured JSON:
   ```bash
   NAME=$(jq -r '.metadata.name' server-mgmt-2.json)
   STATUS=$(jq -c '{status: .status}' server-mgmt-2.json)
   kubectl --kubeconfig /etc/kubernetes/capi.kubeconfig patch server.metal.ironcore.dev/${NAME} --subresource=status --type=merge -p "${STATUS}"
   ```
   Without this, metal-operator would re-run the full discovery/probe cycle on mgmt-2 - which takes minutes and would temporarily mark the server as unavailable, potentially confusing the running KubeadmControlPlane controller.

2. **Restore ServerClaim status**: Patch the `ServerClaim`'s `.status` subresource from the JSON captured in [5.1](#_5-1-prepare-the-bootstrap-cluster). The `ServerClaim` that binds mgmt-2 to the CAPI machine arrives with empty status. The name and status are both taken from the captured JSON:
   ```bash
   CLAIM=$(jq -r '.metadata.name' serverclaim-mgmt-2.json)
   STATUS=$(jq -c '{status: .status}' serverclaim-mgmt-2.json)
   kubectl --kubeconfig /etc/kubernetes/capi.kubeconfig -n capi-provider-ironcore-metal-system patch serverclaim.metal.ironcore.dev/${CLAIM} --subresource=status --type=merge -p "${STATUS}"
   ```
   Without this restore, the metal CAPI provider sees an unbound claim and may attempt to re-provision the machine.

### 5.4 Scale up controllers on CAPI cluster

Scale the previously-zeroed deployments back to 1 replica on the CAPI cluster:
- `metal-operator-system/metal-operator-controller-manager`
- `boot-operator-system/boot-operator-controller-manager`
- `fedhcp/fedhcp-oob`
- `fedhcp/fedhcp` (inband)

Wait for all four deployments to reach `Available` before proceeding.

### 5.5 Restore metal-operator ValidatingWebhookConfiguration

The `ValidatingWebhookConfiguration` for metal-operator was deleted in [Phase 4](#phase-4-deploy-metal-stack-on-capi-cluster) (to avoid hanging admissions while the controller was at zero replicas). Now that the controller is running again, restore it by copying the configuration from the bootstrap cluster:

```bash
kubectl --kubeconfig /etc/kubernetes/admin.conf get validatingwebhookconfiguration metal-operator-validating-webhook-configuration -o yaml \
  | kubectl --kubeconfig /etc/kubernetes/capi.kubeconfig apply -f -
```

The bootstrap cluster still has the original webhook configuration intact (it was only deleted on the CAPI cluster side).

> **Checkpoint.** The CAPI cluster is now self-managing: it owns its own `Cluster`, `KubeadmControlPlane`, `Server`, and `ServerClaim` objects. metal-operator, boot-operator, and FeDHCP are running. The bootstrap cluster on mgmt-1 is idle - it can be torn down or left as-is until Phase 6.
>
> Verify on the CAPI cluster:
> ```bash
> export KUBECONFIG=/etc/kubernetes/capi.kubeconfig
> kubectl -n capi-provider-ironcore-metal-system get cluster mgmt-${ZONE}        # exists, PHASE=Provisioned
> kubectl -n capi-provider-ironcore-metal-system get machines                    # one machine, Running
> kubectl get servers.metal.ironcore.dev                                         # mgmt-2 Server present with status
> kubectl get serverclaims.metal.ironcore.dev -A                                 # one claim, phase=Bound
> kubectl get pods -n metal-operator-system                                      # Running
> kubectl get pods -n boot-operator-system                                       # Running
> kubectl get pods -n fedhcp                                                     # both Running
> kubectl get validatingwebhookconfiguration metal-operator-validating-webhook-configuration  # exists
> ```

---

## Phase 6: Scale to 3 Control-Plane Nodes

Up to this point the CAPI cluster runs a single control-plane node (mgmt-2). This phase brings mgmt-1 and mgmt-3 into the cluster in four steps: repoint the cloud-controller-manager at the CAPI cluster, extend the metal stack's discovery configuration to cover all three servers, wait for the new `Server` resources to reach `Available` (and annotate/label them), and scale the `KubeadmControlPlane` to 3 replicas.

> **Naming.** `mgmt-<zone>-N` in this guide, `mgmt-N` in commands, and the metal stack's `Server` CR name `mgmt-<zone>-N-system-0` are all the same physical host — `system-0` is instance 0 of chassis type `system`.

mgmt-1 is still running the old bootstrap cluster - metal-operator powers it off automatically during discovery (via `--enforce-first-boot`, see [6.3](#_6-3-wait-for-server-discovery)) so CAPI can reprovision it cleanly with the same Ignition config as mgmt-2 and mgmt-3.

### 6.1 Repoint CCM at the CAPI cluster

During bootstrap the cloud-controller-manager's `metal-kubeconfig` secret was populated from the *bootstrap* cluster's `admin.conf` (the bootstrap role hardcodes that source, see [4.2.1](#_4-2-1-cloud-controller-manager)) - even when Phase 4 ran the role against the CAPI cluster. After pivot the bootstrap cluster is torn down, so that kubeconfig no longer points at a running API. Repoint the CCM at the CAPI cluster now, before new nodes appear, so it can reconcile them (match nodes to `IroncoreMetalMachine` objects via `providerID` and assign pod CIDRs). Re-create the secret from the CAPI kubeconfig and restart the CCM deployment:

```bash
export KUBECONFIG=/etc/kubernetes/capi.kubeconfig
kubectl create secret generic metal-kubeconfig -n kube-system \
  --from-file=metal-kubeconfig=/etc/kubernetes/capi.kubeconfig \
  --dry-run=client -o yaml | kubectl apply -f -
kubectl -n kube-system rollout restart deployment cloud-controller-manager
```

### 6.2 Update discovery configuration

Until now, only mgmt-2 was known to the metal stack. Extend the two discovery components so they cover all management servers:

1. **FeDHCP OOB `metal-config-oob` ConfigMap**: Until now, FeDHCP only knew mgmt-2's MAC address. Update the ConfigMap with all three servers so FeDHCP can respond to DHCP requests from mgmt-1 and mgmt-3:
   ```yaml
   # metal-config-<zone>.yaml
   hosts:
     - name: mgmt-<zone>-1
       macAddress: <mgmt-1-oob-mac>
     - name: mgmt-<zone>-2
       macAddress: <mgmt-2-oob-mac>
     - name: mgmt-<zone>-3
       macAddress: <mgmt-3-oob-mac>
   ```
   Add mgmt-1 and mgmt-3 to `metal-config-<zone>.yaml` (mgmt-2 is already there from [Phase 2](#_2-3-metal-control-plane)), then apply it:
   ```bash
   kubectl create configmap metal-config-oob -n fedhcp \
     --from-file=metal-config.yaml=metal-config-<zone>.yaml \
     --dry-run=client -o yaml | kubectl apply -f -
   kubectl -n fedhcp rollout restart deployment fedhcp-oob
   ```

2. **metal-operator `macdb` secret**: The MAC prefix database tells metal-operator which OOB MAC prefixes belong to management servers (and the BMC credentials to use). Ship it vault-encrypted; the structure is:
   ```yaml
   # oob-mac-prefixes-<zone>.yaml
   macPrefixes:
     - macPrefix: <bmc-mac-prefix>        # e.g. the first 6 hex digits of the BMC MAC
       protocol:
         name: Redfish
         port: 443
       defaultCredentials:
         - username: <bmc-username>
           password: <bmc-password>
   ```
   Update it with the full set and restart:
   ```bash
   kubectl create secret generic macdb -n metal-operator-system \
     --from-file=macdb.yaml=oob-mac-prefixes-<zone>.yaml \
     --dry-run=client -o yaml | kubectl apply -f -
   kubectl -n metal-operator-system rollout restart deployment metal-operator-controller-manager
   ```

### 6.3 Wait for Server discovery

After updating the discovery configuration ([6.2](#_6-2-update-discovery-configuration)), metal-operator discovers mgmt-1 and mgmt-3 via their BMC DHCP leases (same mechanism as [Phase 3](#phase-3-create-capi-cluster)). Wait until both `Server` objects exist:

```bash
kubectl get server.metal.ironcore.dev/mgmt-<zone>-1-system-0
kubectl get server.metal.ironcore.dev/mgmt-<zone>-3-system-0
```

This can take a while - same BMC DHCP lease dependency as in [3.1](#_3-1-prepare-the-server-resource).

**metal-operator must run with [`--enforce-first-boot=true`](https://github.com/ironcore-dev/metal-operator/blob/main/cmd/main.go#L158)** for the redeploy in this phase. mgmt-1 is still powered on (running the bootstrap cluster), and by default metal-operator does not power off a server that is already on during discovery, so its `Server` would stay in `Initial` and never enter the probe cycle. With `--enforce-first-boot`, the controller itself powers mgmt-1 off and drives it through discovery -> probe -> `Available`, exactly like mgmt-3. Once both servers are discovered, wait for `state: Available` on both (same as [3.1](#_3-1-prepare-the-server-resource)):

```bash
kubectl wait --for=jsonpath='{.status.state}'=Available server.metal.ironcore.dev/mgmt-<zone>-1-system-0 --timeout=40m
kubectl wait --for=jsonpath='{.status.state}'=Available server.metal.ironcore.dev/mgmt-<zone>-3-system-0 --timeout=40m
```

### 6.4 Annotate and label new Servers

Same as [Phase 3.1](#_3-1-prepare-the-server-resource) - each new Server needs its networking annotations and CAPI labels. For mgmt-1 and mgmt-3:

| Server | `prefix` | Labels |
|--------|-----------|--------|
| `mgmt-<zone>-1-system-0` | `2001:db8:1111:1::/64` | `type=mgmt`, `clusterapi-controlplane=` |
| `mgmt-<zone>-3-system-0` | `2001:db8:1111:3::/64` | `type=mgmt`, `clusterapi-controlplane=` |

The `clusterapi-controlplane=` label matches the `serverSelector` in the `IroncoreMetalMachineTemplate` (see [3.2](#_3-2-capi-resources)), which is how CAPI binds new machines to available servers.

### 6.5 Scale KubeadmControlPlane to 3 replicas

Scale the control plane from 1 to 3 replicas so CAPI claims mgmt-1 and mgmt-3 and joins them to the cluster:

```bash
kubectl -n capi-provider-ironcore-metal-system \
  patch kubeadmcontrolplane mgmt-<zone>-controlplane --type=merge \
  -p '{"spec":{"replicas":3,"rollout":{"strategy":{"type":"RollingUpdate","rollingUpdate":{"maxSurge":0}}}}}'
```

`maxSurge: 0` ensures CAPI does not try to provision a fourth machine during rolling updates - important because the cluster has exactly 3 management servers, so a surge would have no server to bind to and would stall.

Both mgmt-1 and mgmt-3 are `Available` already ([6.3](#_6-3-wait-for-server-discovery)), so both new machines get claimed immediately and provision in parallel. mgmt-1's provisioning starts with a reprovision of the physical server: metal-operator already powered it off during discovery, so the bootstrap cluster on it is gone and CAPI owns mgmt-1 from here on.

> **Checkpoint.** Both new machines are provisioning - they go through the same HTTPBoot + Ignition path as mgmt-2 did in [Phase 3](#phase-3-create-capi-cluster), so provisioning them takes a comparable amount of time (OS install + kubeadm join).
>
> Verify:
> ```bash
> export KUBECONFIG=/etc/kubernetes/capi.kubeconfig
> kubectl get machines -n capi-provider-ironcore-metal-system       # 3 machines; mgmt-1/3 Provisioning until their nodes join
> kubectl get nodes -o wide                                         # mgmt-2 Ready; mgmt-1/3 appear once kubelet registers
> ```
>
> Once a node's kubelet has registered, verify its address and CCM-assigned pod CIDR:
> ```bash
> kubectl get node mgmt-${ZONE}-1 -o wide                            # STATUS=Ready, INTERNAL-IP=2001:db8:1111:1::1
> kubectl get node mgmt-${ZONE}-1 -o jsonpath='{.spec.podCIDRs}' ; echo # expect: ["2001:db8:1111:1::1:0/112"] (CCM-assigned)
> kubectl get node mgmt-${ZONE}-3 -o wide                            # STATUS=Ready, INTERNAL-IP=2001:db8:1111:3::1
> kubectl get node mgmt-${ZONE}-3 -o jsonpath='{.spec.podCIDRs}' ; echo # expect: ["2001:db8:1111:3::1:0/112"] (CCM-assigned)
> ```

### 6.6 All three control-plane nodes join

With mgmt-1 and mgmt-3 claimed in [6.5](#_6-5-scale-kubeadmcontrolplane-to-3-replicas), CAPI boots both via HTTPBoot with the same GardenLinux image and Ignition config as mgmt-2 and joins them to the cluster as control-plane nodes. Note: the [6.3](#_6-3-wait-for-server-discovery) power-off of mgmt-1 permanently retires the bootstrap cluster - make sure [Phase 5](#phase-5-pivot-clusterctl-move) completed before starting this phase.

> **Checkpoint.** All three control-plane nodes are members of the CAPI cluster. etcd has achieved quorum across three members.
>
> Verify:
> ```bash
> export KUBECONFIG=/etc/kubernetes/capi.kubeconfig
> kubectl get nodes -o wide                                         # 3 nodes, all Ready, INTERNAL-IP set
> kubectl get nodes -o jsonpath='{range .items[*]}{.metadata.name}{"\t"}{.spec.podCIDRs}{"\n"}{end}'
> # mgmt-${ZONE}-1  ["2001:db8:1111:1::1:0/112"]
> # mgmt-${ZONE}-2  ["2001:db8:1111:2::1:0/112"]
> # mgmt-${ZONE}-3  ["2001:db8:1111:3::1:0/112"]
> kubectl get machines -n capi-provider-ironcore-metal-system       # 3 machines, all Running
> kubectl -n kube-system get pods -l component=etcd                 # 3 etcd pods, all Running
> ```
