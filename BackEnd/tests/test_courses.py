"""'Khóa học sơ cứu': only registered responders can read the course and record progress."""

from datetime import UTC, datetime, timedelta

import pytest

from app.core.config import get_settings
from app.modules.auth.models import User
from app.modules.auth.security import create_access_token
from app.modules.courses.content import COURSES
from app.modules.support.models import Responder


@pytest.fixture(autouse=True)
def demo_enrolment(monkeypatch):
    monkeypatch.setattr(get_settings(), "support_demo_self_enroll", True)


def user(session, email: str, name: str = "An") -> tuple[dict, User]:
    u = User(
        email=email,
        password_hash="x",
        display_name=name,
        email_verified_at=datetime(2026, 1, 1, tzinfo=UTC),
        created_at=datetime(2026, 1, 1, tzinfo=UTC),
    )
    session.add(u)
    session.commit()
    return {"Authorization": f"Bearer {create_access_token(u.id)[0]}"}, u


def responder(client, session, email: str = "hai@example.com", name: str = "Hải") -> dict:
    auth, _ = user(session, email, name)
    r = client.post("/api/support/me", headers=auth, json={"contactPhone": "0903 000 111"})
    assert r.status_code == 200 and r.json()["enrolled"] is True, r.text
    return auth


def correct_answers(course_id: str, lesson_id: str) -> list[int]:
    course = next(c for c in COURSES if c.id == course_id)
    lesson = next(lesson for lesson in course.lessons if lesson.id == lesson_id)
    return [question.answer for question in lesson.quiz]


def test_course_is_closed_for_anonymous_and_non_responders(client, session):
    assert client.get("/api/courses").status_code == 401
    auth, _ = user(session, "an@example.com")
    locked = client.get("/api/courses", headers=auth)
    assert locked.status_code == 403
    assert "người hỗ trợ" in locked.json()["detail"]
    lesson = COURSES[0].lessons[0]
    url = f"/api/courses/{COURSES[0].id}/lessons/{lesson.id}/quiz"
    assert client.post(url, headers=auth, json={"answers": [0] * len(lesson.quiz)}).status_code == 403


def test_verified_responder_sees_the_course_without_quiz_answers(client, session):
    auth = responder(client, session)
    body = client.get("/api/courses", headers=auth).json()
    assert body["responderName"] == "Hải"
    course = body["courses"][0]
    assert course["lessonCount"] == 4 and course["progressPercent"] == 0 and course["completed"] is False
    assert course["nextLessonId"] == "scene-safety"
    first = course["lessons"][0]
    assert first["completed"] is False
    assert first["sections"] and first["quiz"]
    assert "answer" not in first["quiz"][0] and "correctIndex" not in first["quiz"][0]
    assert course["disclaimer"]


def test_unverified_responder_is_denied(client, session):
    auth, u = user(session, "an@example.com")
    session.add(
        Responder(
            id=u.id,
            display_name="An",
            contact_phone="0903000111",
            skills=["FIRST_AID"],
            verified_at=datetime.now(UTC) + timedelta(days=1),
            verification_source="Pending review",
            token_hash="0" * 64,
        )
    )
    session.commit()
    assert client.get("/api/courses", headers=auth).status_code == 403


def test_wrong_answers_reveal_explanations_without_completing_the_lesson(client, session):
    auth = responder(client, session)
    lesson = COURSES[0].lessons[0]
    answers = [(question.answer + 1) % len(question.options) for question in lesson.quiz]
    url = f"/api/courses/{COURSES[0].id}/lessons/{lesson.id}/quiz"
    result = client.post(url, headers=auth, json={"answers": answers}).json()
    assert result["passed"] is False and result["correctCount"] == 0
    assert [item["correct"] for item in result["results"]] == [False] * len(lesson.quiz)
    assert all(item["explanation"] for item in result["results"])
    assert result["course"]["progressPercent"] == 0


def test_passing_a_quiz_records_progress_and_the_next_lesson(client, session):
    auth = responder(client, session)
    lesson = COURSES[0].lessons[0]
    url = f"/api/courses/{COURSES[0].id}/lessons/{lesson.id}/quiz"
    result = client.post(url, headers=auth, json={"answers": correct_answers(COURSES[0].id, lesson.id)}).json()
    assert result["passed"] is True and result["correctCount"] == result["total"]
    course = result["course"]
    assert course["progressPercent"] == 25 and course["completedLessons"] == 1
    assert course["lessons"][0]["completed"] is True and course["lessons"][0]["quizScore"] == len(lesson.quiz)
    assert course["nextLessonId"] == COURSES[0].lessons[1].id

    # Submitting again is idempotent and keeps the stored progress.
    again = client.post(url, headers=auth, json={"answers": correct_answers(COURSES[0].id, lesson.id)}).json()
    assert again["course"]["completedLessons"] == 1

    overview = client.get("/api/courses", headers=auth).json()
    assert overview["courses"][0]["progressPercent"] == 25


def test_completing_every_lesson_completes_the_course(client, session):
    auth = responder(client, session)
    course = COURSES[0]
    for lesson in course.lessons:
        url = f"/api/courses/{course.id}/lessons/{lesson.id}/quiz"
        assert client.post(url, headers=auth, json={"answers": correct_answers(course.id, lesson.id)}).json()["passed"]
    body = client.get("/api/courses", headers=auth).json()["courses"][0]
    assert body["completed"] is True and body["progressPercent"] == 100 and body["nextLessonId"] is None


def test_progress_is_private_and_input_is_validated(client, session):
    auth = responder(client, session)
    other = responder(client, session, "khac@example.com", "Khác")
    course = COURSES[0]
    lesson = course.lessons[0]
    url = f"/api/courses/{course.id}/lessons/{lesson.id}/quiz"

    assert client.post(url, headers=auth, json={"answers": []}).status_code == 400
    assert client.post(url, headers=auth, json={"answers": [99] * len(lesson.quiz)}).status_code == 400
    assert client.post(
        f"/api/courses/unknown/lessons/{lesson.id}/quiz", headers=auth, json={"answers": [0] * len(lesson.quiz)}
    ).status_code == 404
    assert client.post(
        f"/api/courses/{course.id}/lessons/unknown/quiz", headers=auth, json={"answers": [0] * len(lesson.quiz)}
    ).status_code == 404

    assert client.post(url, headers=auth, json={"answers": correct_answers(course.id, lesson.id)}).json()["passed"]
    assert client.get("/api/courses", headers=other).json()["courses"][0]["progressPercent"] == 0
