To create a pull request from the current branch:

1. List current branch changes (git log main..HEAD --stat)
2. Extract most important changes if needed
3. Generate a PR title and Summary
4. Run `gh pr create --title "..." --body "..."`
   1. Ensure that you are in a branch different from main and it is pushed
   2. The PR Body should follow the template: @templates/pr.md