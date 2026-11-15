"""Lesson quizzes generated from the spreadsheet question bank.

Each attempt draws a random seed; the questions are a pure function of (bank, lesson topics, seed), so the server can
grade an attempt by regenerating it from the seed carried in a signed token instead of storing the attempt. Different
seeds pick different problems, statements and steps and shuffle the options, so every attempt is a different set.

Question kinds, all built from a lesson's own rows of the sheet (`Lesson.bank_topics`):
- "fact":  which statement belongs to <problem>? Wrong options are statements from rows of other domains that share
           no two-syllable term ("ngừng thở", "mồ hôi"...) with the lesson's rows and are not generic advice shared
           by many rows (e.g. "call for help"), so a wrong option is never also true for the problem asked about.
- "first": which step of the <problem> procedure comes first? Wrong options are later steps of the same procedure.
- "next":  which step comes right after <step>? Wrong options are other steps of the same procedure.
"""

import random
import re
from dataclasses import dataclass
from functools import lru_cache

from app.modules.courses.question_bank import Entry, QuestionBank, similar, tokens

QUIZ_SIZE = 5
OPTIONS = 4  # at most; ordering questions on short procedures may have 3

# Problems whose "Full Answer" is an ordered procedure (the others are lists of signs, causes, types...).
_PROCEDURE = re.compile(r"^(các bước|cách|phương pháp|quy trình|sơ cấp cứu|xử trí)", re.IGNORECASE)
_GENERIC_ROWS = 3  # a statement similar to statements of this many rows is generic advice
_MAX_WRONG_LENGTH = 160  # longer wrong options would stand out next to the usual one-line statements
# Two-syllable terms too common in first-aid text to tell topics apart.
_COMMON_TERMS = frozenset(
    {"nạn nhân", "người sơ", "sơ cấp", "cấp cứu", "sơ cứu", "cơ sở", "sở y", "y tế", "người bệnh", "có thể", "nếu có"}
)


@dataclass(frozen=True)
class GeneratedQuestion:
    id: str
    question: str
    options: tuple[str, ...]
    answer: int
    explanation: str


def _topic(problem: str) -> str:
    return problem.rstrip(" .:")


def _terms(text: str) -> frozenset[str]:
    """Adjacent syllable pairs: Vietnamese words are mostly one or two syllables."""
    words = re.findall(r"\w+", text.lower())
    return frozenset(f"{a} {b}" for a, b in zip(words, words[1:], strict=False)) - _COMMON_TERMS


def _is_procedure(entry: Entry) -> bool:
    displays = [step.display for step in entry.steps]
    return bool(_PROCEDURE.match(entry.problem)) and len(entry.steps) >= 3 and len(set(displays)) == len(displays)


@lru_cache(maxsize=8)
def _fact_index(bank: QuestionBank) -> tuple[tuple[Entry, str, frozenset[str], frozenset[str]], ...]:
    """(entry, statement, word tokens, two-syllable terms) of every statement in the bank, computed once per bank."""
    return tuple((entry, fact, tokens(fact), _terms(fact)) for entry in bank.entries for fact in entry.facts)


@lru_cache(maxsize=4096)
def _is_generic(bank: QuestionBank, fact: str) -> bool:
    # O(statements in the bank) on first use of a statement, then cached per bank.
    words = tokens(fact)
    rows = {entry.stt for entry, _, other, _ in _fact_index(bank) if similar(words, other)}
    return len(rows) >= _GENERIC_ROWS


def _pick_options(rng: random.Random, correct: str, wrong: list[str]) -> tuple[tuple[str, ...], int] | None:
    seen = {correct.lower()}
    chosen: list[str] = []
    for option in wrong:
        if option.lower() not in seen:
            seen.add(option.lower())
            chosen.append(option)
        if len(chosen) == OPTIONS - 1:
            break
    if len(chosen) < 2:
        return None
    options = [correct, *chosen]
    rng.shuffle(options)
    return tuple(options), options.index(correct)


