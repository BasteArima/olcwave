from remnawave.models.users import GetAllUsersResponseDto, UserResponseDto
from remnawave.models.users import GetUserByShortUuidResponseDto
from remnawave.models.subscription import GetSubscriptionInfoResponseDto
from remnawave import RemnawaveSDK
from remnawave.exceptions.general import NotFoundError
from remnawave.models import (
    SubscriptionInfoResponseDto,
    SubscriptionSettingsResponseDto
)

from config import settings


remnawave = RemnawaveSDK(
    base_url=settings.RW_API_URL,
    token=settings.RW_API_TOKEN,
    caddy_token=settings.RW_CADDY_TOKEN or None,
)

async def getAllUsers() -> GetAllUsersResponseDto:
    PAGE_SIZE = 100

    start = 0
    users: list[UserResponseDto] = []

    while True:
        response = await remnawave.users.get_all_users(
            start=start,
            size=PAGE_SIZE,
        )

        users.extend(response.users)

        if len(response.users) < PAGE_SIZE or len(users) >= response.total:
            break

        start += len(response.users)

    return GetAllUsersResponseDto(
        users=users,
        total=len(users),
    )


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