import time
import uuid
import logging
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

logger = logging.getLogger("resume_analyzer.middleware")

class RequestTimingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        request_id = str(uuid.uuid4())
        start_time = time.time()
        
        try:
            response = await call_next(request)
            process_time = time.time() - start_time
            logger.info(f"Request completed", extra={
                "request_id": request_id,
                "method": request.method,
                "url": str(request.url.path),
                "status_code": response.status_code,
                "process_time_ms": round(process_time * 1000, 2)
            })
            response.headers["X-Process-Time"] = str(process_time)
            response.headers["X-Request-ID"] = request_id
            return response
        except Exception as e:
            process_time = time.time() - start_time
            logger.error(f"Request failed", exc_info=True, extra={
                "request_id": request_id,
                "method": request.method,
                "url": str(request.url.path),
                "process_time_ms": round(process_time * 1000, 2)
            })
            raise
