# Lessons

Patterns learned from mistakes. Update this file after any correction from the user. Review at session start.

---

### 1. Scaffold bare-bones first
When asked to scaffold, produce the absolute minimum: types, empty stubs, directory structure. No business logic, no tests, no wiring. Add those incrementally when explicitly asked. Don't front-load implementation under the guise of "scaffolding."

### 2. Phase scope means phase scope
If something is deferred to a later phase, don't include it in the scaffold. No stub files, no CLI commands, no imports for features that belong to a future phase. Keep the codebase honest about what's in scope.

### 3. Update LESSONS.md immediately on correction
When the user corrects you, update this file in the same response as the fix. Don't wait to be asked. The correction is the trigger — not a follow-up reminder.
