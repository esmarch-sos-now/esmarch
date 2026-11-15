"""'Khóa học sơ cứu': only registered responders can read the course and record progress."""

import uuid
from datetime import UTC, datetime, timedelta

import pytest

from app.core.config import get_settings
from app.modules.courses.content import COURSES, SOURCE_NAME, SOURCE_PLAYLIST_URL
from app.modules.courses.quiz import QUIZ_SIZE
from app.modules.courses.service import _bank, _read_token, course_service
from app.modules.support.models import Responder
from tests.auth_tokens import bearer


@pytest.fixture(autouse=True)
def demo_enrolment(monkeypatch):
    monkeypatch.setattr(get_settings(), "support_demo_self_enroll", True)
    monkeypatch.setattr(get_settings(), "course_quiz_secret", "test-course-quiz-secret-0123456789abcdef")


def user_id(email: str) -> str:
    return str(uuid.uuid5(uuid.NAMESPACE_URL, email))


def user(email: str, name: str = "An") -> dict:
    """A signed-in Supabase user; the backend creates its `accounts` row on the first request."""
    return bearer(user_id=user_id(email), email=email, name=name)


def responder(client, email: str = "hai@example.com", name: str = "Hải") -> dict:
    auth = user(email, name)
    r = client.post("/api/support/me", headers=auth, json={"contactPhone": "0903 000 111"})
    assert r.status_code == 200 and r.json()["enrolled"] is True, r.text
    return auth


def url(course_id: str, lesson_id: str) -> str:
    return f"/api/courses/{course_id}/lessons/{lesson_id}/quiz"


def new_quiz(client, auth: dict, course_id: str, lesson_id: str) -> dict:
    r = client.get(url(course_id, lesson_id), headers=auth)
    assert r.status_code == 200, r.text
    return r.json()


def answer_key(email: str, course_id: str, lesson_id: str, token: str) -> list[int]:
    """What the server will grade against: the questions regenerated from the token's seed."""
    course = next(course for course in COURSES if course.id == course_id)
    lesson = next(lesson for lesson in course.lessons if lesson.id == lesson_id)
    ticket = _read_token(token, user_id(email), course_id, lesson_id)
    return [q.answer for q in course_service._questions(_bank(), lesson, ticket.seed)]


def submit(client, auth: dict, course_id: str, lesson_id: str, token: str, answers: list[int]):
    return client.post(url(course_id, lesson_id), headers=auth, json={"token": token, "answers": answers})


def pass_lesson(client, auth: dict, course_id: str, lesson_id: str, email: str = "hai@example.com") -> dict:
    quiz = new_quiz(client, auth, course_id, lesson_id)
    key = answer_key(email, course_id, lesson_id, quiz["token"])
    body = submit(client, auth, course_id, lesson_id, quiz["token"], key).json()
    assert body["passed"] is True, body
    return body


def test_course_is_closed_for_anonymous_and_non_responders(client):
    assert client.get("/api/courses").status_code == 401
    auth = user("an@example.com")
    locked = client.get("/api/courses", headers=auth)
    assert locked.status_code == 403
    assert "người hỗ trợ" in locked.json()["detail"]
    lesson = COURSES[0].lessons[0]
    assert client.get(url(COURSES[0].id, lesson.id), headers=auth).status_code == 403
    assert submit(client, auth, COURSES[0].id, lesson.id, "x.y", [0] * QUIZ_SIZE).status_code == 403


def test_verified_responder_sees_the_course_and_a_quiz_without_answers(client):
    auth = responder(client)
    body = client.get("/api/courses", headers=auth).json()
    assert body["responderName"] == "Hải"
    course = body["courses"][0]
    assert course["lessonCount"] == 3 and course["progressPercent"] == 0 and course["completed"] is False
    assert course["completedAt"] is None and course["disclaimer"]
    first = course["lessons"][0]
    assert first["completed"] is False and first["sections"]

    quiz = new_quiz(client, auth, COURSES[0].id, first["id"])
    assert quiz["token"] and len(quiz["questions"]) == QUIZ_SIZE
    for question in quiz["questions"]:
        assert set(question) == {"id", "question", "options"}


