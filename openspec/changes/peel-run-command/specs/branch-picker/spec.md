# branch-picker Specification

## Purpose

Resolve the target branch for a `peel run` invocation, either from a non-interactive input (positional or `--branch` flag) or via a prompt over a list returned by `listBranches`.

## Requirements

### Requirement: Prefer Explicit Input

The system MUST return the explicit branch name when supplied, validating that the name appears in the provided list. If the name is missing from the list, it MUST throw `BranchNotFoundError` carrying the closest matches by Levenshtein distance.

#### Scenario: Explicit branch is returned when valid
- GIVEN `branches=[{name:"main"},{name:"feature/x"}]` and `explicit="feature/x"`
- WHEN `pickBranch({ prompter, branches, explicit })` runs
- THEN it returns `"feature/x"` AND prompter is NOT called

#### Scenario: Unknown branch surfaces did-you-mean
- GIVEN `branches=[{name:"feature/x"},{name:"feature/y"}]` and `explicit="feature/z"`
- WHEN `pickBranch(...)` runs
- THEN it throws `BranchNotFoundError` with `suggestions` containing `"feature/x"` AND `"feature/y"`

### Requirement: Interactive Selection

When no explicit branch is provided, the system MUST prompt the user via `Prompter.select` with the list. The user's selection MUST be returned. A cancel response MUST resolve to `null`.

#### Scenario: Returns the picked branch
- GIVEN no explicit input and prompter scripted to pick `"main"`
- WHEN `pickBranch(...)` runs
- THEN it returns `"main"`

#### Scenario: Cancel returns null
- GIVEN no explicit input and prompter scripted to cancel
- WHEN `pickBranch(...)` runs
- THEN it returns `null`
