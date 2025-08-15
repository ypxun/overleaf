import { Tab } from 'bootstrap'

function bookmarkableTab(tabEl: HTMLElement) {
  tabEl.addEventListener('click', () => {
    window.location.hash = tabEl.getAttribute('href') as string
  })
}

function handleHashChange() {
  const hash = window.location.hash
  if (!hash) return

  // Find the bookmarkable tab that links to the hash
  const tabEl = document.querySelector(
    `[data-ol-bookmarkable-tab][href="${hash}"]`
  )

  if (!tabEl) return

  const tab = new Tab(tabEl)
  tab.show()
}

document
  .querySelectorAll('[data-ol-bookmarkable-tab]')
  .forEach(tabEl => bookmarkableTab(tabEl as HTMLElement))

window.addEventListener('hashchange', handleHashChange)
handleHashChange()
