# Claude Working Guidelines

## 1. Plan Node Default

- Enter plan mode for ANY non-trivial task (3+ steps or architectural decisions)
- If something goes sideways, STOP and re-plan immediately – don't keep pushing
- Use plan mode for verification steps, not just building
- Write detailed specs upfront to reduce ambiguity

## 2. Subagent Strategy

- Use subagents liberally to keep main context window clean
- Offload research, exploration, and parallel analysis to subagents
- For complex problems, throw more compute at it via subagents
- One task per subagent for focused execution

## 3. Self-Improvement Loop

- After ANY correction from the user: update tasks/lessons.md with the pattern
- Write rules for yourself that prevent the same mistake
- Ruthlessly iterate on these lessons until mistake rate drops
- Review lessons at session start for relevant project

## 4. Verification Before Done

- Never mark a task complete without proving it works
- Diff behavior between main and your changes when relevant
- Ask yourself: "Would a staff engineer approve this?"
- Run tests, check logs, demonstrate correctness

## 5. Demand Elegance (Balanced)

- For non-trivial changes: pause and ask "is there a more elegant way?"
- If a fix feels hacky: "Knowing everything I know now, implement the elegant solution"
- Skip this for simple, obvious fixes – don't over-engineer
- Challenge your own work before presenting it

## 6. Autonomous Bug Fixing

- When given a bug report: just fix it. Don't ask for hand-holding
- Point at logs, errors, failing tests – then resolve them
- Zero context switching required from the user
- Go fix failing CI tests without being told how

## 7. Test-Driven Development (TDD)

- **Red-Green-Refactor**: For any non-trivial implementation, follow the TDD cycle:
  1. Write a test that fails (RED)
  2. Verify the test actually fails with the right error
  3. Write minimal code to make it pass (GREEN)
  4. Verify the test passes
  5. Refactor if needed while keeping tests green
- **Test Integrity**: Never compromise test quality to make them pass
  - Don't use fake/mock data just to satisfy assertions
  - Don't modify test expectations to match incorrect behavior
  - Don't overfit tests to implementation details
- **When Stuck**: If tests consistently fail after honest attempts:
  - STOP and ask for help
  - Don't keep breaking things trying different approaches
  - Explain what you tried and why it's not working
- **Test Quality**: Write tests that verify actual behavior, not implementation details
  - Focus on inputs/outputs and observable behavior
  - Avoid brittle tests that break with every refactor
  - Tests should document the expected behavior clearly

## Task Management

- **Plan First**: Write plan to tasks/todo.md with checkable items
- **Verify Plan**: Check in before starting implementation
- **Track Progress**: Mark items complete as you go
- **Explain Changes**: High-level summary at each step
- **Document Results**: Add review section to tasks/todo.md
- **Capture Lessons**: Update tasks/lessons.md after corrections

## Core Principles

- **Simplicity First**: Make every change as simple as possible. Impact minimal code.
- **No Laziness**: Find root causes. No temporary fixes. Senior developer standards.
