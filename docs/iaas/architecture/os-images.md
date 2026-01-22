# Operating System Images

IronCore uses Open Container Initiative (OCI) images as the standard format for operating system images. This allows 
for a consistent and portable way to manage and deploy operating systems across different environments. OCI images in
IronCore are used both for virtual machine creation in the [Infrastructure as a Service](/iaas/getting-started) and in the
[Bare Metal Management](/baremetal/) layers. IronCore OCI images should not be confused with container images,
as they represent a full operating system rather than just a single application or service.

The core idea behind using OCI as a means to manage operating system images is to leverage any OCI compliant image registry,
to publish and share operating system images. This can be done by using a public registry or host your own private registry.

## OCI Image Format

The IronCore OCI image format is specified in the [OCI Image Specification](https://github.com/ironcore-dev/ironcore-image/blob/main/OCI-SPEC.md).
The specification defines how the image is structured, including the layers, configuration, and metadata required to 
run an operating system. The `ironcore-image` repository provides tools and utilities to create, manage, build and publish
OCI images in IronCore. It is your go-to resource for understanding the specifics of the OCI image format used in IronCore.

## Example OCI Image

An example of an OCI image in IronCore can be found below:

```json
{
  "schemaVersion": 2,
  "mediaType": "application/vnd.ironcore.image.artifacts.v1+json",
  "config": {
    "mediaType": "application/vnd.ironcore.image.config.v1+json",
    "digest": "sha256:configdigest1234abcd5678efgh9012ijkl3456mnop7890qrst",
    "size": 100
  },
  "layers": [
    {
      "mediaType": "application/vnd.ironcore.image.disk.img",
      "digest": "sha256:diskimgdigestabcd1234efgh5678ijkl9012mnop3456qrst7890",
      "size": 1073741824
    },
    {
      "mediaType": "application/vnd.ironcore.image.kernel",
      "digest": "sha256:kernelabcd1234efgh5678ijkl9012mnop3456qrst7890uvwx1234",
      "size": 10485760
    },
    {
      "mediaType": "application/vnd.ironcore.image.initramfs",
      "digest": "sha256:initramfsabcd1234efgh5678ijkl9012mnop3456qrst7890uvwx1234",
      "size": 20971520
    },
    {
      "mediaType": "application/vnd.ironcore.image.squashfs",
      "digest": "sha256:squashfsabcd1234efgh5678ijkl9012mnop3456qrst7890uvwx1234",
      "size": 536870912
    },
    {
      "mediaType": "application/vnd.ironcore.image.cmdline",
      "digest": "sha256:cmdlineabcd1234efgh5678ijkl9012mnop3456qrst7890uvwx1234",
      "size": 1024
    },
    {
      "mediaType": "application/vnd.ironcore.image.uki",
      "digest": "sha256:ukiabcd1234efgh5678ijkl9012mnop3456qrst7890uvwx1234",
      "size": 15728640
    },
    {
      "mediaType": "application/vnd.ironcore.image.iso",
      "digest": "sha256:isoabcd1234efgh5678ijkl9012mnop3456qrst7890uvwx1234",
      "size": 734003200
    }
  ],
  "annotations": {
    "org.opencontainers.image.title": "MyOS Virtualization (amd64)",
    "variant": "virtualization",
    "architecture": "amd64"
  }
}
```

The manifest above describes the core components of an IronCore OCI image including the root disk image, kernel, initramfs, etc.
The `annotations` field provides metadata about the image, such as its title, variant, and architecture. 

## Multiple Architectures Images

IronCore supports multi-architecture images, allowing you to build and publish images for different CPU architectures.
This is done by providing an index manifest that references multiple architecture-specific manifests.

Below is an example of an index manifest for a multi-architecture image:

```json
{
  "schemaVersion": 2,
  "mediaType": "application/vnd.oci.image.index.v1+json",
  "manifests": [
    {
      "mediaType": "application/vnd.ironcore.image.artifacts.v1+json",
      "digest": "sha256:ijkl9012qrst7890uvwx1234yzab5678abcd1234efgh5678mnop3456",
      "size": 2345,
      "platform": {
        "architecture": "amd64",
        "os": "linux"
      }
    },
    {
      "mediaType": "application/vnd.ironcore.image.artifacts.v1+json",
      "digest": "sha256:mnop3456qrst7890uvwx1234yzab5678abcd1234efgh5678ijkl9012",
      "size": 6789,
      "platform": {
        "architecture": "arm64",
        "os": "linux"
      }
    }
  ]
}
```

This index manifest references two architecture-specific manifests, one for `amd64` and one for `arm64`. Each manifest 
contains a reference to the actual image layers and configuration for that specific architecture. 