def test_unverified_responder_is_denied(client, session):
    auth = user("an@example.com")
    assert client.get("/api/auth/me", headers=auth).status_code == 200  # creates the account row
    session.add(
        Responder(
            id=user_id("an@example.com"),
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


def test_wrong_answers_reveal_explanations_without_completing_the_lesson(client):
    auth = responder(client)
    course, lesson = COURSES[0], COURSES[0].lessons[0]
    quiz = new_quiz(client, auth, course.id, lesson.id)
    key = answer_key("hai@example.com", course.id, lesson.id, quiz["token"])
    wrong = [(answer + 1) % len(q["options"]) for answer, q in zip(key, quiz["questions"], strict=True)]
    result = submit(client, auth, course.id, lesson.id, quiz["token"], wrong).json()
    assert result["passed"] is False and result["correctCount"] == 0
    assert [item["correctIndex"] for item in result["results"]] == key
    assert all(item["explanation"] for item in result["results"])
    assert result["course"]["progressPercent"] == 0


def test_a_quiz_token_is_graded_once_and_bound_to_its_user_and_lesson(client):
    auth = responder(client)
    other = responder(client, "khac@example.com", "Khác")
    course, lesson = COURSES[0], COURSES[0].lessons[0]
    quiz = new_quiz(client, auth, course.id, lesson.id)
    key = answer_key("hai@example.com", course.id, lesson.id, quiz["token"])

    assert submit(client, other, course.id, lesson.id, quiz["token"], key).status_code == 400
    assert submit(client, auth, course.id, course.lessons[1].id, quiz["token"], key).status_code == 400
    assert submit(client, auth, course.id, lesson.id, quiz["token"] + "0", key).status_code == 400
    assert submit(client, auth, course.id, lesson.id, quiz["token"], key).json()["passed"] is True
    assert submit(client, auth, course.id, lesson.id, quiz["token"], key).status_code == 409


def test_passing_a_quiz_records_progress_and_the_next_lesson(client):
    auth = responder(client)
    course, lesson = COURSES[0], COURSES[0].lessons[0]
    result = pass_lesson(client, auth, course.id, lesson.id)
    assert result["correctCount"] == result["total"] == QUIZ_SIZE
    view = result["course"]
    assert view["progressPercent"] == 33 and view["completedLessons"] == 1
    assert view["lessons"][0]["completed"] is True and view["lessons"][0]["quizScore"] == QUIZ_SIZE
    assert view["nextLessonId"] == course.lessons[1].id

    # Passing again keeps the stored progress.
    assert pass_lesson(client, auth, course.id, lesson.id)["course"]["completedLessons"] == 1
    assert client.get("/api/courses", headers=auth).json()["courses"][0]["progressPercent"] == 33


def test_completing_every_lesson_completes_the_course(client):
    auth = responder(client)
    course = COURSES[0]
    for lesson in course.lessons:
        pass_lesson(client, auth, course.id, lesson.id)
    body = client.get("/api/courses", headers=auth).json()["courses"][0]
    assert body["completed"] is True and body["progressPercent"] == 100 and body["nextLessonId"] is None
    assert body["completedAt"] is not None


def test_progress_is_private_and_input_is_validated(client):
    auth = responder(client)
    other = responder(client, "khac@example.com", "Khác")
    course, lesson = COURSES[0], COURSES[0].lessons[0]
    quiz = new_quiz(client, auth, course.id, lesson.id)

    assert submit(client, auth, course.id, lesson.id, quiz["token"], []).status_code == 400
    assert submit(client, auth, course.id, lesson.id, quiz["token"], [99] * QUIZ_SIZE).status_code == 400
    assert client.get(url("unknown", lesson.id), headers=auth).status_code == 404
    assert client.get(url(course.id, "unknown"), headers=auth).status_code == 404

    pass_lesson(client, auth, course.id, lesson.id)
    assert client.get("/api/courses", headers=other).json()["courses"][0]["progressPercent"] == 0


def test_two_video_courses_credit_the_source(client):
    auth = responder(client)
    body = client.get("/api/courses", headers=auth).json()
    assert [c["id"] for c in body["courses"]] == ["airway-choking", "breathing-bleeding-fainting"]
    assert body["completedCourses"] == []
    lesson_ids = [lesson.id for course in COURSES for lesson in course.lessons]
    assert len(lesson_ids) == len(set(lesson_ids))  # progress rows are keyed by lesson id
    for course in body["courses"]:
        assert course["lessonCount"] == 3 and course["badge"].startswith("Hoàn thành khóa")
        source = course["source"]
        assert source["name"] == SOURCE_NAME and source["playlistUrl"] == SOURCE_PLAYLIST_URL
        assert source["channelUrl"].startswith("https://www.youtube.com/") and source["playlistTitle"]
        assert source["note"]
        for lesson in course["lessons"]:
            video = lesson["video"]
            assert video["embedUrl"] == f"https://www.youtube-nocookie.com/embed/{video['youtubeId']}?rel=0"
            assert video["url"] == f"https://www.youtube.com/watch?v={video['youtubeId']}"
            assert "Bệnh viện Hoàn Mỹ Đà Nẵng" in video["title"]
            assert lesson["sections"]


def test_finished_course_is_recorded_on_the_profile(client):
    auth = responder(client)
    first, second = COURSES
    pass_lesson(client, auth, second.id, second.lessons[0].id)  # course 2 stays partial
    results = [pass_lesson(client, auth, first.id, lesson.id) for lesson in first.lessons]
    assert results[-1]["course"]["completed"] is True and results[-1]["course"]["completedAt"] is not None

    body = client.get("/api/courses", headers=auth).json()
    done, partial = body["courses"]
    assert done["completed"] is True and done["completedAt"] is not None
    assert partial["completed"] is False and partial["completedAt"] is None and partial["completedLessons"] == 1
    assert [(c["id"], c["badge"]) for c in body["completedCourses"]] == [(first.id, first.badge)]

    me = client.get("/api/support/me", headers=auth).json()
    assert [c["id"] for c in me["completedCourses"]] == [first.id]
    assert me["completedCourses"][0]["badge"] == first.badge and me["completedCourses"][0]["completedAt"]


def test_new_responder_profile_lists_no_courses(client):
    auth = responder(client)
    assert client.get("/api/support/me", headers=auth).json()["completedCourses"] == []


def test_requester_sees_the_accepting_responders_courses(client):
    auth = responder(client)
    course = COURSES[0]
    for lesson in course.lessons:
        pass_lesson(client, auth, course.id, lesson.id)
    here = {"latitude": 10.81, "longitude": 106.7, "consentToLocationUse": True, "available": True}
    assert client.put("/api/support/me/availability", headers=auth, json=here).json()["available"] is True
    created = client.post(
        "/api/support-requests",
        json={"latitude": 10.8, "longitude": 106.7, "shareLocationWithAcceptedResponder": True},
    ).json()
    assert client.post(f"/api/support/me/requests/{created['id']}/accept", headers=auth).status_code == 200
    owner = {"Authorization": f"Bearer {created['requesterToken']}"}
    state = client.get(f"/api/support-requests/{created['id']}", headers=owner).json()
    assert [c["badge"] for c in state["responder"]["completedCourses"]] == [course.badge]
