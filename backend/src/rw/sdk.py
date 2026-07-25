from remnawave.models.users import GetAllUsersResponseDto
from remnawave.models.users import GetAllUsersResponseDto
from remnawave.models.users import GetUserByShortUuidResponseDto
from remnawave.models.subscription import GetSubscriptionInfoResponseDto
from remnawave import RemnawaveSDK  # pyright: ignore[reportMissingTypeStubs]
from remnawave.exceptions.general import NotFoundError  # pyright: ignore[reportMissingTypeStubs]
from remnawave.models import (  # pyright: ignore[reportMissingTypeStubs]
    SubscriptionInfoResponseDto,
    SubscriptionSettingsResponseDto
)

from config import settings


remnawave = RemnawaveSDK(base_url=settings.RW_API_URL, token=settings.RW_API_TOKEN)


async def getAllUsers() -> GetAllUsersResponseDto:
    users_coroutine = remnawave.users.get_all_users()
    users: GetAllUsersResponseDto = await users_coroutine # what the f are this syntax  # pyright: ignore[reportAssignmentType]

    return users

async def isUserValid(short_uuid: str) -> SubscriptionInfoResponseDto | None:
    try:
        sub: GetSubscriptionInfoResponseDto = await remnawave.subscription.get_subscription_info_by_short_uuid(short_uuid)  # pyright: ignore[reportAssignmentType]

        if not sub.is_found:
            return None

        if settings.RW_SQUAD_NAME:
            user: GetUserByShortUuidResponseDto = await remnawave.users.get_user_by_short_uuid(short_uuid)  # pyright: ignore[reportAssignmentType]

            for squad in user.active_internal_squads:
                if settings.RW_SQUAD_NAME == squad.name or settings.RW_SQUAD_NAME == str(squad.uuid):
                    return sub
            return None

        return sub

    except NotFoundError:
        return None


async def getSubscriptionSettings():
    sub: SubscriptionSettingsResponseDto = await remnawave.subscriptions_settings.get_settings()  # pyright: ignore[reportAssignmentType, reportUnknownVariableType]

    return sub