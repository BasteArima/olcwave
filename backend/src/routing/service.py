from fastapi.exceptions import HTTPException

from fastapi import HTTPException

import json

from settings.service import SettingsService
from xray_core.sdk import XrayCore
from database import async_session_factory
from routing.db import RoutingDB

class Routing:
    @staticmethod
    def get_socks_port(xray_json: str) -> int:
        xray_config = json.loads(xray_json)
        if xray_config.get("inbounds", None) and len(xray_config["inbounds"]) >= 1:
            socks_inbound = xray_config["inbounds"][0]
            if socks_inbound.get("protocol") != "socks":
                raise HTTPException(422, detail="Invalid config, needs to be exactly 1 socks inbound")
            socks_port = socks_inbound["port"]
            if str(socks_port).isdigit() and 1 < int(socks_port) < 65535:
                return int(socks_port)
            else:
                raise HTTPException(422, detail="Invalid config, needs to be exactly 1 socks inbound")
        else:
            raise HTTPException(422, detail="Invalid config, needs to be exactly 1 socks inbound")


    @staticmethod
    async def create(xray_json: str):
        from olcrtc.service import Containers
        async with async_session_factory() as db:  
            _= await RoutingDB.create(db, xray_json)

        socks_port =Routing.get_socks_port(xray_json)

        settings = SettingsService.get()
        settings.xray_routing_enabled = True
        settings.xray_routing_inbound_port = socks_port 
        await SettingsService.set(settings)

        XrayCore.run(xray_json)

        for container in Containers.all():
            Containers.restart(container.name, upstream_proxy_addr=f"host.docker.internal:{str(socks_port)}")

        return xray_json

    @staticmethod
    async def get():
        async with async_session_factory() as db:
            xray_json = await RoutingDB.get(db) 
        return xray_json

    @staticmethod
    async def update(xray_json: str):
        from olcrtc.service import Containers
        async with async_session_factory() as db:  
            _= await RoutingDB.update(db, xray_json) 

        socks_port =Routing.get_socks_port(xray_json)

        settings = SettingsService.get()
        settings.xray_routing_inbound_port = socks_port 
        await SettingsService.set(settings)

        XrayCore.run(xray_json)

        for container in Containers.all():
            Containers.restart(container.name, upstream_proxy_addr=f"host.docker.internal:{str(socks_port)}")
        
        return xray_json


    @staticmethod
    async def delete():
        from olcrtc.service import Containers
        async with async_session_factory() as db:  
            _=await RoutingDB.delete(db)

        settings = SettingsService.get()
        settings.xray_routing_enabled = False
        settings.xray_routing_inbound_port = 0
        
        await SettingsService.set(settings)

        XrayCore.stop()

        for container in Containers.all():
            Containers.restart(container.name)
