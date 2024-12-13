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

  scrollListener(event) {
    if (top.window.innerHeight >= top.document.body.scrollHeight) {
      return this.offScrollListener() || this.nextPage()
    }
    if (top.window.innerHeight + top.window.scrollY >= top.document.body.scrollHeight - PRELOAD_MARGIN) {
      return this.offScrollListener() || this.nextPage()
    }
  }

  nextPage() {

  }
}
