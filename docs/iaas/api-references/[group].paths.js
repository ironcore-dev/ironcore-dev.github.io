export default {
    async paths() {
        const core = await (await fetch('https://raw.githubusercontent.com/ironcore-dev/ironcore/refs/heads/main/docs/api-reference/core.md')).text()
        const networking = await (await fetch('https://raw.githubusercontent.com/ironcore-dev/ironcore/refs/heads/main/docs/api-reference/networking.md')).text()
        const storage = await (await fetch('https://raw.githubusercontent.com/ironcore-dev/ironcore/refs/heads/main/docs/api-reference/storage.md')).text()
        const compute = await (await fetch('https://raw.githubusercontent.com/ironcore-dev/ironcore/refs/heads/main/docs/api-reference/compute.md')).text()
        const ipam = await (await fetch('https://raw.githubusercontent.com/ironcore-dev/ironcore/refs/heads/main/docs/api-reference/ipam.md')).text()
        const common = await (await fetch('https://raw.githubusercontent.com/ironcore-dev/ironcore/refs/heads/main/docs/api-reference/common.md')).text()

        return [{
            params: { group: "core", id: 1 },
            content: core,
        },
        {
            params: { group: "networking", id: 2 },
            content: networking,
        },
        {
            params: { group: "storage", id: 3 },
            content: storage,
        },
        {
            params: { group: "compute", id: 4 },
            content: compute,
        },
        {
            params: { group: "ipam", id: 5 },
            content: ipam,
        },
        {
            params: { group: "common", id: 6 },
            content: common,
        }]
    }
}