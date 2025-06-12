import { withMermaid } from "vitepress-plugin-mermaid";

// https://vitepress.dev/reference/site-config
export default withMermaid({
  title: "IronCore Project",
  description: "Welcome to IronCore Documentation",
  base: "/docs/",
  themeConfig: {
    // https://vitepress.dev/reference/default-theme-config
    nav: [
      {text: 'Home', link: '/'},
      {text: 'Overview', link: '/overview'},
      {text: 'Infrastructure as a Service', link: '/iaas/getting-started'},
      {text: 'Bare Metal Automation', link: '/baremetal/getting-started'},
    ],

    logo: {
      src: 'https://raw.githubusercontent.com/ironcore-dev/ironcore/refs/heads/main/docs/assets/logo_borderless.svg',
      width: 24,
      height: 24
    },

    search: {
      provider: 'local'
    },

    sidebar: {
      '/overview/': [
        {
            text: 'Overview',
            items: [
            { text: 'Index', link: '/overview/' },
            { text: 'Design Principles', link: '/overview/principles' },
            ]
        }
      ],
      '/iaas/': [
        {
            text: 'Infrastructure as a Service',
            collapsed: false,
            items: [
                { text: 'Getting Started', link: '/iaas/getting-started' },
            ],
        },
        {
            text: "Architecture",
            collapsed: false,
            items: [
                { text: 'Overview', link: '/iaas/architecture/' },
                { text: 'Runtime Interface', link: '/iaas/architecture/runtime-interface' },
                { text: 'Networking', link: '/iaas/architecture/networking' },
                { text: 'Operating System Images', link: '/iaas/architecture/os-images' },
                { text: 'Scheduling and Orchestration', link: '/iaas/architecture/scheduling' },
            ],
        },
        {
          text: "Providers",
          collapsed: false,
          items: [
            { text: 'Overview', link: '/iaas/architecture/providers/' },
            { text: 'Compute', link: '/iaas/architecture/providers/compute' },
            { text: 'Storage', link: '/iaas/architecture/providers/storage' },
          ],
        },
        {
          text: "Kubernetes Integration",
          collapsed: false,
          items: [
            { text: 'Cloud Controller Manager', link: '/iaas/kubernetes/cloud-controller-manager' },
            { text: 'CSI Driver', link: '/iaas/kubernetes/csi-driver' },
            { text: 'Gardener Integration', link: '/iaas/kubernetes/gardener' },
          ],
        },
      ],
    '/baremetal/': [
      {
        text: 'Bare Metal Automation',
        collapsed: false,
        items: [
          { text: 'Getting Started', link: '/baremetal/getting-started' },
        ],
      },
      {
        text: "Architecture",
        collapsed: false,
        items: [
          { text: 'Overview', link: '/baremetal/architecture' },
          { text: 'Discovery', link: '/baremetal/architecture/discovery' },
          { text: 'Provisioning', link: '/baremetal/architecture/provisioning' },
          { text: 'Maintenance', link: '/baremetal/architecture/maintenance' },
        ],
      },
      {
        text: "Kubernetes Integration",
        collapsed: false,
        items: [
          { text: 'Cloud Controller Manager', link: '/baremetal/kubernetes/cloud-controller-manager' },
          { text: 'Metal Loadbalancer Controller', link: '/baremetal/kubernetes/metal-loadbalancer-controller' },
          { text: 'Cluster API Provider', link: '/baremetal/kubernetes/capi' },
          { text: 'Gardener Integration', link: '/baremetal/kubernetes/gardener' },
        ],
      },
    ],
  },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/ironcore-dev/' }
    ],
  }
})