def _fact_question(
    rng: random.Random, bank: QuestionBank, topics: list[Entry], entry: Entry, fact: str, qid: str
) -> GeneratedQuestion | None:
    domains = {topic.domain for topic in topics}
    lesson_words = [tokens(f) for topic in topics for f in topic.facts]
    lesson_terms = frozenset().union(*(_terms(f) for topic in topics for f in topic.facts))
    pool = [item for item in _fact_index(bank) if item[0].domain not in domains]
    rng.shuffle(pool)
    wrong: list[str] = []
    for _, statement, words, terms in pool:
        if len(wrong) == OPTIONS - 1:
            break
        if len(statement) > max(_MAX_WRONG_LENGTH, 2 * len(fact)) or terms & lesson_terms:
            continue
        if any(similar(words, mine, 0.35) for mine in lesson_words) or any(similar(words, tokens(w)) for w in wrong):
            continue
        if _is_generic(bank, statement):  # the costly check last
            continue
        wrong.append(statement)
    picked = _pick_options(rng, fact, wrong)
    if picked is None:
        return None
    options, answer = picked
    return GeneratedQuestion(
        id=qid,
        question=f"Theo tài liệu sơ cứu, ý nào thuộc nội dung “{_topic(entry.problem)}”?",
        options=options,
        answer=answer,
        explanation=f"“{fact}” là một ý của “{_topic(entry.problem)}”. Các phương án còn lại thuộc chủ đề khác.",
    )


def _first_question(rng: random.Random, entry: Entry, qid: str) -> GeneratedQuestion | None:
    steps = [step.display for step in entry.steps]
    later = steps[1:]
    rng.shuffle(later)
    picked = _pick_options(rng, steps[0], later)
    if picked is None:
        return None
    options, answer = picked
    return GeneratedQuestion(
        id=qid,
        question=f"“{_topic(entry.problem)}”: việc nào được thực hiện đầu tiên?",
        options=options,
        answer=answer,
        explanation=f"Bước 1 của “{_topic(entry.problem)}” là: {steps[0]}.",
    )


def _next_question(rng: random.Random, entry: Entry, index: int, qid: str) -> GeneratedQuestion | None:
    steps = [step.display for step in entry.steps]
    others = [step for i, step in enumerate(steps) if i not in (index, index + 1)]
    rng.shuffle(others)
    picked = _pick_options(rng, steps[index + 1], others)
    if picked is None:
        return None
    options, answer = picked
    return GeneratedQuestion(
        id=qid,
        question=f"“{_topic(entry.problem)}”: ngay sau bước “{steps[index]}”, bước tiếp theo là gì?",
        options=options,
        answer=answer,
        explanation=f"Bước {index + 2} của “{_topic(entry.problem)}” là: {steps[index + 1]}.",
    )


def generate_quiz(bank: QuestionBank, lesson_id: str, topics: tuple[int, ...], seed: int) -> list[GeneratedQuestion]:
    """A deterministic quiz for this seed: up to QUIZ_SIZE questions from the lesson's rows of the bank."""
    rng = random.Random(seed)
    entries = bank.by_stt(topics)

    # (kind, entry, position): every question this lesson could ask
    candidates: list[tuple[str, Entry, int]] = []
    for entry in entries:
        candidates.extend(("fact", entry, i) for i in range(len(entry.facts)))
        if _is_procedure(entry):
            candidates.append(("first", entry, 0))
            if len(entry.steps) >= 4:
                candidates.extend(("next", entry, i) for i in range(len(entry.steps) - 1))
    rng.shuffle(candidates)
    # Mix kinds: ordering questions first get a fair share instead of being drowned by the many statements.
    candidates.sort(key=lambda c: rng.random() * (0.6 if c[0] != "fact" else 1.0))

    questions: list[GeneratedQuestion] = []
    used: set[tuple[str, int, int]] = set()
    per_entry: dict[int, int] = {}
    limit = max(1, -(-QUIZ_SIZE // max(1, len(entries))))  # spread questions over the lesson's rows
    for relax in (False, True):
        for kind, entry, position in candidates:
            if len(questions) == QUIZ_SIZE:
                break
            if (kind, entry.stt, position) in used or (not relax and per_entry.get(entry.stt, 0) >= limit):
                continue
            qid = f"{lesson_id}-{entry.stt}-{kind}{position}"
            if kind == "fact":
                question = _fact_question(rng, bank, entries, entry, entry.facts[position], qid)
            elif kind == "first":
                question = _first_question(rng, entry, qid)
            else:
                question = _next_question(rng, entry, position, qid)
            used.add((kind, entry.stt, position))
            if question is None:
                continue
            questions.append(question)
            per_entry[entry.stt] = per_entry.get(entry.stt, 0) + 1
    return questions
