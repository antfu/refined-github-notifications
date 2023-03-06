# Refined GitHub Notifications

A browser UserScript that enhances the GitHub Notifications page.

## Features

> **Note**: It's opinionated to my own workflow.

- Add `target="_blank"` to all notifications (and remove `notification_referrer_id`)
- Refresh the page when going back to the tab after 1 min idle, so you got the latest notifications
- Remove bot avatars
- Colorize the notification type (mention, review request, etc.)
- Auto mark notifications as done (remove it from the list), if:
  - The issue/PR is closed/merged, you are not participating at all
  - The issue/PR is closed/merged, and you already read it
  - PRs created by Renovate, if not participating
  - New commits pushed to PRs
  - *Notifications you have bookmarked will be bypassed
- Make sure only one notification tab is opened

## Philosophy

- Reduce the amount of notifications as much as possible
- Don't track on issues/PRs that are closed
- The notifications should always be up to date

## Sponsors

<p align="center">
  <a href="https://cdn.jsdelivr.net/gh/antfu/static/sponsors.svg">
    <img src='https://cdn.jsdelivr.net/gh/antfu/static/sponsors.svg'/>
  </a>
</p>

## License

[MIT](./LICENSE) License © 2022 [Anthony Fu](https://github.com/antfu)
