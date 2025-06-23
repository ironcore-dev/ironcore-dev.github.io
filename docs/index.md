---
# https://vitepress.dev/reference/default-theme-home-page
layout: home

hero:
  name: "IronCore Project"
  text: "Cloud Native Infrastructure as a Service and Bare Metal Automation"
  tagline: "IronCore is an open-source platform designed to empower users with robust infrastructure management and bare metal automation"
  image:
    src: https://raw.githubusercontent.com/ironcore-dev/ironcore/refs/heads/main/docs/assets/logo_borderless.svg
    alt: IronCore
  actions:
    - theme: brand
      text: Overview
      link: /overview/
    - theme: alt
      text: Infrastructure as a Service
      link: /iaas/getting-started
    - theme: alt
      text: Bare Metal Automation
      link: /baremetal/

features:
  - title: 🔍 Automatic Discovery & Provisioning
    details: Detect and provision bare metal servers automatically using Kubernetes-native CRDs.
  - title: 🧰 Declarative Day-2 Operations
    details: Manage BIOS, firmware, and hardware inventory declaratively via Kubernetes.
  - title: ☁️ Modular IaaS Building Blocks
    details: Pluggable compute, storage, and networking providers designed for hybrid and edge deployments.
  - title: 🔗 Native Kubernetes Integration
    details: Seamless integration with CSI, CCM, Cluster API, and Gardener.
  - title: 🧱 Composable, Reusable Components
    details: Reuse standalone modules like Metal Operator, Libvirt, or Ceph Providers across environments.
  - title: 👨‍💻 DevOps-Ready by Design
    details: End-to-end infrastructure and lifecycle management powered by a declarative Kubernetes API.
---
