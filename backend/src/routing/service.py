from fastapi.exceptions import HTTPException

from fastapi import HTTPException

import json

from settings.service import SettingsService
from xray_core.sdk import XrayCore
from database import async_session_factory
from routing.db import RoutingDB
from xray_core.geodata.geodat_pb2 import GeoSiteList, GeoIPList

class Routing:
    @staticmethod
    def validate_routing_geotags(routing: str):
        try:
            geotags = Routing.get_geotags()
        except Exception:
            return

        geoip_set = set(geotags.get("geoip", []))
        geosite_set = set(geotags.get("geosite", []))

        try:
            config = json.loads(routing)
        except (json.JSONDecodeError, TypeError):
            return

        rules = config.get("routing", {}).get("rules", [])
        if not isinstance(rules, list):
            return

        invalid = []

        for i, rule in enumerate(rules):
            if not isinstance(rule, dict):
                continue

            for ip_val in rule.get("ip", []):
                if isinstance(ip_val, str) and ip_val.lower().startswith("geoip:"):
                    code = ip_val[6:].lower()
                    if code not in geoip_set:
                        invalid.append({
                            "field": "routing.geoip",
                            "value": ip_val,
                            "reason": f'"{ip_val}" does not exist in available geoip tags',
                        })

            for domain_val in rule.get("domain", []):
                if isinstance(domain_val, str) and domain_val.lower().startswith("geosite:"):
                    code = domain_val[9:].lower()
                    if code not in geosite_set:
                        invalid.append({
                            "field": "routing.geosite",
                            "value": domain_val,
                            "reason": f'"{domain_val}" does not exist in available geosite tags',
                        })

        if invalid:
            detail = "Invalid geotag references in routing config:\n" + "\n".join(
                f'- {e["field"]}: {e["value"]} — {e["reason"]}' for e in invalid
            )
            raise HTTPException(status_code=422, detail=detail)

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

        Routing.validate_routing_geotags(routing)

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

        Routing.validate_routing_geotags(routing)

        xray_json = Routing.routing_to_xray_json(routing)

        async with async_session_factory() as db:  
            _= await RoutingDB.update(db, xray_json) 

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

    @staticmethod
    def get_geotags():
        geoip_data = XrayCore.get_geoip()
        geosite_data = XrayCore.get_geosite()
        
        geoip = GeoIPList()
        geosite = GeoSiteList()

        geoip.ParseFromString(geoip_data)
        geosite.ParseFromString(geosite_data)

        return {
            "geoip": [x.code.lower() for x in geoip.entry],
            "geosite": [x.code.lower() for x in geosite.entry]
        }