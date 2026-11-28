---
title: Report from the Hackathon in Potsdam November 2026
date: 2026-11-30
author: The IronCore Team
---

# Report from the Hackathon in Potsdam November 2026

The whole team participated in a hackathon in Potsdam from November 24 to 26, 2026. Over two and a
half days of hacking, we produced tangible results. The sections below summarize the topics we
worked on.

[[toc]]

## Lights-out Guide and Deployment Simplifications

_By: Damyan, Martin, 2x Max, Johannes_

Deploying IronCore in a data center (or a zone) is non-trivial and was not documented. To address
this, we reinstalled one of our zones from scratch and took notes throughout the process. The result
is a "Lights-Out to Running Cluster" guide, which will be published on the website soon. It first
describes the necessary prerequisites and then provides step-by-step installation instructions. Each
step ends with a verification section to confirm success.

During reinstallation, we identified several shortcomings and explored potential improvements in a
PoC:

* Bootstrapping the first management node is manual and error-prone work. In a PoC, we baked an OS
  image containing all tools and zone-specific configuration. Booting that image was sufficient to
  run the automated management cluster setup on top of it. No more manual intervention. In the
  future, baking and installation should be fully automated.
* Except for the first node installation mentioned above, the rest of the management cluster setup
  is automated. However, depending on the BMCs' IP lease state, it can take hours to complete.
  Currently, forcing the BMCs to renew their leases requires manual intervention. This should be
  integrated into the Ansible automation.

## From Single Switches to Fleets: Declarative Rollouts and Readiness for the Network Fabric

_By: Andreas, Hardik, Daniel,..._

TODO

## VM-Runtime Interface

_By: Axel_

TODO

## PoC: Key Rotation for Encrypted Volumes

_By: Daniel, ..._

TODO

## MachineSet

_By: Felix, ..._

TODO

## Confidential Compute

_By: Samira, Tao, ..._

TODO
