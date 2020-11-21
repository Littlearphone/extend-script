var name = evtprm[1];
var body = evtprm[2];
var ttscontent = '';
if (/[\u4e00-\u9fa5]/.test(name)) {
    ttscontent = name + "来短信说：" + body;
}
const extract = /验证码[^0-9a-zA-Z]*([0-9a-zA-Z]*)/g.exec(body);
if (extract && extract.length > 1) {
    ttscontent = '收到短信验证码：' + extract[1];
}
// js(let)后面再建一条"文本转语音"的操作，直接播出％ttscontent
