import BingSearch from '../views/BingSearch.vue'
import BaiduSearch from '../views/BaiduSearch.vue'
import CsdnArticle from '../views/CsdnArticle.vue'
import BaiduArticle from '../views/BaiduArticle.vue'
import GoogleSearch from '../views/GoogleSearch.vue'
import ZhihuArticle from '../views/ZhihuArticle.vue'
import BilibiliVideo from '../views/BilibiliVideo.vue'
import SnippetHack from '../views/SnippetHack.vue'

if (location.hostname === 'localhost') {
  document.body.setAttribute('www-baidu-com', '')
}
export const MAPPINGS = {
  'https?://localhost(:\d+)?.*': BilibiliVideo,
  'https?://www.baidu.com/s[?].*': BaiduSearch,
  'https?://zhuanlan.zhihu.com/p/.*': ZhihuArticle,
  'https?://blog.51cto.com/u_[^/]+/.*': SnippetHack,
  'https?://www.zhihu.com/question/.*': ZhihuArticle,
  'https?://www.google.com/search[?].*': GoogleSearch,
  'https?://(www|live).bilibili.com/.*': BilibiliVideo,
  'https?://(cn|www).bing.com/search[?].*': BingSearch,
  'https?://www.51cto.com/article/.+.html': SnippetHack,
  'https?://stackoverflow.com/questions/.*': SnippetHack,
  'https?://blog.csdn.net/[^/]+/article/details/.*': CsdnArticle,
  'https?://developer.baidu.com/article/detail([.]html[?]id=.*|s/.*)': BaiduArticle,
}
