// ==UserScript==
// @name         Refined GitHub Notifications
// @namespace    https://greasyfork.org/en/scripts/461320-refined-github-notifications
// @version      0.1.3
// @description  Enhances the GitHub Notifications page, making it more productive and less noisy.
// @author       Anthony Fu (https://github.com/antfu)
// @license      MIT
// @homepageURL  https://github.com/antfu/refined-github-notifications
// @supportURL   https://github.com/antfu/refined-github-notifications
// @match        https://github.com/**
// @icon         https://www.google.com/s2/favicons?sz=64&domain=github.com
// @grant        none
// ==/UserScript==

/* eslint-disable no-console */

(function () {
  'use strict'

  // Fix the archive link
  if (location.pathname === '/notifications/beta/archive')
    location.pathname = '/notifications'

  const TIMEOUT = 60_000
  const NAME = 'Refined GitHub Notifications'
  let lastUpdate = Date.now()

  let bc
  let bcInitTime = 0

  function injectStyle() {
    const style = document.createElement('style')
    style.innerHTML = `
/* Hide blue dot on notification icon */
.mail-status.unread {
  display: none !important;
}
    `
    document.head.appendChild(style)
  }

  function initBroadcastChannel() {
    bcInitTime = Date.now()
    bc = new BroadcastChannel('refined-github-notifications')

    bc.onmessage = ({ data }) => {
      console.log(`[${NAME}]`, 'Received message', data)
      if (data.type === 'check-dedupe') {
        // If the new tab is opened after the current tab, close the current tab
        if (data.time > bcInitTime) {
          // TODO: close the tab
          try {
            window.close()
          }
          catch (e) {}
          location.href = 'about:blank'
        }
      }
    }
  }

  function dedupeTab() {
    if (!bc)
      return
    bc.postMessage({ type: 'check-dedupe', time: bcInitTime, url: location.href })
  }

  function externalize() {
    document.querySelectorAll('a')
      .forEach((r) => {
        if (r.href.startsWith('https://github.com/notifications'))
          return
        r.target = '_blank'
        r.rel = 'noopener noreferrer'
        const url = new URL(r.href)

        // Remove notification_referrer_id
        if (url.searchParams.get('notification_referrer_id')) {
          url.searchParams.delete('notification_referrer_id')
          r.href = url.toString()
        }
      })
  }

  function initIdleListener() {
    // Auto refresh page on idle
    document.addEventListener('focus', () => {
      if (Date.now() - lastUpdate > TIMEOUT)
        setTimeout(() => refresh(), 100)
      lastUpdate = Date.now()
    })
  }

  function getIssues() {
    return [...document.querySelectorAll('.notifications-list-item')]
      .map((el) => {
        const url = el.querySelector('a.notification-list-item-link').href
        const status = el.querySelector('.color-fg-open')
          ? 'open'
          : el.querySelector('.color-fg-done')
            ? 'done'
            : el.querySelector('.color-fg-closed')
              ? 'closed'
              : el.querySelector('.color-fg-muted')
                ? 'muted'
                : 'unknown'

        const notificationTypeEl = el.querySelector('.AvatarStack').nextElementSibling
        const notificationType = notificationTypeEl.textContent.trim()

        // Colorize notification type
        if (notificationType === 'mention')
          notificationTypeEl.classList.add('color-fg-open')
        else if (notificationType === 'subscribed')
          notificationTypeEl.classList.add('color-fg-muted')
        else if (notificationType === 'review requested')
          notificationTypeEl.classList.add('color-fg-done')

        const item = {
          title: el.querySelector('.markdown-title').textContent.trim(),
          el,
          url,
          read: el.classList.contains('notification-read'),
          starred: el.classList.contains('notification-starred'),
          type: notificationType,
          status,
          isClosed: ['closed', 'done', 'muted'].includes(status),
          markDone: () => {
            console.log(`[${NAME}]`, 'Mark notifications done', item)
            el.querySelector('button[type=submit] .octicon-check').parentElement.parentElement.click()
          },
        }

        return item
      })
  }

  function getReasonMarkedDone(item) {
    if (item.isClosed && (item.read || item.type === 'subscribed'))
      return 'Closed / merged'

    if (item.title.startsWith('chore(deps): update ') && (item.read || item.type === 'subscribed'))
      return 'Renovate bot'

    if (item.url.match('/pull/[0-9]+/files/'))
      return 'New commit pushed to PR'

    if (item.type === 'ci activity' && /workflow run cancell?ed/.test(item.title))
      return 'GH PR Audit Action workflow run cancelled, probably due to another run taking precedence'
  }

  function isInboxView() {
    const query = new URLSearchParams(window.location.search).get('query')
    if (!query)
      return true

    const conditions = query.split(' ')
    return ['is:done', 'is:saved'].every(condition => !conditions.includes(condition))
  }

  function autoMarkDone() {
    // Only mark on "Inbox" view
    if (!isInboxView())
      return

    const items = getIssues()

    console.log(items)
    let count = 0

    const done = []

    items.forEach((i) => {
      // skip bookmarked notifications
      if (i.starred)
        return

      const reason = getReasonMarkedDone(i)
      if (!reason)
        return

      count++
      i.markDone()
      done.push({
        title: i.title,
        reason,
        link: i.link,
      })
    })

    if (done.length) {
      console.log(`[${NAME}]`, `${count} notifications marked done`)
      console.table(done)
    }

    // Refresh page after marking done (expand the pagination)
    if (count >= 5)
      setTimeout(() => refresh(), 200)
  }

  function removeBotAvatars() {
    document.querySelectorAll('.AvatarStack-body > a')
      .forEach((r) => {
        if (r.href.startsWith('/apps/') || r.href.startsWith('https://github.com/apps/'))
          r.remove()
      })
  }

  /**
   * The "x new notifications" badge
   */
  function hasNewNotifications() {
    return !!document.querySelector('.js-updatable-content a[href="/notifications?query="]')
  }

  // Click the notification tab to do soft refresh
  function refresh() {
    if (!isInNotificationPage())
      return
    document.querySelector('.filter-list a[href="/notifications"]').click()
    lastUpdate = Date.now()
  }

  function isInNotificationPage() {
    return location.href.startsWith('https://github.com/notifications')
  }

  ////////////////////////////////////////

  let initialized = false

  function run() {
    if (isInNotificationPage()) {
      // Run only once
      if (!initialized) {
        initIdleListener()
        initBroadcastChannel()
        initialized = true

        setInterval(() => {
          if (hasNewNotifications())
            refresh()
        }, 2000)
      }

      // Run every render
      dedupeTab()
      externalize()
      removeBotAvatars()
      autoMarkDone()
    }
  }

  injectStyle()
  run()

  // listen to github page loaded event
  document.addEventListener('pjax:end', () => run())
  document.addEventListener('turbo:render', () => run())
})()
