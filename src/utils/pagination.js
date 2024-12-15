const PRELOAD_MARGIN = 200

export class Pagination {
  constructor() {
    this.listener = this.scrollListener.bind(this)
    this.onScrollListener()
  }

  onScrollListener() {
    document.addEventListener('scroll', this.listener)
  }

  offScrollListener() {
    document.removeEventListener('scroll', this.listener)
  }

  isPageBottom() {
    const body = top.document.body
    const innerHeight = top.innerHeight || top.document.documentElement.clientHeight
    if (innerHeight >= body.clientHeight || innerHeight >= body.scrollHeight) {
      return true
    }
    if (innerHeight + top.scrollY >= body.scrollHeight - PRELOAD_MARGIN) {
      return true
    }
  }

  scrollListener() {
    if (this.isPageBottom()) {
      return this.offScrollListener() || this.nextPage()
    }
  }

  nextPage() {
    return true
  }
}
