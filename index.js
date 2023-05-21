// ==UserScript==
// @name         Refined GitHub Notifications
// @namespace    https://greasyfork.org/en/scripts/461320-refined-github-notifications
// @version      0.5.0
// @description  Enhances the GitHub Notifications page, making it more productive and less noisy.
// @author       Anthony Fu (https://github.com/antfu)
// @license      MIT
// @homepageURL  https://github.com/antfu/refined-github-notifications
// @supportURL   https://github.com/antfu/refined-github-notifications
// @match        https://github.com/**
// @icon         https://www.google.com/s2/favicons?sz=64&domain=github.com
// @grant        window.close
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @grant        GM_unregisterMenuCommand
// ==/UserScript==

// @ts-check
/* eslint-disable no-console */

/**
 * @typedef {import('./index.d').NotificationItem} Item
 */

(function () {
  'use strict'

  // Fix the archive link
  if (location.pathname === '/notifications/beta/archive')
    location.pathname = '/notifications'

  /**
   * list of functions to be cleared on page change
   * @type {(() => void)[]}
   */
  const cleanups = []

  const NAME = 'Refined GitHub Notifications'
  const STORAGE_KEY = 'refined-github-notifications'

  const AUTO_MARK_DONE = useOption('rgn_auto_mark_done', 'Auto mark done', true)
  const HIDE_CHECKBOX = useOption('rgn_hide_checkbox', 'Hide checkbox', true)
  const HIDE_ISSUE_NUMBER = useOption('rgn_hide_issue_number', 'Hide issue number', true)
  const HIDE_EMPTY_INBOX_IMAGE = useOption('rgn_hide_empty_inbox_image', 'Hide empty inbox image', true)
  const ENHANCE_NOTIFICATION_SHELF = useOption('rgn_enhance_notification_shelf', 'Enhance notification shelf', true)

  const config = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')

  let bc
  let bcInitTime = 0

  function writeConfig() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
  }

  function injectStyle() {
    const style = document.createElement('style')
    style.innerHTML = [`
/* Hide blue dot on notification icon */
.mail-status.unread {
  display: none !important;
}
/* Hide blue dot on notification with the new navigration */
.AppHeader .AppHeader-button.AppHeader-button--hasIndicator::before {
  display: none !important;
}
/* Limit notification container width on large screen for better readability */
.notifications-v2 .js-check-all-container {
  max-width: 1000px;
  margin: 0 auto;
}
/* Hide sidebar earlier, override the breakpoints */
@media (min-width: 768px) {
  .js-notifications-container {
    flex-direction: column !important;
  }
  .js-notifications-container > .d-none.d-md-flex {
    display: none !important;
  }
  .js-notifications-container > .col-md-9 {
    width: 100% !important;
  }
}
@media (min-width: 1268px) {
  .js-notifications-container {
    flex-direction: row !important;
  }
  .js-notifications-container > .d-none.d-md-flex {
    display: flex !important;
  }
}
`,
    HIDE_CHECKBOX.value && `
/* Hide check box on notification list */
.notifications-list-item > *:first-child label {
  opacity: 0 !important;
  width: 0 !important;
  margin-right: -10px !important;
}`,
    ENHANCE_NOTIFICATION_SHELF.value && `
/* Hide the notification shelf and add a FAB */
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
}`,
    HIDE_EMPTY_INBOX_IMAGE.value && `/* Hide the image on zero-inbox */
.js-notifications-blankslate picture {
  display: none !important;
}`,
    ].filter(Boolean).join('\n')
    document.head.appendChild(style)
  }

  /**
   * Create UI for the options
   * @template T
   * @param {string} key
   * @param {string} title
   * @param {T} defaultValue
   * @returns {{ value: T }}
   */
  function useOption(key, title, defaultValue) {
    if (typeof GM_getValue === 'undefined') {
      return {
        value: defaultValue,
      }
    }

    let value = GM_getValue(key, defaultValue)
    const ref = {
      get value() {
        return value
      },
      set value(v) {
        value = v
        GM_setValue(key, v)
        location.reload()
      },
    }

    GM_registerMenuCommand(`${title}: ${value ? '✅' : '❌'}`, () => {
      ref.value = !value
    })

    return ref
  }

  /**
   * To have a FAB button to close current issue,
   * where you can mark done and then close the tab automatically
   */
  function enhanceNotificationShelf() {
    function inject() {
      const shelf = document.querySelector('.js-notification-shelf')
      if (!shelf)
        return false

      /** @type {HTMLButtonElement} */
      const doneButton = shelf.querySelector('button[title="Done"]')
      if (!doneButton)
        return false

      const clickAndClose = async () => {
        doneButton.click()
        // wait for the notification shelf to be updated
        await Promise.race([
          new Promise((resolve) => {
            const ob = new MutationObserver(() => {
              resolve()
              ob.disconnect()
            })

            ob.observe(
              shelf,
              {
                childList: true,
                subtree: true,
                attributes: true,
              },
            )
          }),
          new Promise(resolve => setTimeout(resolve, 1000)),
        ])
        // close the tab
        window.close()
      }

      /**
       * @param {KeyboardEvent} e
       */
      const keyDownHandle = (e) => {
        if (e.altKey && e.key === 'x') {
          e.preventDefault()
          clickAndClose()
        }
      }

      /** @type {*} */
      const fab = doneButton.cloneNode(true)
      fab.classList.remove('btn-sm')
      fab.classList.add('btn-hover-primary')
      fab.addEventListener('click', clickAndClose)
      Object.assign(fab.style, {
        position: 'fixed',
        right: '25px',
        bottom: '25px',
        zIndex: 999,
        aspectRatio: '1/1',
        borderRadius: '50%',
      })

      const commentActions = document.querySelector('#partial-new-comment-form-actions')
      if (commentActions) {
        const key = 'markDoneAfterComment'
        const label = document.createElement('label')
        const input = document.createElement('input')
        label.classList.add('color-fg-muted')
        input.type = 'checkbox'
        input.checked = !!config[key]
        input.addEventListener('change', (e) => {
          // @ts-expect-error cast
          config[key] = !!e.target.checked
          writeConfig()
        })
        label.appendChild(input)
        label.appendChild(document.createTextNode(' Mark done and close after comment'))
        Object.assign(label.style, {
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'end',
          gap: '5px',
          userSelect: 'none',
          fontWeight: '400',
        })
        const div = document.createElement('div')
        Object.assign(div.style, {
          paddingBottom: '5px',
        })
        div.appendChild(label)
        commentActions.parentElement.prepend(div)

        const commentButton = commentActions.querySelector('button.btn-primary[type="submit"]')
        const closeButton = commentActions.querySelector('[name="comment_and_close"]')
        const buttons = [commentButton, closeButton].filter(Boolean)

        for (const button of buttons) {
          button.addEventListener('click', async () => {
            if (config[key]) {
              await new Promise(resolve => setTimeout(resolve, 1000))
              clickAndClose()
            }
          })
        }
      }

      const mergeMessage = document.querySelector('.merge-message')
      if (mergeMessage) {
        const key = 'markDoneAfterMerge'
        const label = document.createElement('label')
        const input = document.createElement('input')
        label.classList.add('color-fg-muted')
        input.type = 'checkbox'
        input.checked = !!config[key]
        input.addEventListener('change', (e) => {
          // @ts-expect-error cast
          config[key] = !!e.target.checked
          writeConfig()
        })
        label.appendChild(input)
        label.appendChild(document.createTextNode(' Mark done and close after merge'))
        Object.assign(label.style, {
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'end',
          gap: '5px',
          userSelect: 'none',
          fontWeight: '400',
        })
        mergeMessage.prepend(label)

        /** @type {HTMLButtonElement[]} */
        const buttons = Array.from(mergeMessage.querySelectorAll('.js-auto-merge-box button'))
        for (const button of buttons) {
          button.addEventListener('click', async () => {
            if (config[key]) {
              await new Promise(resolve => setTimeout(resolve, 1000))
              clickAndClose()
            }
          })
        }
      }

      document.body.appendChild(fab)
      document.addEventListener('keydown', keyDownHandle)
      cleanups.push(() => {
        document.body.removeChild(fab)
        document.removeEventListener('keydown', keyDownHandle)
      })

      return true
    }

    // when first into the page, the notification shelf might not be loaded, we need to wait for it to show
    if (!inject()) {
      const observer = new MutationObserver((mutationList) => {
        /** @type {HTMLElement[]} */
        const addedNodes = /** @type {*} */ (Array.from(mutationList[0].addedNodes))
        const found = mutationList.some(i => i.type === 'childList' && addedNodes.some(el => el.classList.contains('js-notification-shelf')))
        if (found) {
          inject()
          observer.disconnect()
        }
      })
      observer.observe(document.querySelector('[data-turbo-body]'), { childList: true })
      cleanups.push(() => {
        observer.disconnect()
      })
    }
  }

  function initBroadcastChannel() {
    bcInitTime = Date.now()
    bc = new BroadcastChannel('refined-github-notifications')

    bc.onmessage = ({ data }) => {
      if (isInNotificationPage()) {
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
        // try to use the same tab
        r.target = r.href.replace('https://github.com', '').replace(/[\\/?#-]/g, '_')
      })
  }

  function initIdleListener() {
    // Auto refresh page on going back to the page
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible')
        refresh()
    })
  }

  function getIssues() {
    /** @type {HTMLDivElement[]} */
    const items = Array.from(document.querySelectorAll('.notifications-list-item'))
    return items.map((el) => {
      /** @type {HTMLLinkElement} */
      const linkEl = el.querySelector('a.notification-list-item-link')
      const url = linkEl.href
      const status = el.querySelector('.color-fg-open')
        ? 'open'
        : el.querySelector('.color-fg-done')
          ? 'done'
          : el.querySelector('.color-fg-closed')
            ? 'closed'
            : el.querySelector('.color-fg-muted')
              ? 'muted'
              : 'unknown'

      /** @type {HTMLDivElement | undefined} */
      const notificationTypeEl = /** @type {*} */ (el.querySelector('.AvatarStack').nextElementSibling)
      if (!notificationTypeEl)
        return null
      const notificationType = notificationTypeEl.textContent.trim()

      // Colorize notification type
      if (notificationType === 'mention')
        notificationTypeEl.classList.add('color-fg-open')
      else if (notificationType === 'author')
        notificationTypeEl.style.color = 'var(--color-scale-green-5)'
      else if (notificationType === 'ci activity')
        notificationTypeEl.classList.add('color-fg-muted')
      else if (notificationType === 'commented')
        notificationTypeEl.style.color = 'var(--color-scale-blue-4)'
      else if (notificationType === 'subscribed')
        notificationTypeEl.remove()
      else if (notificationType === 'state change')
        notificationTypeEl.classList.add('color-fg-muted')
      else if (notificationType === 'review requested')
        notificationTypeEl.classList.add('color-fg-done')

      // Remove plus one
      const plusOneEl = Array.from(el.querySelectorAll('.d-md-flex'))
        .find(i => i.textContent.trim().startsWith('+'))
      if (plusOneEl)
        plusOneEl.remove()

      // Remove issue number
      if (HIDE_ISSUE_NUMBER.value) {
        const issueNo = linkEl.children[1]?.children?.[0]?.querySelector('.color-fg-muted')
        if (issueNo && issueNo.textContent.trim().startsWith('#'))
          issueNo.remove()
      }

      /** @type {Item} */
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
    }).filter(Boolean)
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

  /**
   * @param {Item[]} items
   */
  function autoMarkDone(items) {
    console.debug(`[${NAME}] ${items.length} notifications found`, items)
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
        url: i.url,
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
    /** @type {HTMLLinkElement[]} */
    const avatars = Array.from(document.querySelectorAll('.AvatarStack-body > a'))

    avatars.forEach((r) => {
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

  function cleanup() {
    cleanups.forEach(fn => fn())
    cleanups.length = 0
  }

  // Click the notification tab to do soft refresh
  function refresh() {
    if (!isInNotificationPage())
      return
    /** @type {HTMLButtonElement} */
    const button = document.querySelector('.filter-list a[href="/notifications"]')
    button.click()
  }

  function isInNotificationPage() {
    return location.href.startsWith('https://github.com/notifications')
  }

  function initNewNotificationsObserver() {
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
    cleanup()
    if (isInNotificationPage()) {
      // Run only once
      if (!initialized) {
        initIdleListener()
        initBroadcastChannel()
        initNewNotificationsObserver()
        initialized = true
      }

      const items = getIssues()

      // Run every render
      dedupeTab()
      externalize()
      removeBotAvatars()

      // Only mark on "Inbox" view
      if (isInboxView() && AUTO_MARK_DONE.value)
        autoMarkDone(items)
    }
    else {
      if (ENHANCE_NOTIFICATION_SHELF.value)
        enhanceNotificationShelf()
    }
  }

  injectStyle()
  run()

  // listen to github page loaded event
  document.addEventListener('pjax:end', () => run())
  document.addEventListener('turbo:render', () => run())
})()
