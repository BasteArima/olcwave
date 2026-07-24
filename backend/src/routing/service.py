from fastapi.exceptions import HTTPException

from fastapi import HTTPException

import json

from settings.service import SettingsService
from xray_core.sdk import XrayCore
from database import async_session_factory
from routing.db import RoutingDB

class Routing:
    @staticmethod
    def routing_to_xray_json(routing: str):
        xray_config = json.loads(routing)
        xray_config["dns"] = {"servers": [{"address": "1.1.1.1"}],"queryStrategy": "IPIfNonMatch"}
        xray_config["inbounds"] = [{
            "tag": "socks",
            "listen": "0.0.0.0",
            "port": 10808,
            "protocol": "socks",
            "settings": {
                "auth": "noauth",
                "udp": True
            },
            "sniffing": {
                "enabled": True,
                "destOverride": [
                "http",
                "tls",
                "fakedns"
                ]
            }
            }
        ]

        return json.dumps(xray_config, indent=2)

    @staticmethod
    async def create(routing: str):
        from olcrtc.service import Containers

        xray_json = Routing.routing_to_xray_json(routing)

        async with async_session_factory() as db:  
            _= await RoutingDB.create(db, xray_json)


        settings = SettingsService.get()
        settings.xray_routing_enabled = True

        await SettingsService.set(settings)

        XrayCore.run(xray_json)

        for container in Containers.all():
            Containers.restart(container.name, upstream_proxy_addr=f"host.docker.internal:10808")

        return xray_json

    @staticmethod
    async def get():
        async with async_session_factory() as db:
            xray_json = await RoutingDB.get(db) 
        return xray_json

    @staticmethod
    async def update(routing: str):
        from olcrtc.service import Containers

        xray_json = Routing.routing_to_xray_json(routing)

        async with async_session_factory() as db:  
            _= await RoutingDB.update(db, xray_json) 

        settings = SettingsService.get()
        await SettingsService.set(settings)

        XrayCore.run(xray_json)

        for container in Containers.all():
            Containers.restart(container.name, upstream_proxy_addr=f"host.docker.internal:10808")
        
        return xray_json


    @staticmethod
    async def delete():
        from olcrtc.service import Containers
        async with async_session_factory() as db:  
            _=await RoutingDB.delete(db)

        settings = SettingsService.get()
        settings.xray_routing_enabled = False
        
        await SettingsService.set(settings)

        XrayCore.stop()

        for container in Containers.all():
            Containers.restart(container.name)
