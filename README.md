# Userscript: Refined GitHub Notifications

Enhances the GitHub Notifications page, making it more productive and less noisy.

[Install on Greasyfork](https://greasyfork.org/en/scripts/461320-refined-github-notifications)

## Introduction

Check [Anthony's Talk](https://youtu.be/gu-0b6KCf80) or the [Transcripts](https://antfu.me/posts/manage-github-notifcations-2023) to learn more about the philosophy and motivations behind this userscript.

## Features

> **Note**: It's pretty opinionated. I'd encourage you to fork and customize it to your own needs.

- Add `target="_blank"` to all notifications (and remove `notification_referrer_id`)
- Refresh the page when going back to the tab, so you get the latest notifications
- Remove bot avatars
- Colorize the notification type (mention, review request, etc.)
- Auto mark notifications as done (remove it from the list), if:
  - The issue/PR is closed/merged, and you have not participated at all
  - The issue/PR is closed/merged, and you already read it
  - PRs created by Renovate, if not participating
  - New commits pushed to PRs
  - *Notifications you have bookmarked will be bypassed
- Make sure only one notification tab is opened
- When going to the issue from the notification, inject a floating button to mark it as done and close the tab.
- `Alt/Option + X` to mark a notification as done and close it
- Preview issue body when hovering over the title

## GitHub Token

When using "Detail Preview" feature, GitHub token would be better to provide to avoid rate limit. You can set the token by running the following command in the console of any page on GitHub:

```ts
localStorage.setItem('github_token', 'your token')
```

## Sponsors

<p align="center">
  <a href="https://cdn.jsdelivr.net/gh/antfu/static/sponsors.svg">
    <img src='https://cdn.jsdelivr.net/gh/antfu/static/sponsors.svg'/>
  </a>
</p>

## License

[MIT](./LICENSE) License © 2023 [Anthony Fu](https://github.com/antfu)
