"""First-aid question bank read from the team's spreadsheet ("Dữ liệu.xlsx").

Every lesson quiz is generated from this file (see `quiz.py`). The sheet has one row per problem: a header row names
the columns ("STT", "Domain", "Problem", "Full Answer"), and "Full Answer" is a numbered list ("1. ...", "2. ...")
whose items may carry "- " sub-bullets. The workbook is parsed with the standard library (an .xlsx is a zip of XML
files), cached, and re-read when the file changes, so editing the spreadsheet updates the quizzes without a deploy.
"""

import hashlib
import io
import re
import threading
import zipfile
import zlib
from dataclasses import dataclass
from pathlib import Path
from xml.etree import ElementTree

_NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
_REL_NS = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}"
_PKG_REL_NS = "{http://schemas.openxmlformats.org/package/2006/relationships}"

# Header labels (case and surrounding spaces ignored) of the columns the bank needs.
_COLUMNS = {"stt": "STT", "domain": "Domain", "problem": "Problem", "answer": "Full Answer"}

_NUMBERED = re.compile(r"^\s*(\d{1,2})\s*[.)]\s*(.*)$")
_BULLET = re.compile(r"^\s*[-•+*]\s*(.*)$")
_TOKEN = re.compile(r"\w+", re.UNICODE)


class QuestionBankError(Exception):
    """The spreadsheet is missing or not in the expected shape."""


@dataclass(frozen=True)
class Step:
    """One numbered item of a "Full Answer", with its sub-bullets."""

    text: str
    bullets: tuple[str, ...] = ()

    @property
    def display(self) -> str:
        """The whole step on one line, used as an answer option."""
        if not self.bullets:
            return self.text
        head = self.text.rstrip(" :")
        return f"{head}: {'; '.join(self.bullets)}" if head else "; ".join(self.bullets)

    @property
    def facts(self) -> tuple[str, ...]:
        """Single statements: the step itself, or one per sub-bullet prefixed with the step's heading."""
        if not self.bullets:
            return (self.text,)
        head = self.text.rstrip(" :")
        return tuple(f"{head}: {bullet}" if head else bullet for bullet in self.bullets)


@dataclass(frozen=True)
class Entry:
    stt: int
    domain: str
    problem: str
    steps: tuple[Step, ...]

    @property
    def facts(self) -> tuple[str, ...]:
        return tuple(fact for step in self.steps for fact in step.facts)


@dataclass(frozen=True, eq=False)  # compared and hashed by identity: one instance per version of the file
class QuestionBank:
    version: str  # short digest of the file, so quiz tokens from an older bank are rejected
    entries: tuple[Entry, ...]

    def by_stt(self, stts: tuple[int, ...]) -> list[Entry]:
        wanted = set(stts)
        return [entry for entry in self.entries if entry.stt in wanted]


def clean(text: str) -> str:
    """Collapse whitespace and drop trailing punctuation so options do not differ in style."""
    return re.sub(r"\s+", " ", text).strip().rstrip(" .;,")


def tokens(text: str) -> frozenset[str]:
    return frozenset(_TOKEN.findall(text.lower()))


def similar(a: frozenset[str], b: frozenset[str], threshold: float = 0.5) -> bool:
    """Jaccard similarity of two token sets (without building the union set: this runs in hot loops)."""
    if not a or not b:
        return False
    common = len(a & b)
    return common / (len(a) + len(b) - common) >= threshold


def parse_steps(answer: str) -> tuple[Step, ...]:
    """Split a numbered "Full Answer" into steps; "- " lines become sub-bullets of the step above them."""
    steps: list[tuple[str, list[str]]] = []
    for raw in answer.replace("\r", "").split("\n"):
        if not raw.strip():
            continue
        if numbered := _NUMBERED.match(raw):
            steps.append((numbered.group(2), []))
        elif bullet := _BULLET.match(raw):
            if not steps:
                steps.append(("", []))
            steps[-1][1].append(bullet.group(1))
        elif steps and not steps[-1][1]:
            steps[-1] = (f"{steps[-1][0]} {raw}", [])  # wrapped line of the step text
        elif steps:
            steps[-1][1][-1] = f"{steps[-1][1][-1]} {raw}"  # wrapped line of the last bullet
        else:
            steps.append((raw, []))
    result = []
    for text, bullets in steps:
        step = Step(clean(text), tuple(b for b in (clean(b) for b in bullets) if b))
        if step.text or step.bullets:
            result.append(step)
    return tuple(result)


def _column(ref: str) -> str:
    return "".join(ch for ch in ref if ch.isalpha())


