import DouyuLive from '../views/DouyuLive.vue'
import BingSearch from '../views/BingSearch.vue'
import BaiduSearch from '../views/BaiduSearch.vue'
import CsdnArticle from '../views/CsdnArticle.vue'
import SnippetHack from '../views/SnippetHack.vue'
import BaiduArticle from '../views/BaiduArticle.vue'
import GoogleSearch from '../views/GoogleSearch.vue'
import ZhihuArticle from '../views/ZhihuArticle.vue'
import BilibiliVideo from '../views/BilibiliVideo.vue'

if (location.hostname === 'localhost') {
  document.body.setAttribute('www-baidu-com', '')
}
export const MAPPINGS = {
  'https?://localhost(:\d+)?.*': BilibiliVideo,
  'https?://juejin.cn/post/.*': SnippetHack,
  'https?://t.bilibili.com/.*': BilibiliVideo,
  'https?://www.jianshu.com/p/.*': SnippetHack,
  'https?://www.baidu.com/s[?].*': BaiduSearch,
  'https?://tieba.baidu.com/p/.*': BaiduArticle,
  'https?://www.jb51.net/.*.html?': SnippetHack,
  'https?://zhuanlan.zhihu.com/p/.*': ZhihuArticle,
  'https?://blog.51cto.com/u_[^/]+/.*': SnippetHack,
  'https?://www.zhihu.com/question/.*': ZhihuArticle,
  'https?://baijiahao.baidu.com/s[?].*': BaiduArticle,
  'https?://www.google.com/search[?].*': GoogleSearch,
  'https?://(www|live).bilibili.com/.*': BilibiliVideo,
  'https?://(cn|www).bing.com/search[?].*': BingSearch,
  'https?://www.51cto.com/article/.+.html': SnippetHack,
  'https?://stackoverflow.com/questions/.*': SnippetHack,
  'https?://www.360doc.com/content/.*.shtml': SnippetHack,
  'https?://developer.aliyun.com/article/.*': SnippetHack,
  'https?://jingyan.baidu.com/article/.*.html': BaiduArticle,
  'https?://dba.stackexchange.com/questions/.*': SnippetHack,
  'https?://blog.csdn.net/[^/]+/article/details/.*': CsdnArticle,
  'https?://www.douyu.com/([0-9]+|topic/.*[?]rid=[0-9]+)': DouyuLive,
  'https?://cloud.tencent.com.cn/developer/information/.*': SnippetHack,
  'https?://developer.baidu.com/article/detail([.]html[?]id=.*|s/.*)': BaiduArticle,
}
