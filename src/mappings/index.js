import BingSearch from '../views/BingSearch.vue'
import BaiduSearch from '../views/BaiduSearch.vue'
import CsdnArticle from '../views/CsdnArticle.vue'

export const MAPPINGS = {
  'https?://www.baidu.com/s[?].*': BaiduSearch,
  'https?://(cn|www).bing.com/search[?].*': BingSearch,
  'https?://blog.csdn.net/[^/]+/article/details/.*': CsdnArticle,
}
