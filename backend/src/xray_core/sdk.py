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
