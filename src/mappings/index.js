import BingSearch from '../views/BingSearch.vue'
import BaiduSearch from '../views/BaiduSearch.vue'
import CsdnArticle from '../views/CsdnArticle.vue'
import GoogleSearch from '../views/GoogleSearch.vue'
import ZhihuArticle from '../views/ZhihuArticle.vue'
import BilibiliVideo from '../views/BilibiliVideo.vue'

if (location.hostname === 'localhost') {
  document.body.setAttribute('www-baidu-com', '')
}
export const MAPPINGS = {
  'https?://localhost(:\d+)?.*': BilibiliVideo,
  'https?://www.baidu.com/s[?].*': BaiduSearch,
  'https?://zhuanlan.zhihu.com/p/.*': ZhihuArticle,
  'https?://www.zhihu.com/question/.*': ZhihuArticle,
  'https?://www.google.com/search[?].*': GoogleSearch,
  'https?://(cn|www).bing.com/search[?].*': BingSearch,
  'https?://www.bilibili.com/video/BV.*': BilibiliVideo,
  'https?://blog.csdn.net/[^/]+/article/details/.*': CsdnArticle,
}
