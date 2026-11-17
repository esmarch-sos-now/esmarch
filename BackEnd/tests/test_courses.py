"""'Khóa học sơ cứu': every signed-in account can read the courses and record progress, the first step to
becoming a responder."""

import math
import uuid

import pytest

from app.core import clock
from app.core.config import get_settings
from app.modules.courses.content import COURSES, SOURCE_NAME, SOURCE_PLAYLIST_URL
from app.modules.courses.quiz import QUIZ_SIZE
from app.modules.courses.service import (
    MAX_FAILED_QUIZZES,
    WATCH_MAX_GAP_SECONDS,
    _bank,
    _read_token,
    course_service,
)
from tests.auth_tokens import bearer
from tests.helpers import become_responder


@pytest.fixture(autouse=True)
def quiz_secret(monkeypatch):
    monkeypatch.setattr(get_settings(), "course_quiz_secret", "test-course-quiz-secret-0123456789abcdef")


def user_id(email: str) -> str:
    return str(uuid.uuid5(uuid.NAMESPACE_URL, email))


def user(email: str, name: str = "An") -> dict:
    """A signed-in Supabase user; the backend creates its `accounts` row on the first request."""
    return bearer(user_id=user_id(email), email=email, name=name)


def learner(client, email: str = "hai@example.com", name: str = "Hải") -> dict:
    """A signed-in account with no responder profile: the courses are open to it."""
    return user(email, name)


def url(course_id: str, lesson_id: str) -> str:
    return f"/api/courses/{course_id}/lessons/{lesson_id}/quiz"


def report(client, auth: dict, course_id: str, lesson_id: str, seconds: float):
    return client.post(f"/api/courses/{course_id}/lessons/{lesson_id}/watch", headers=auth, json={"seconds": seconds})


def watch_video(client, auth: dict, course_id: str, lesson_id: str) -> dict:
    """Play the whole video as the player would: a report at the start, then one every 5 seconds of real time."""
    lesson = next(lesson for course in COURSES for lesson in course.lessons if lesson.id == lesson_id)
    body = report(client, auth, course_id, lesson_id, 0).json()
    position = 0
    while position < lesson.video.seconds:
        clock.advance(5)
        position += 5
        r = report(client, auth, course_id, lesson_id, position)
        assert r.status_code == 200, r.text
        body = r.json()
    assert body["watched"] is True, body
    return body


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
    if not lesson_done(client, auth, course_id, lesson_id):
        watch_video(client, auth, course_id, lesson_id)
    quiz = new_quiz(client, auth, course_id, lesson_id)
    key = answer_key(email, course_id, lesson_id, quiz["token"])
    body = submit(client, auth, course_id, lesson_id, quiz["token"], key).json()
    assert body["passed"] is True, body
    return body


def lesson_done(client, auth: dict, course_id: str, lesson_id: str) -> bool:
    course = next(c for c in client.get("/api/courses", headers=auth).json()["courses"] if c["id"] == course_id)
    return next(lesson for lesson in course["lessons"] if lesson["id"] == lesson_id)["completed"]


def fail_quiz(client, auth: dict, course_id: str, lesson_id: str, email: str = "hai@example.com") -> dict:
    quiz = new_quiz(client, auth, course_id, lesson_id)
    key = answer_key(email, course_id, lesson_id, quiz["token"])
    wrong = [(answer + 1) % len(q["options"]) for answer, q in zip(key, quiz["questions"], strict=True)]
    return submit(client, auth, course_id, lesson_id, quiz["token"], wrong).json()


def test_course_needs_sign_in_only(client):
    assert client.get("/api/courses").status_code == 401
    lesson = COURSES[0].lessons[0]
    assert client.get(url(COURSES[0].id, lesson.id)).status_code == 401


def test_any_signed_in_user_sees_the_course_and_a_quiz_without_answers(client):
    auth = learner(client)
    body = client.get("/api/courses", headers=auth).json()
    assert body["responderName"] is None and body["responderSkills"] == []
    course = body["courses"][0]
    assert course["lessonCount"] == 3 and course["progressPercent"] == 0 and course["completed"] is False
    assert course["completedAt"] is None and course["disclaimer"]
    first = course["lessons"][0]
    assert first["completed"] is False and first["watched"] is False and first["watchedSeconds"] == 0
    assert first["sections"] == []  # the key points come after the video
    assert first["requiredSeconds"] == math.ceil(first["video"]["seconds"] * 0.9)

    assert watch_video(client, auth, COURSES[0].id, first["id"])["sections"]
    quiz = new_quiz(client, auth, COURSES[0].id, first["id"])
    assert quiz["token"] and len(quiz["questions"]) == QUIZ_SIZE
    for question in quiz["questions"]:
        assert set(question) == {"id", "question", "options"}


