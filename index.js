// ==UserScript==
// @name         Refined GitHub Notifications
// @namespace    https://greasyfork.org/en/scripts/461320-refined-github-notifications
// @version      0.2.4
// @description  Enhances the GitHub Notifications page, making it more productive and less noisy.
// @author       Anthony Fu (https://github.com/antfu)
// @license      MIT
// @homepageURL  https://github.com/antfu/refined-github-notifications
// @supportURL   https://github.com/antfu/refined-github-notifications
// @match        https://github.com/**
// @icon         https://www.google.com/s2/favicons?sz=64&domain=github.com
// @grant        window.close
// ==/UserScript==

/* eslint-disable no-console */

(function () {
  'use strict'

  // Fix the archive link
  if (location.pathname === '/notifications/beta/archive')
    location.pathname = '/notifications'

  const NAME = 'Refined GitHub Notifications'

  let bc
  let bcInitTime = 0

  function injectStyle() {
    const style = document.createElement('style')
    style.innerHTML = `
/* Hide blue dot on notification icon */
.mail-status.unread {
  display: none !important;
}
.js-notification-shelf {
  display: none !important;
}
.btn-hover-primary {
  transform: scale(1.2);
  transition: all .3s ease-in-out;
}
.btn-hover-primary:hover {
  color: var(--color-btn-primary-text);
  background-color: var(--color-btn-primary-bg);
  border-color: var(--color-btn-primary-border);
  box-shadow: var(--color-btn-primary-shadow),var(--color-btn-primary-inset-shadow);
}
    `
    document.head.appendChild(style)
  }

  /**
   * To have a FAB button to close current issue,
   * where you can mark done and then close the tab automatically
   */
  function notificationShelf() {
    function inject() {
      const shelf = document.querySelector('.js-notification-shelf')
      if (!shelf)
        return false

      const containers = document.createElement('div')
      Object.assign(containers.style, {
        position: 'fixed',
        right: '25px',
        bottom: '25px',
        zIndex: 999,
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
      })
      document.body.appendChild(containers)

      const doneButton = shelf.querySelector('button[title="Done"]')
      // const unsubscribeButton = shelf.querySelector('button[title="Unsubscribe"]')

      const buttons = [
        // unsubscribeButton,
        doneButton,
      ].filter(Boolean)

      for (const button of buttons) {
        const clickAndClose = async () => {
          button.click()
          // wait for the notification shelf to be updated
          await new Promise((resolve) => {
            new MutationObserver(() => {
              resolve()
            })
              .observe(
                shelf,
                {
                  childList: true,
                  attributes: true,
                  subtree: true,
                  attributeFilter: ['data-redirect-to-inbox-on-submit'],
                },
              )
          })
          // close the tab
          window.close()
        }

        const fab = button.cloneNode(true)
        fab.classList.remove('btn-sm')
        fab.classList.add('btn-hover-primary')
        fab.style.aspectRatio = '1/1'
        fab.style.borderRadius = '100%'
        fab.addEventListener('click', clickAndClose)
        containers.appendChild(fab)

        if (button === doneButton) {
          document.addEventListener('keydown', (e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'x') {
              e.preventDefault()
              clickAndClose()
            }
          })
        }
      }

      return true
    }

    // when first into the page, the notification shelf might not be loaded, we need to wait for it to show
    if (!inject()) {
      const observer = new MutationObserver((mutationList) => {
        const found = mutationList.some(i => i.type === 'childList' && Array.from(i.addedNodes).some(el => el.classList.contains('js-notification-shelf')))
        if (found) {
          inject()
          observer.disconnect()
        }
      })
      observer.observe(document.querySelector('[data-turbo-body]'), { childList: true })
    }
  }

  function initBroadcastChannel() {
    bcInitTime = Date.now()
    bc = new BroadcastChannel('refined-github-notifications')

    bc.onmessage = ({ data }) => {
      console.log(`[${NAME}]`, 'Received message', data)
      if (data.type === 'check-dedupe') {
        // If the new tab is opened after the current tab, close the current tab
        if (data.time > bcInitTime) {
          window.close()
          location.href = 'https://close-me.netlify.app'
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
      })
  }

  function initIdleListener() {
    // Auto refresh page on going back to the page
    document.addEventListener('visibilitychange', (e) => {
      if (document.visibilityState === 'visible')
        refresh()
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

    console.log(`[${NAME}] ${items}`)
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
  }

  function isInNotificationPage() {
    return location.href.startsWith('https://github.com/notifications')
  }

  function observeForNewNotifications() {
    try {
      const observer = new MutationObserver(() => {
        if (hasNewNotifications())
          refresh()
      })
      observer.observe(document.querySelector('.js-check-all-container').children[0], {
        childList: true,
        subtree: true,
      })
    }
    catch (e) {
    }
  }

  ////////////////////////////////////////

  let initialized = false

  function run() {
    if (isInNotificationPage()) {
      // Run only once
      if (!initialized) {
        initIdleListener()
        initBroadcastChannel()
        observeForNewNotifications()
        initialized = true
      }

      // Run every render
      dedupeTab()
      externalize()
      removeBotAvatars()
      autoMarkDone()
    }
    else {
      notificationShelf()
    }
  }

  injectStyle()
  run()

  // listen to github page loaded event
  document.addEventListener('pjax:end', () => run())
  document.addEventListener('turbo:render', () => run())
})()
