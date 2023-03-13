// ==UserScript==
// @name         Refined GitHub Notifications
// @namespace    https://greasyfork.org/en/scripts/461320-refined-github-notifications
// @version      0.1.1
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
    if (item.isClosed && (item.read || item.type === 'subscribed')) {
        return 'closed/merged notifications, either read or not been mentioned'
    }

    if (item.title.startsWith('chore(deps): update ') && (item.read || item.type === 'subscribed')) {
        return 'Renovate Bot'
    }

    if (item.url.match('/pull/[0-9]+/files/')) {
        return 'New commit pushed to PR'
    }
  }

  function autoMarkDone() {
    const items = getIssues()

    console.log(items)
    let count = 0

    items.forEach((i) => {
      // skip bookmarked notifications
      if (i.starred)
        return

      const reason = getReasonMarkedDone(i)
      if (!reason) return

      count++
      i.markDone()
      console.log(`marking notification done:
notification: ${i.title}
reason: ${reason}`)
    })

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

  // Click the notification tab to do soft refresh
  function refresh() {
    document.querySelector('.filter-list a[href="/notifications"]').click()
    lastUpdate = Date.now()
  }

  ////////////////////////////////////////

  let initialized = false

  function run() {
    if (location.href.startsWith('https://github.com/notifications')) {
      // Run only once
      if (!initialized) {
        initIdleListener()
        initBroadcastChannel()
        initialized = true
      }

      // Run every render
      dedupeTab()
      externalize()
      removeBotAvatars()
      autoMarkDone()
    }
  }

  run()

  // listen to github page loaded event
  document.addEventListener('pjax:end', () => run())
  document.addEventListener('turbo:render', () => run())
})()
