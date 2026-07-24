from fastapi import HTTPException, status

from sqlalchemy import delete, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from routing.models import Routing

class RoutingDB:
    @staticmethod
    async def create(db: AsyncSession, xray_json: str) -> Routing:
        routing = Routing(
            id = 1,
            xray_json = xray_json
        )

        db.add(routing)
        await db.commit()
        await db.refresh(routing)

        return routing

    @staticmethod
    async def get(db: AsyncSession) -> str:
        result = await db.execute(select(Routing).where(Routing.id == 1))
        routing = result.scalar_one_or_none()
        if routing is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Routing not found",
            )
        
        return routing.xray_json

    @staticmethod
    async def update(db: AsyncSession, xray_json: str) -> bool:
        _ = await db.execute(update(Routing).values(xray_json=xray_json))
        await db.commit()
    
        return True
    
    @staticmethod
    async def delete(db: AsyncSession) -> bool:
        _= await db.execute(delete(Routing).where(Routing.id == 1))
        await db.commit()

        return True