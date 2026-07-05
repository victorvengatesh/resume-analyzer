# ADR-001: Centralized Configuration System

- Status: Accepted
- Date: 2026-07-04

## Context
The backend currently relies on scattered configuration values such as database URLs, upload directories, file size limits, OCR toggles, and frontend origins that are defined inline or read ad hoc from environment variables. This makes the application harder to reason about, test, and deploy consistently across local development, CI, and production environments.

## Problem Statement
The project needs a single, explicit source of truth for runtime configuration so that:
- configuration is easy to discover and update,
- environment-specific behavior is consistent,
- tests can safely override values,
- deployment settings can be managed without editing code.

## Options Considered
1. Keep inline defaults and direct os.getenv calls throughout the codebase.
2. Introduce a small centralized settings module that loads environment variables once and exposes typed configuration.
3. Adopt a full-featured configuration framework such as Pydantic Settings with nested environments and validation.

## Selected Solution
Implement a lightweight centralized configuration module in the backend using a typed settings object loaded from environment variables. The module will expose a single settings accessor and a helper for ensuring the upload directory exists.

## Reasons for Selection
- It addresses the immediate architectural gap without introducing unnecessary framework complexity.
- It keeps the current FastAPI and SQLAlchemy setup intact.
- It improves testability by allowing configuration overrides in a predictable way.
- It is simple to extend as the platform grows.

## Trade-offs
- The solution is intentionally lightweight rather than fully feature-rich.
- It does not yet introduce advanced validation, secret management, or hierarchical environment schemas.

## Consequences
Positive:
- Configuration becomes easier to discover and maintain.
- Environment overrides are applied consistently.
- Backend initialization and file handling can use the same configuration object.

Negative:
- Existing modules must be updated to consume the centralized settings rather than define their own values.
- Future expansion may require migrating to a more formal settings library if the configuration surface grows.

## Future Considerations
- Consider adopting a richer settings framework if the application grows into a multi-service platform.
- Add validation for required secrets and environment-specific rules.
- Extend configuration coverage for logging, AI service settings, and storage providers.
