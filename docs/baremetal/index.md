# Baremetal Automation

The bare metal automation in IronCore is designed to provide a comprehensive solution for managing physical servers
in a Kubernetes-native way. It leverages the power of Kubernetes Custom Resource Definitions (CRDs) to automate:

- **Discovery**: Automatically detect and register bare metal servers.
- **Provisioning**: Deploy and configure servers using Ignition.
- **Day-2 Operations**: Manage BIOS, firmware, and hardware inventory declaratively.
- **3rd Party Integrations**: Seamlessly integrate with existing tools like vendor-specific management tools.
- **Kubernetes Support**: Run Kubernetes on bare metal servers with support of Cluster API and Gardener.

## Core Components

The core components of the bare metal automation in IronCore include:
- [**Metal Operator**](https://github.com/ironcore-dev/metal-operator): The central component that manages the lifecycle of bare metal servers.
- [**Boot Operator**](https://github.com/ironcore-dev/boot-operator): iPXE and HTTP boot server that provides boot images and Ignition configurations.
- [**FeDHCP**](https://github.com/ironcore-dev/fedhcp): A DHCP server that provides in-band and out-of-band network configuration to bare metal servers.

## Concepts and Usage Guides

Usage guides and concepts for the `metal-operator` API types can be found in the [metal-operator documentation](https://ironcore-dev.github.io/metal-operator/concepts/).

## Prerequisites

The current implementation of the bare metal automation in IronCore requires the following prerequisites:

- In-band and out-of-band network connectivity to the bare metal servers.
- A management server in the out-of-band network that can communicate with the bare metal servers.
- A Kubernetes cluster setup on this management server.

::: info
The bootstrap of this management server and the Kubernetes cluster will be covered in a later version of this documentation.
:::
