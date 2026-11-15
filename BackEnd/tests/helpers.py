from datetime import UTC, datetime

from app.modules.facilities.models import Facility, FacilityPhone, FacilityType


def save_facility(
    session,
    fid,
    lat,
    emergency=True,
    full_time=True,
    verified=datetime(2026, 1, 1, tzinfo=UTC),
    district="Bình Thạnh",
    lng=106.70,
):
    session.add(
        Facility(
            id=fid,
            name=f"Test {fid}",
            type=FacilityType.HOSPITAL if emergency else FacilityType.CLINIC,
            address="Synthetic test address",
            district=district,
            latitude=lat,
            longitude=lng,
            has_emergency=emergency,
            verified_at=verified,
            verification_source="Test fixture only",
            phones=[FacilityPhone(phone_order=0, label="Test only", number="02800000000", is_24h=full_time)],
        )
    )
    session.commit()
    from app.modules.facilities import catalog

    catalog.invalidate()


def finish_courses(user_id: str, courses=None) -> None:
    """Records every lesson of `courses` (default: all) as passed, as the lesson quizzes would."""
    from sqlmodel import Session

    from app.core import clock
    from app.core.db import get_engine
    from app.modules.courses.content import COURSES
    from app.modules.courses.models import CourseProgress

    with Session(get_engine()) as s:
        for course in COURSES if courses is None else courses:
            for lesson in course.lessons:
                key = f"{user_id}:{lesson.id}"
                if s.get(CourseProgress, key) is None:
                    s.add(
                        CourseProgress(
                            id=key, user_id=user_id, course_id=course.id, lesson_id=lesson.id, completed_at=clock.now()
                        )
                    )
        s.commit()


def approve(user_id: str) -> None:
    """What an admin's "Duyệt" does to the profile (verified now)."""
    from sqlmodel import Session

    from app.core import clock
    from app.core.db import get_engine
    from app.modules.support.models import Responder

    with Session(get_engine()) as s:
        profile = s.get(Responder, user_id)
        assert profile is not None
        profile.verified_at = clock.now()
        s.commit()


def become_responder(client, auth: dict, user_id: str) -> dict:
    """The whole way in for a signed-in user: courses, application, admin approval. Returns `auth`."""
    assert client.get("/api/support/me", headers=auth).status_code == 200  # creates the account row
    finish_courses(user_id)
    r = client.post(
        "/api/support/me/application", headers=auth, json={"commitment": True, "email": "nguoihotro@example.com"}
    )
    assert r.status_code == 200 and r.json()["status"] == "pending", r.text
    approve(user_id)
    return auth
