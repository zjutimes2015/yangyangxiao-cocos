# 羊羊消（Cocos Creator 3.x）

羊了个羊风格三消闯关小游戏。纯代码构建 UI / 卡牌 / 槽位 / 弹窗，**无需**在编辑器里手动拖节点、绑组件或导入外部图片。

## 环境要求

- **Cocos Creator 3.8.x**（推荐 3.8.8；兼容 3.6～3.8）
- 打开本工程后等待脚本编译完成

## 打开并游玩

1. 启动 Cocos Creator 3.8.x
2. **打开项目**：选择本目录 `yangyangxiao-cocos/`
3. 在资源管理器中打开 `assets/scenes/main.scene`
4. 点击编辑器上方 **预览 / Play（浏览器预览）**
5. 封面点击 **开始** → 观看「加入羊群」→ 即可游玩

> 若场景节点不完整，`GameManager.onLoad` 会自动补齐 `Canvas / BoardRoot / SlotRoot / UIRoot`，保证可玩。

## 操作说明

- 点击未被遮挡的牌 → 进入下方 7 格槽位；三张相同自动消除
- 右侧竖排道具（每关各 1 次）：**洗牌** / **移除** / **撤回**
- 槽位满且无法消除 → 失败：可 **再来一次** / **分享挑战给朋友** / **看广告复活**（每关 1 次）
- 第 1 关教学（15 张）→ 第 2 关正式（**45** 张 = 15 种 × 3）

## 工程结构

```
yangyangxiao-cocos/
├── assets/
│   ├── scenes/main.scene      # 主场景
│   └── scripts/
│       ├── GameManager.ts     # 流程、关卡、复活、广告桩、分享入口
│       ├── CardManager.ts     # 纺锤布局、遮挡、洗牌
│       ├── SlotManager.ts     # 7 槽、插入归组、三消、移除、撤回数据
│       └── UIManager.ts       # 封面/HUD/胜负/计时/分享图/Toast
├── settings/                  # 设计分辨率 1280×720
├── package.json               # Creator 3.8.8
└── README.md
```

## 设计要点

- 设计分辨率 **1280×720**；柔和渐变背景（多层 Graphics）
- 牌堆位于紧凑 HUD 下方安全区；道具在 **右侧竖列**
- 最高分：`localStorage` 键 `yangyangxiao-cocos-hs`（更高通关关卡优先，同关更短用时优先）
- 广告：`showRewardedAd` 为模拟倒计时桩，可替换真实 SDK

## 注意事项

- 首次打开会生成 `library/`、`temp/`、`local/`，属正常现象
- 无需 npm 安装；无需外部字体 / 图集 / 远程资源

## 再次打开

用 **Cocos Creator 3.8.8** 打开本仓库根目录 → `assets/scenes/main.scene` → 预览。

## 后续发布

### 微信小游戏（后期）
本工程按 **Cocos Creator 3.8.8** 标准结构组织，后续可在编辑器中：

1. 菜单 **项目 → 构建发布**
2. 发布平台选择 **微信小游戏（wechatgame）**
3. 填入微信小游戏 AppID 后构建
4. 用微信开发者工具打开构建产物目录

当前版本的分享图、`localStorage` 最高分在微信环境还需换成微信存储 / 分享 API，广告桩 `showRewardedAd` 再接微信激励视频。

### TikTok / 海外
同样走构建发布，目标平台按投放渠道选择（Web / 原生）。广告与分享接口与微信不同，需单独替换桩函数。
