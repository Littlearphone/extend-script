//下面的三个变量值需要修改
var ID = "ww4719b360fb222840";
var SECRET = "rp85qwoarw_UeVzmrTtA38o9_rwiFe8cYt3B4q9vvfw";
var AGENTID = "1000002";

//定义post方法
function posthttp(url, data) {
    var xhr = new XMLHttpRequest();
    xhr.addEventListener("readystatechange", function () {
        if (this.readyState === 4) {
            flash(this.responseText); //显示返回消息,可删除本行
        }
    });
    xhr.open("POST", url, false);
    xhr.send(data);
    return xhr.responseText;
}

//定义get方法
function gethttp(url) {
    var xhr = new XMLHttpRequest();
    xhr.addEventListener("readystatechange", function () {
        if (this.readyState === 4) {
            flash(this.responseText); //显示返回消息,可删除本行
        }
    });
    xhr.open("GET", url, false);
    xhr.send();
    return xhr.responseText;
}

//获取token
var gettoken = "https://qyapi.weixin.qq.com/cgi-bin/gettoken?corpid=" + ID + "&corpsecret=" + SECRET;
var ACCESS_TOKEN = JSON.parse(gethttp(gettoken)).access_token;

//发送消息(文本)
var SMSRT = global('CTIME');
var SMSRD = global('CDATE');
var CONTENT = "当前手机电池电量过低\n检测时间为" + SMSRD + " " + SMSRT;
var message = JSON.stringify({
    "touser": "@all",
    "msgtype": "text",
    "agentid": AGENTID,
    "text": {
        "content": CONTENT
    },
    "safe": 0
});
var send = "https://qyapi.weixin.qq.com/cgi-bin/message/send?access_token=" + ACCESS_TOKEN;
posthttp(send, message);