def test_a_verified_responder_is_named_on_the_course_page(client):
    auth = become_responder(client, user("hai@example.com", "Hải"), user_id("hai@example.com"))
    assert client.get("/api/courses", headers=auth).json()["responderName"] == "Hải"


def test_the_quiz_opens_only_after_the_video_is_watched(client):
    auth = learner(client)
    course, lesson = COURSES[0], COURSES[0].lessons[0]
    assert client.get(url(course.id, lesson.id), headers=auth).status_code == 403

    # A report cannot jump ahead of real playback: it moves by the real time since the previous one, so a burst of
    # reports adds nothing.
    # (The test clock also runs in real time: allow for the second or so the requests themselves take.)
    for _ in range(50):
        body = report(client, auth, course.id, lesson.id, 9999).json()
    assert body["watchedSeconds"] < 2 and body["watched"] is False
    clock.advance(5)
    after_five = report(client, auth, course.id, lesson.id, 9999).json()["watchedSeconds"]
    assert 5 <= after_five < 7
    # A long pause does not bank time either, and the point never goes back.
    clock.advance(3600)
    after_pause = report(client, auth, course.id, lesson.id, 9999).json()["watchedSeconds"]
    assert after_five + WATCH_MAX_GAP_SECONDS <= after_pause < after_five + WATCH_MAX_GAP_SECONDS + 1
    assert report(client, auth, course.id, lesson.id, 0).json()["watchedSeconds"] >= after_pause
    assert client.get(url(course.id, lesson.id), headers=auth).status_code == 403

    watch_video(client, auth, course.id, lesson.id)
    assert client.get(url(course.id, lesson.id), headers=auth).status_code == 200
    # The next lesson is still closed, and the watch report is checked.
    assert client.get(url(course.id, course.lessons[1].id), headers=auth).status_code == 403
    assert report(client, auth, course.id, lesson.id, -1).status_code == 400
    assert report(client, auth, course.id, "unknown", 1).status_code == 404


def test_wrong_answers_are_marked_without_revealing_the_right_ones(client):
    auth = learner(client)
    course, lesson = COURSES[0], COURSES[0].lessons[0]
    watch_video(client, auth, course.id, lesson.id)
    result = fail_quiz(client, auth, course.id, lesson.id)
    assert result["passed"] is False and result["correctCount"] == 0
    assert all(item["correct"] is False for item in result["results"])
    assert all(item["correctIndex"] is None and item["explanation"] is None for item in result["results"])
    assert result["attemptsLeft"] == MAX_FAILED_QUIZZES - 1
    assert result["course"]["progressPercent"] == 0 and result["course"]["lessons"][0]["watched"] is True


def test_failing_too_often_means_watching_the_video_again(client):
    auth = learner(client)
    course, lesson = COURSES[0], COURSES[0].lessons[0]
    watch_video(client, auth, course.id, lesson.id)
    lefts = [fail_quiz(client, auth, course.id, lesson.id) for _ in range(MAX_FAILED_QUIZZES)]
    assert [result["attemptsLeft"] for result in lefts] == list(range(MAX_FAILED_QUIZZES - 1, -1, -1))
    view = lefts[-1]["course"]["lessons"][0]
    assert view["watched"] is False and view["watchedSeconds"] == 0 and view["sections"] == []
    assert client.get(url(course.id, lesson.id), headers=auth).status_code == 403

    # A quiz issued before the reset cannot be graded either.
    watch_video(client, auth, course.id, lesson.id)
    quiz = new_quiz(client, auth, course.id, lesson.id)
    for _ in range(MAX_FAILED_QUIZZES):
        fail_quiz(client, auth, course.id, lesson.id)
    key = answer_key("hai@example.com", course.id, lesson.id, quiz["token"])
    assert submit(client, auth, course.id, lesson.id, quiz["token"], key).status_code == 403