def _text(node: ElementTree.Element) -> str:
    # Rich text runs (<r><t>) and plain <t>; phonetic hints (<rPh>) are not part of the value.
    parts = []
    for child in node:
        if child.tag == f"{_NS}t":
            parts.append(child.text or "")
        elif child.tag == f"{_NS}r":
            parts.extend(t.text or "" for t in child.iter(f"{_NS}t"))
    return "".join(parts)


def _first_sheet(archive: zipfile.ZipFile) -> str:
    workbook = ElementTree.fromstring(archive.read("xl/workbook.xml"))
    sheet = workbook.find(f"{_NS}sheets/{_NS}sheet")
    if sheet is None:
        raise QuestionBankError("The workbook has no sheet.")
    rel_id = sheet.get(f"{_REL_NS}id")
    rels = ElementTree.fromstring(archive.read("xl/_rels/workbook.xml.rels"))
    for rel in rels.iter(f"{_PKG_REL_NS}Relationship"):
        if rel.get("Id") == rel_id:
            target = rel.get("Target", "").lstrip("/")
            return target if target.startswith("xl/") else f"xl/{target}"
    raise QuestionBankError("The first sheet could not be located.")


def _rows(data: bytes) -> list[dict[str, str]]:
    with zipfile.ZipFile(io.BytesIO(data)) as archive:
        names = set(archive.namelist())
        shared: list[str] = []
        if "xl/sharedStrings.xml" in names:
            root = ElementTree.fromstring(archive.read("xl/sharedStrings.xml"))
            shared = [_text(si) for si in root.iter(f"{_NS}si")]
        sheet = ElementTree.fromstring(archive.read(_first_sheet(archive)))
    rows = []
    for row in sheet.iter(f"{_NS}row"):
        values: dict[str, str] = {}
        for cell in row.iter(f"{_NS}c"):
            kind = cell.get("t")
            if kind == "inlineStr":
                inline = cell.find(f"{_NS}is")
                value = _text(inline) if inline is not None else ""
            else:
                v = cell.find(f"{_NS}v")
                if v is None or v.text is None:
                    continue
                value = shared[int(v.text)] if kind == "s" else v.text
            if value.strip():
                values[_column(cell.get("r", ""))] = value
        rows.append(values)
    return rows


def parse_workbook(data: bytes) -> QuestionBank:
    try:
        rows = _rows(data)
    # Anything a corrupt or foreign file can raise while unzipping or reading cells (e.g. a bad shared-string index).
    except (zipfile.BadZipFile, zlib.error, KeyError, IndexError, ValueError, ElementTree.ParseError) as exc:
        raise QuestionBankError(f"Not a readable .xlsx file: {exc}") from exc

    columns: dict[str, str] = {}
    header_index = -1
    for index, row in enumerate(rows):
        labels = {value.strip().lower(): col for col, value in row.items()}
        if all(label.lower() in labels for label in _COLUMNS.values()):
            columns = {key: labels[label.lower()] for key, label in _COLUMNS.items()}
            header_index = index
            break
    if not columns:
        raise QuestionBankError(f"Header row with columns {', '.join(_COLUMNS.values())} not found.")

    entries: list[Entry] = []
    seen: set[int] = set()
    for row in rows[header_index + 1 :]:
        try:
            stt = int(float(row.get(columns["stt"], "")))
        except ValueError:
            continue
        problem = clean(row.get(columns["problem"], ""))
        steps = parse_steps(row.get(columns["answer"], ""))
        if not problem or not steps or stt in seen:
            continue
        seen.add(stt)
        entries.append(Entry(stt=stt, domain=clean(row.get(columns["domain"], "")), problem=problem, steps=steps))
    if not entries:
        raise QuestionBankError("The spreadsheet has no problems with answers.")
    return QuestionBank(version=hashlib.sha256(data).hexdigest()[:16], entries=tuple(entries))


_lock = threading.Lock()
_cache: dict[str, tuple[tuple[int, int], QuestionBank]] = {}


def load_bank(path: str | Path) -> QuestionBank:
    """The parsed bank, re-read only when the file's size or modification time changes."""
    file = Path(path)
    try:
        stat = file.stat()
    except OSError as exc:
        raise QuestionBankError(f"Question bank file not found: {file}") from exc
    key, stamp = str(file.resolve()), (stat.st_mtime_ns, stat.st_size)
    with _lock:
        cached = _cache.get(key)
        if cached is not None and cached[0] == stamp:
            return cached[1]
        try:
            data = file.read_bytes()
        except OSError as exc:  # e.g. a directory or no read permission
            raise QuestionBankError(f"Question bank file not readable: {file}") from exc
        bank = parse_workbook(data)
        _cache[key] = (stamp, bank)
        return bank
