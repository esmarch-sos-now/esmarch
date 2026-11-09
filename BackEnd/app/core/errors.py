"""Problem Details responses. Never echo rejected input (it may contain coordinates or transcripts)."""

from http import HTTPStatus

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException


def problem(status: int, detail: str, headers: dict[str, str] | None = None) -> JSONResponse:
    phrase = HTTPStatus(status).phrase
    return JSONResponse(
        {"type": "about:blank", "title": phrase, "status": status, "detail": detail},
        status_code=status,
        media_type="application/problem+json",
        headers=headers,
    )


def error(status: int, detail: str) -> HTTPException:
    return HTTPException(status_code=status, detail=detail)


def require(condition: bool, detail: str) -> None:
    if not condition:
        raise error(400, detail)


def install(app: FastAPI) -> None:
    @app.exception_handler(RequestValidationError)
    async def _validation(_: Request, __: RequestValidationError) -> JSONResponse:
        return problem(400, "Missing or invalid request fields.")

    @app.exception_handler(StarletteHTTPException)
    async def _http(_: Request, exc: StarletteHTTPException) -> JSONResponse:
        detail = exc.detail if isinstance(exc.detail, str) else HTTPStatus(exc.status_code).phrase
        return problem(exc.status_code, detail, getattr(exc, "headers", None))
