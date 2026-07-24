from fastapi import APIRouter, Depends

from auth.dependencies import get_current_admin
from settings.service import SettingsService
from xray_core.sdk import XrayCore
from routing.service import Routing

router = APIRouter(prefix="/routing", tags=["routing"])

@router.get("/enabled")
async def check_enabled(_admin: dict = Depends(get_current_admin)):
    return SettingsService.get().xray_routing_enabled

@router.get("/config")
async def get(_admin: dict = Depends(get_current_admin)):
    profile = await Routing.get()

    return profile

@router.post("/config")
async def create(xray_json: str, _admin: dict = Depends(get_current_admin)):
    await Routing.create(xray_json)

    return "ok"
    
@router.put("/config")
async def update(xray_json: str, _admin: dict = Depends(get_current_admin)):
    await Routing.update(xray_json)

@router.delete("/config")
async def delete(_admin: dict = Depends(get_current_admin)):
    await Routing.delete()

@router.get("/logs")
async def logs(_admin: dict = Depends(get_current_admin)):
    return XrayCore.logs()