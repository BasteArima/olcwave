import json
import docker
from docker.errors import ImageNotFound
from docker.models.containers import Container

client = docker.from_env()


class OlcRTC:
    @staticmethod
    def build(rebuild: bool = False):
        if not rebuild:
            try:
                _=client.images.get("olcrtc")
                return
            except ImageNotFound:
                pass

        _=client.images.build(
            path="olcrtc",
            tag="olcrtc",
            rm=True,
            forcerm=True
        )

    @staticmethod
    def run(
        config: str,
        config_tag: str,
        user_id: str,
        upstream_proxy_addr: str = "",
        upstream_proxy_user: str = "",
        upstream_proxy_pass: str = ""
    ):
        name = f"olcwave-{config_tag}-{user_id}"

        try:
            old = client.containers.get(name)
            old.remove(force=True)
        except Exception:
            pass

        return client.containers.run(
            image="olcrtc",
            name=name,
            detach=True,
            environment={
                "CONFIG": config,
                "UPSTREAM_SOCKS": upstream_proxy_addr,
                "UPSTREAM_USER": upstream_proxy_user,
                "UPSTREAM_PASS": upstream_proxy_pass
            }
        )

    @staticmethod
    def start(name: str):
        client.containers.get(name).start()

    @staticmethod
    def stop(name: str):
        client.containers.get(name).stop()

    @staticmethod
    def restart(
        name: str,
        upstream_proxy_addr: str = "",
        upstream_proxy_user: str = "",
        upstream_proxy_pass: str = "",
    ):
        container = client.containers.get(name)

        config = container.attrs["Config"]

        image = config["Image"]
        env = {}

        for item in config.get("Env", []):
            if "=" in item:
                k, v = item.split("=", 1)
                env[k] = v

        env["UPSTREAM_SOCKS"] = upstream_proxy_addr
        env["UPSTREAM_USER"] = upstream_proxy_user
        env["UPSTREAM_PASS"] = upstream_proxy_pass

        container.remove(force=True)

        client.containers.run(
            image=image,
            name=name,
            detach=True,
            environment=env,
        )

    @staticmethod
    def remove(name: str):
        client.containers.get(name).remove(force=True)

    @staticmethod
    def logs(name: str) -> str:
        return client.containers.get(name).logs().decode()

    @staticmethod
    def get(name: str) -> Container:
        return client.containers.get(name)

    @staticmethod
    def all(include_stopped: bool = False) -> list[Container]:
        return client.containers.list(all=include_stopped)  # pyright: ignore[reportUnknownMemberType, reportUnknownVariableType]

    @staticmethod
    def get_config(name: str):
        return client.containers.get(name).exec_run("cat /tmp/olcwave/config.yaml")  # pyright: ignore[reportUnknownMemberType]

    @staticmethod
    def get_stats(name: str) -> dict:  # pyright: ignore[reportUnknownParameterType]
        result = client.containers.get(name).exec_run("cat /var/lib/olcwave/stats.json")  # pyright: ignore[reportUnknownMemberType]

        if result.exit_code != 0:  # pyright: ignore[reportAny]
            return {}

        raw = result.output.decode().strip()
        if not raw:
            return {}

        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            return {}

        return data if isinstance(data, dict) else {}
