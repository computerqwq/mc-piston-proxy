## mc-piston-proxy
这是一个基于Cloudflare Workers的加速mc下载原版资源工具,它能够使用BMCL的接口样式来接管下载请求转发到官方源,来加速下载.

当然由于cf特性这可能是"加速下载"

> [!WARNING]
> 根据 [Cloudflare 协议](https://www.cloudflare.com/zh-cn/terms/) 中， use the Services to provide a virtual private network or other similar proxy services.
> 使用本服务可能存在被 Cloudflare 封号的潜在风险，请自行斟酌使用风险。

此项目只支持原版我的世界

### 部署方式
- **Workers** 部署：复制 worker.js 代码，`保存并部署`即可
### 使用教程
>此项目仅支持hmcl  

在hmcl启动器目录下打开cmd并确保您已配置java环境变量,
```bash
java -Dhmcl.bmclapi.override=部署域名 -jar HMCL程序
```
### 主页问题
我也不知道为什么要写这个玩意了,写了丢脸就当小广告了,可以自己修改.