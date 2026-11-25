# GitHub issue tracker

Use `gh` to read and publish issues and specs in `montrellcruse/quorum-sql`. Pass `--repo montrellcruse/quorum-sql` to `gh issue` and `gh pr` commands to select the target explicitly.

## Issue operations

- Create an issue with `gh issue create --title "..." --body-file <path>`. Use the issue URL returned by `gh` when sharing the result.
- Fetch a ticket with `gh issue view <number> --json number,title,body,labels,comments`.
- List issues with `gh issue list --json number,title,body,labels,comments`. Use `--state`, `--label`, and `--limit` to cover the relevant set.
- Comment with `gh issue comment <number> --body-file <path>`. Apply or remove labels with `gh issue edit <number> --add-label "<label>"` or `--remove-label "<label>"`.
- Record the reason for closing in a comment, then run `gh issue close <number>`.

## Sub-issues and blockers

Use GitHub's native relationships. Replace each angle-bracket placeholder with its value before running a command.

- Get an issue's numeric database ID with `gh api repos/montrellcruse/quorum-sql/issues/<number> --jq .id`.
- Link a child with `gh api --method POST repos/montrellcruse/quorum-sql/issues/<parent>/sub_issues -F sub_issue_id=<child-db-id>`. If sub-issues are unavailable, add `Part of #<parent>` to the child body.
- Link a blocker with `gh api --method POST repos/montrellcruse/quorum-sql/issues/<child>/dependencies/blocked_by -F issue_id=<blocker-db-id>`. If dependencies are unavailable, add `Blocked by: #<n>, #<n>` to the child body.
- List blockers with `gh api --paginate repos/montrellcruse/quorum-sql/issues/<number>/dependencies/blocked_by --jq '.[] | select(.state == "open") | .number'`. A ticket is unblocked when all its blockers are closed, including any listed in its body.

## Pull requests as a triage surface

**PRs as a request surface: no.**

When enabled, use `gh pr view`, `gh pr diff`, `gh pr comment`, `gh pr edit`, and `gh pr close` for external pull requests. Apply the same triage roles as for issues.

## Wayfinding operations

- Create the map as one issue labelled `wayfinder:map`. Link its child tickets as sub-issues, or record them in a task list if sub-issues are unavailable. Apply the relevant `wayfinder:<type>` label (`research`, `prototype`, `grilling`, or `task`) to each child.
- List the map's children with `gh api --paginate repos/montrellcruse/quorum-sql/issues/<map>/sub_issues`, or read the map's task list. In map order, select the first open child with no assignee and no open blockers.
- Claim the ticket with `gh issue edit <number> --add-assignee @me`. To resolve it, post the answer, close the issue, and add a short decision summary and issue link to the map's Decisions-so-far.
