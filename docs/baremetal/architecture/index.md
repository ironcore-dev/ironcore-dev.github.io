# Overview

The bare metal automation architecture is described in the diagram below. It consists of two main concepts: out-of-band 
server management and in-band server boot automation.

![Bare Metal Automation Architecture](/metal-automation-overview.png)

## Out-of-Band Automation

The out-of-band automation is responsible for the initial provisioning of bare metal servers. Here the main component
is the `metal-operator`, which is responsible for managing the lifecycle of bare metal server. In the out-of-band
network, BMCs (Baseboard Management Controllers) are assigned IP addresses (in our case via FeDHCP) and are then reachable
via the `metal-operator`. The `metal-operator` can then perform actions like [discovering](/baremetal/architecture/discovery)
and [provisioning](/baremetal/architecture/provisioning) servers. It is also responsible for the [maintenance](/baremetal/architecture/maintenance)
workflow of bare metal servers.

## In-Band Automation

On the in-band network, the `boot-operator` is responsible for serving server boot images and Ignition files to the
bare metal servers. It does so by offering an HTTP server endpoint that serves the boot images and Ignition files
and is presented to the bare metal servers via DHCP. 