def test_a_passed_lesson_stays_open_for_review(client):
    auth = learner(client)
    course, lesson = COURSES[0], COURSES[0].lessons[0]
    result = pass_lesson(client, auth, course.id, lesson.id)
    assert result["attemptsLeft"] is None
    assert all(item["correctIndex"] is not None and item["explanation"] for item in result["results"])
    for _ in range(MAX_FAILED_QUIZZES + 1):
        assert fail_quiz(client, auth, course.id, lesson.id)["attemptsLeft"] is None
    view = client.get("/api/courses", headers=auth).json()["courses"][0]["lessons"][0]
    assert view["completed"] is True and view["watched"] is True and view["sections"]


def test_a_quiz_token_is_graded_once_and_bound_to_its_user_and_lesson(client):
    auth = learner(client)
    other = learner(client, "khac@example.com", "Khác")
    course, lesson = COURSES[0], COURSES[0].lessons[0]
    watch_video(client, auth, course.id, lesson.id)
    quiz = new_quiz(client, auth, course.id, lesson.id)
    key = answer_key("hai@example.com", course.id, lesson.id, quiz["token"])

    assert submit(client, other, course.id, lesson.id, quiz["token"], key).status_code == 400
    assert submit(client, auth, course.id, course.lessons[1].id, quiz["token"], key).status_code == 400
    assert submit(client, auth, course.id, lesson.id, quiz["token"] + "0", key).status_code == 400
    assert submit(client, auth, course.id, lesson.id, quiz["token"], key).json()["passed"] is True
    assert submit(client, auth, course.id, lesson.id, quiz["token"], key).status_code == 409


def test_passing_a_quiz_records_progress_and_the_next_lesson(client):
    auth = learner(client)
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
    auth = learner(client)
    course = COURSES[0]
    for lesson in course.lessons:
        pass_lesson(client, auth, course.id, lesson.id)
    body = client.get("/api/courses", headers=auth).json()["courses"][0]
    assert body["completed"] is True and body["progressPercent"] == 100 and body["nextLessonId"] is None
    assert body["completedAt"] is not None


def test_progress_is_private_and_input_is_validated(client):
    auth = learner(client)
    other = learner(client, "khac@example.com", "Khác")
    course, lesson = COURSES[0], COURSES[0].lessons[0]
    watch_video(client, auth, course.id, lesson.id)
    quiz = new_quiz(client, auth, course.id, lesson.id)

    assert submit(client, auth, course.id, lesson.id, quiz["token"], []).status_code == 400
    assert submit(client, auth, course.id, lesson.id, quiz["token"], [99] * QUIZ_SIZE).status_code == 400
    assert client.get(url("unknown", lesson.id), headers=auth).status_code == 404
    assert client.get(url(course.id, "unknown"), headers=auth).status_code == 404

    pass_lesson(client, auth, course.id, lesson.id)
    assert client.get("/api/courses", headers=other).json()["courses"][0]["progressPercent"] == 0


def test_two_video_courses_credit_the_source(client):
    auth = learner(client)
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
            assert 30 <= video["seconds"] <= 600
    assert all(lesson.sections for course in COURSES for lesson in course.lessons)


def test_finished_course_is_recorded_on_the_profile(client):
    auth = learner(client)
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


def test_new_account_lists_no_courses(client):
    auth = learner(client)
    assert client.get("/api/support/me", headers=auth).json()["completedCourses"] == []


def test_requester_sees_the_accepting_responders_courses(client):
    auth = become_responder(client, user("hai@example.com", "Hải"), user_id("hai@example.com"))
    here = {"latitude": 10.81, "longitude": 106.7, "consentToLocationUse": True, "available": True}
    assert client.put("/api/support/me/availability", headers=auth, json=here).json()["available"] is True
    created = client.post(
        "/api/support-requests",
        json={"latitude": 10.8, "longitude": 106.7, "shareLocationWithAcceptedResponder": True},
    ).json()
    assert client.post(f"/api/support/me/requests/{created['id']}/accept", headers=auth).status_code == 200
    owner = {"Authorization": f"Bearer {created['requesterToken']}"}
    state = client.get(f"/api/support-requests/{created['id']}", headers=owner).json()
    assert [c["badge"] for c in state["responder"]["completedCourses"]] == [c.badge for c in COURSES]
