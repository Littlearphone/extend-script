import BingSearch from '../views/BingSearch.vue'
import BaiduSearch from '../views/BaiduSearch.vue'
import CsdnArticle from '../views/CsdnArticle.vue'
import BilibiliVideo from '../views/BilibiliVideo.vue'

if (location.hostname === 'localhost') {
  document.body.setAttribute('www-baidu-com', '')
}
export const MAPPINGS = {
  'https?://localhost(:\d+)?.*': BaiduSearch,
  'https?://www.baidu.com/s[?].*': BaiduSearch,
  'https?://(cn|www).bing.com/search[?].*': BingSearch,
  'https?://www.bilibili.com/video/BV.*': BilibiliVideo,
  'https?://blog.csdn.net/[^/]+/article/details/.*': CsdnArticle,
}
