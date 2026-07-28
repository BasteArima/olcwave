import json
from docker_client import docker
from aiodocker import DockerError
from aiodocker.containers import DockerContainer

class OlcRTC:
    @staticmethod
    async def build(rebuild: bool = False):
        if not rebuild:
            try:
                _=await docker.images.get("olcrtc")
                return
            except DockerError:
                pass

        _= await docker.images.build(
            path_dockerfile="olcrtc",
            tag="olcrtc",
            rm=True,
            forcerm=True
        )

    @staticmethod
    async def run(
        config: str,
        config_tag: str,
        user_id: str,
        upstream_proxy_addr: str = "",
        upstream_proxy_user: str = "",
        upstream_proxy_pass: str = ""
    ):
        name = f"olcwave-{config_tag}-{user_id}"

        try:
            old = await docker.containers.get(name)
            await old.delete(force=True)
        except DockerError:
            pass

        container = await docker.containers.create(
            config={
                "Image": "olcrtc",
                "Env": [
                    f"CONFIG={config}",
                    f"UPSTREAM_SOCKS={upstream_proxy_addr}",
                    f"UPSTREAM_USER={upstream_proxy_user}",
                    f"UPSTREAM_PASS={upstream_proxy_pass}",
                ],
                "HostConfig": {
                    "ExtraHosts": [
                        "host.docker.internal:host-gateway",
                    ]
                },
            },
            name=name,
        )

        await container.start()

        return container

    @staticmethod
    async def start(name: str):
        container = await docker.containers.get(name)
        await container.start()


    @staticmethod
    async def stop(name: str):
        container = await docker.containers.get(name)
        await container.stop()

    @staticmethod
    async def restart(
        name: str,
        upstream_proxy_addr: str = "",
        upstream_proxy_user: str = "",
        upstream_proxy_pass: str = "",
    ):
        container = await docker.containers.get(name)

        info = await container.show()

        image = info["Config"]["Image"]

        env = {}
        for item in info["Config"].get("Env", []):
            if "=" in item:
                k, v = item.split("=", 1)
                env[k] = v

        env["UPSTREAM_SOCKS"] = upstream_proxy_addr
        env["UPSTREAM_USER"] = upstream_proxy_user
        env["UPSTREAM_PASS"] = upstream_proxy_pass

        state = info["State"]["Status"]

        if state == "running":
            await container.delete(force=True)

        new_container = await docker.containers.create(
            config={
                "Image": image,
                "Env": [f"{k}={v}" for k, v in env.items()],
                "HostConfig": {
                    "ExtraHosts": [
                        "host.docker.internal:host-gateway",
                    ]
                },
            },
            name=name,
        )

        await new_container.start()

    @staticmethod
    async def remove(name: str):
        container = await docker.containers.get(name)
        await container.delete(force=True)

    @staticmethod
    async def logs(name: str) -> str:
        container = await docker.containers.get(name)
        logs = await container.log(stdout=True, stderr=True)
        return "".join(logs)

    @staticmethod
    async def get(name: str) -> DockerContainer:
        return await docker.containers.get(name)

    @staticmethod
    async def all(include_stopped: bool = False) -> list[DockerContainer]:
        return await docker.containers.list(all=include_stopped)  # pyright: ignore[reportUnknownMemberType, reportUnknownVariableType]

    @staticmethod
    async def get_config(name: str):
        container = await docker.containers.get(name)

        exec_ = await container.exec(cmd=["cat", "/tmp/olcwave/config.yaml"])

        config = await exec_.start(detach=False)
        return config

    @staticmethod
    async def get_stats(name: str) -> dict:  # pyright: ignore[reportUnknownParameterType]
        container = await docker.containers.get(name)

        exec_ = await container.exec(
            cmd=["cat", "/tmp/olcwave/stats.json"]
        )

        result = await exec_.start(detach=False)

        raw = result.decode().strip()

        if not raw:
            return {}

        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            return {}

        return data if isinstance(data, dict) else {}