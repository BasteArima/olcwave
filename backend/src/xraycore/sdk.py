import json
import docker
from docker.errors import ImageNotFound, NotFound
from docker.models.containers import Container

client = docker.from_env()


class XrayCore:
    @staticmethod
    def run(xray_json: str):
        name = f"olcwave-xraycore"

        try:
            old = client.containers.get(name)
            old.remove(force=True)
        except Exception:
            pass

        return client.containers.run(
            image="xraycore",
            name="olcwave-xraycore",
            detach=True,
            environment={
                "CONFIG": xray_json,
            },
            ports={
                "10808/tcp": ("127.0.0.1", 10808),
                "10808/udp": ("127.0.0.1", 10808),
            }
        )

    @staticmethod
    def start():
        try:
            client.containers.get("olcwave-xraycore").start()
        except NotFound:
            print("XRAY CONTAINER NOT FOUND")

    @staticmethod
    def stop():
        client.containers.get("olcwave-xraycore").stop()

    @staticmethod
    def logs() -> str:
        return client.containers.get("olcwave-xraycore").logs().decode()

    @staticmethod
    def get() -> Container:
        return client.containers.get("olcwave-xraycore")

    @staticmethod
    def get_geoip() -> bytes:
        container = client.containers.get("olcwave-xraycore")
        exit_code, data = container.exec_run("cat /app/geoip.dat")

        if exit_code != 0:
            raise RuntimeError("Failed to read geoip.dat")

        return data

    @staticmethod
    def get_geosite() -> bytes:
        container = client.containers.get("olcwave-xraycore")
        exit_code, data = container.exec_run("cat /app/geosite.dat")

        if exit_code != 0:
            raise RuntimeError("Failed to read geosite.dat")

        return data