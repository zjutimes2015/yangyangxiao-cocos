import {
    _decorator, Component, Node, UITransform, Graphics, Label, Color,
    Button, Widget, BlockInputEvents, UIOpacity, tween, Tween, Vec3, Layers,
    view, sys
} from 'cc';
import type { GameManager } from './GameManager';

const { ccclass } = _decorator;

export const HS_KEY = 'yangyangxiao-cocos-hs';

export interface HighScoreRecord {
    level: number; // highest level cleared (0 = none)
    time: number;  // seconds for that clear (lower better when same level)
}

@ccclass('UIManager')
export class UIManager extends Component {
    uiRoot: Node | null = null;
    private _game: GameManager | null = null;

    // HUD
    private _hud: Node | null = null;
    private _timerLabel: Label | null = null;
    private _hsLabel: Label | null = null;
    private _levelLabel: Label | null = null;
    private _remainLabel: Label | null = null;

    // Items (right vertical)
    private _itemsCol: Node | null = null;
    private _btnShuffle: Node | null = null;
    private _btnRemove: Node | null = null;
    private _btnUndo: Node | null = null;
    private _shuffleUses: Label | null = null;
    private _removeUses: Label | null = null;
    private _undoUses: Label | null = null;

    // Modals / overlays
    private _cover: Node | null = null;
    private _slogan: Node | null = null;
    private _lose: Node | null = null;
    private _win: Node | null = null;
    private _ad: Node | null = null;
    private _toast: Node | null = null;
    private _toastLabel: Label | null = null;
    private _toastTimer = 0;

    private _shareBtn: Node | null = null;
    private _bgLayers: Node | null = null;

    designW = 1280;
    designH = 720;

    bind(game: GameManager) {
        this._game = game;
    }

    setUIRoot(root: Node) {
        this.uiRoot = root;
    }

    /** Build all UI layers once */
    buildAll() {
        if (!this.uiRoot) return;
        this._buildBackground();
        this._buildHUD();
        this._buildItemsColumn();
        this._buildCover();
        this._buildSlogan();
        this._buildLose();
        this._buildWin();
        this._buildAd();
        this._buildToast();
        this.refreshHighScoreDisplay();
    }

    // ─── Background soft gradient (multi Graphics) ───
    private _buildBackground() {
        if (!this.uiRoot) return;
        const canvas = this.uiRoot.parent;
        let bg = canvas?.getChildByName('BgRoot');
        if (!bg && canvas) {
            bg = new Node('BgRoot');
            bg.layer = Layers.Enum.UI_2D;
            const ut = bg.addComponent(UITransform);
            ut.setContentSize(this.designW, this.designH);
            bg.setSiblingIndex(0);
            canvas.insertChild(bg, 0);
        }
        if (!bg) return;
        bg.removeAllChildren();
        this._bgLayers = bg;

        const layers = [
            { color: new Color(232, 245, 233, 255), y: 180, h: 400 },
            { color: new Color(255, 248, 225, 220), y: 0, h: 420 },
            { color: new Color(227, 242, 253, 230), y: -200, h: 400 },
        ];
        for (let i = 0; i < layers.length; i++) {
            const L = layers[i];
            const n = new Node(`Grad_${i}`);
            n.layer = Layers.Enum.UI_2D;
            const ut = n.addComponent(UITransform);
            ut.setContentSize(this.designW + 40, L.h);
            n.setPosition(0, L.y, 0);
            const g = n.addComponent(Graphics);
            g.fillColor = L.color;
            g.roundRect(-(this.designW + 40) / 2, -L.h / 2, this.designW + 40, L.h, 0);
            g.fill();
            // soft blobs
            g.fillColor = new Color(L.color.r, L.color.g, L.color.b, 80);
            g.circle(-300 + i * 80, 40, 120 + i * 20);
            g.fill();
            g.circle(280 - i * 60, -30, 100 + i * 15);
            g.fill();
            bg.addChild(n);
        }
        // decorative sheep silhouettes as emoji labels (no external assets)
        const deco = new Node('Deco');
        deco.layer = Layers.Enum.UI_2D;
        deco.addComponent(UITransform).setContentSize(this.designW, this.designH);
        const dlab = deco.addComponent(Label);
        dlab.string = '🌿          🐑                    🍀';
        dlab.fontSize = 36;
        dlab.color = new Color(255, 255, 255, 90);
        dlab.horizontalAlign = Label.HorizontalAlign.CENTER;
        deco.setPosition(0, 260, 0);
        bg.addChild(deco);
    }

    // ─── Compact top HUD ───
    private _buildHUD() {
        if (!this.uiRoot) return;
        const hud = new Node('HUD');
        hud.layer = Layers.Enum.UI_2D;
        const ut = hud.addComponent(UITransform);
        ut.setContentSize(this.designW - 40, 56);
        hud.setPosition(0, this.designH / 2 - 40, 0);
        // soft bar bg
        const g = hud.addComponent(Graphics);
        g.fillColor = new Color(255, 255, 255, 200);
        g.roundRect(-(this.designW - 40) / 2, -28, this.designW - 40, 56, 14);
        g.fill();

        // left: title + level
        const left = this._makeLabel('Title', '羊羊消', 26, new Color(46, 125, 50, 255), -520, 4);
        hud.addChild(left.node);
        const levelN = this._makeLabel('Level', '第1关', 18, new Color(255, 255, 255, 255), -520, -16);
        // badge bg behind level — small node
        const badge = new Node('LevelBadge');
        badge.layer = Layers.Enum.UI_2D;
        badge.addComponent(UITransform).setContentSize(72, 22);
        badge.setPosition(-400, 0, 0);
        const bg = badge.addComponent(Graphics);
        bg.fillColor = new Color(67, 160, 71, 255);
        bg.roundRect(-36, -11, 72, 22, 11);
        bg.fill();
        const ll = badge.addComponent(Label);
        ll.string = '第1关';
        ll.fontSize = 16;
        ll.lineHeight = 22;
        ll.horizontalAlign = Label.HorizontalAlign.CENTER;
        ll.verticalAlign = Label.VerticalAlign.CENTER;
        ll.color = Color.WHITE;
        this._levelLabel = ll;
        hud.addChild(badge);

        const remain = this._makeLabel('Remain', '剩余：0', 18, new Color(85, 85, 85, 255), -280, 0);
        this._remainLabel = remain.label;
        hud.addChild(remain.node);

        const timer = this._makeLabel('Timer', '本局用时：0秒', 18, new Color(85, 85, 85, 255), 80, 0);
        this._timerLabel = timer.label;
        // emphasize number via full string updates
        hud.addChild(timer.node);

        const hs = this._makeLabel('HS', '最高分：—', 18, new Color(85, 85, 85, 255), 340, 0);
        this._hsLabel = hs.label;
        hud.addChild(hs.node);

        // top-right share (compact)
        const share = this._makeButton('BtnShare', '分享', 70, 32, new Color(251, 140, 0, 255), 560, 0, () => {
            this._game?.shareChallenge();
        });
        this._shareBtn = share;
        hud.addChild(share);

        // restart tiny
        const restart = this._makeButton('BtnRestart', '重开', 64, 28, new Color(67, 160, 71, 255), -580, 0, () => {
            this._game?.restartFromCover(false);
            this._game?.startLevel(1, true);
        });
        hud.addChild(restart);

        this.uiRoot.addChild(hud);
        this._hud = hud;
        hud.active = false; // shown after start
    }

    // ─── Items: RIGHT vertical compact column ───
    private _buildItemsColumn() {
        if (!this.uiRoot) return;
        const col = new Node('ItemsColumn');
        col.layer = Layers.Enum.UI_2D;
        col.addComponent(UITransform).setContentSize(100, 280);
        // right side, vertically centered-ish above slots
        col.setPosition(this.designW / 2 - 70, -40, 0);

        const mkItem = (name: string, title: string, y: number, onClick: () => void) => {
            const btn = this._makeButton(name, title, 92, 64, new Color(255, 255, 255, 255), 0, y, onClick, new Color(46, 125, 50, 255), new Color(129, 199, 132, 255));
            const usesN = new Node('Uses');
            usesN.layer = Layers.Enum.UI_2D;
            usesN.addComponent(UITransform).setContentSize(80, 18);
            usesN.setPosition(0, -20, 0);
            const ul = usesN.addComponent(Label);
            ul.string = '1/1';
            ul.fontSize = 14;
            ul.lineHeight = 18;
            ul.horizontalAlign = Label.HorizontalAlign.CENTER;
            ul.color = new Color(136, 136, 136, 255);
            btn.addChild(usesN);
            // retitle: main label is first Label on btn
            const mainLab = btn.getComponent(Label);
            if (mainLab) {
                mainLab.string = title;
                mainLab.fontSize = 20;
                // shift up a bit so uses fits
                // Label stays centered; Uses is child below
            }
            col.addChild(btn);
            return { btn, uses: ul };
        };

        const sh = mkItem('BtnShuffle', '洗牌', 90, () => this._game?.useShuffle());
        const rm = mkItem('BtnRemove', '移除', 10, () => this._game?.useRemove());
        const un = mkItem('BtnUndo', '撤回', -70, () => this._game?.useUndo());
        this._btnShuffle = sh.btn;
        this._btnRemove = rm.btn;
        this._btnUndo = un.btn;
        this._shuffleUses = sh.uses;
        this._removeUses = rm.uses;
        this._undoUses = un.uses;

        this.uiRoot.addChild(col);
        this._itemsCol = col;
        col.active = false;
    }

    // ─── Cover: title + high record + 开始 ONLY ───
    private _buildCover() {
        if (!this.uiRoot) return;
        const cover = new Node('Cover');
        cover.layer = Layers.Enum.UI_2D;
        cover.addComponent(UITransform).setContentSize(this.designW, this.designH);
        cover.addComponent(BlockInputEvents);
        const g = cover.addComponent(Graphics);
        g.fillColor = new Color(232, 245, 233, 245);
        g.rect(-this.designW / 2, -this.designH / 2, this.designW, this.designH);
        g.fill();
        // soft blobs
        g.fillColor = new Color(255, 248, 225, 180);
        g.circle(-200, 100, 180);
        g.fill();
        g.fillColor = new Color(227, 242, 253, 160);
        g.circle(260, -80, 200);
        g.fill();

        const title = this._makeLabel('CoverTitle', '🐑 羊羊消 🐑', 56, new Color(46, 125, 50, 255), 0, 80);
        
        cover.addChild(title.node);

        const hs = this._makeLabel('CoverHS', '最高纪录：暂无', 20, new Color(106, 27, 154, 255), 0, -20);
        cover.addChild(hs.node);
        (cover as any)._hsLab = hs.label;

        const start = this._makeButton('BtnStart', '开始', 200, 56, new Color(67, 160, 71, 255), 0, -120, () => {
            this.hideCover();
            this._game?.onStartPressed();
        });
        cover.addChild(start);

        this.uiRoot.addChild(cover);
        this._cover = cover;
        // raise cover above everything initially
        cover.setSiblingIndex(999);
    }

    refreshCoverHS() {
        if (!this._cover) return;
        const lab = (this._cover as any)._hsLab as Label;
        if (!lab) return;
        const rec = this.loadHighScore();
        if (!rec || rec.level <= 0) {
            lab.string = '最高纪录：暂无';
        } else {
            lab.string = `最高纪录：通关第${rec.level}关 · ${this.formatTime(rec.time)}`;
        }
    }

    // ─── Slogan 加入羊群 ───
    private _buildSlogan() {
        if (!this.uiRoot) return;
        const ov = new Node('SloganOverlay');
        ov.layer = Layers.Enum.UI_2D;
        ov.addComponent(UITransform).setContentSize(this.designW, this.designH);
        ov.addComponent(BlockInputEvents);
        const g = ov.addComponent(Graphics);
        g.fillColor = new Color(0, 0, 0, 140);
        g.rect(-this.designW / 2, -this.designH / 2, this.designW, this.designH);
        g.fill();
        const op = ov.addComponent(UIOpacity);
        op.opacity = 0;
        const t = this._makeLabel('SloganText', '加入羊群', 64, Color.WHITE, 0, 0);
        
        ov.addChild(t.node);
        this.uiRoot.addChild(ov);
        this._slogan = ov;
        ov.active = false;
    }

    showSlogan(then?: () => void) {
        if (!this._slogan) { then?.(); return; }
        this._slogan.active = true;
        this._slogan.setSiblingIndex(2000);
        const op = this._slogan.getComponent(UIOpacity)!;
        op.opacity = 0;
        tween(op)
            .to(0.7, { opacity: 255 })
            .delay(1.3)
            .to(1.0, { opacity: 0 })
            .call(() => {
                if (this._slogan) this._slogan.active = false;
                then?.();
            })
            .start();
    }

    // ─── Lose ───
    private _buildLose() {
        if (!this.uiRoot) return;
        const ov = new Node('LoseOverlay');
        ov.layer = Layers.Enum.UI_2D;
        ov.addComponent(UITransform).setContentSize(this.designW, this.designH);
        ov.addComponent(BlockInputEvents);
        const g = ov.addComponent(Graphics);
        g.fillColor = new Color(0, 0, 0, 160);
        g.rect(-this.designW / 2, -this.designH / 2, this.designW, this.designH);
        g.fill();
        const op = ov.addComponent(UIOpacity);
        op.opacity = 0;

        const text = this._makeLabel('LoseText', '好可惜', 52, Color.WHITE, 0, 160);
        tex
        ov.addChild(text.node);

        const panel = new Node('LosePanel');
        panel.layer = Layers.Enum.UI_2D;
        panel.addComponent(UITransform).setContentSize(340, 280);
        panel.setPosition(0, -20, 0);
        const pg = panel.addComponent(Graphics);
        pg.fillColor = Color.WHITE;
        pg.roundRect(-170, -140, 340, 280, 20);
        pg.fill();
        ov.addChild(panel);

        const tip = this._makeLabel('Tip', '槽位已满，未能通关', 18, new Color(102, 102, 102, 255), 0, 90);
        panel.addChild(tip.node);

        const revive = this._makeButton('BtnRevive', '看广告复活', 280, 44, new Color(92, 107, 192, 255), 0, 30, () => {
            this._game?.useRevive();
        });
        panel.addChild(revive);
        (ov as any)._reviveBtn = revive;

        const retry = this._makeButton('BtnRetry', '再来一次', 280, 44, new Color(67, 160, 71, 255), 0, -30, () => {
            this.hideLose();
            this._game?.restartCurrent();
        });
        panel.addChild(retry);

        const share = this._makeButton('BtnShareLose', '分享挑战给朋友', 280, 44, new Color(251, 140, 0, 255), 0, -90, () => {
            this._game?.shareChallenge();
        });
        panel.addChild(share);

        this.uiRoot.addChild(ov);
        this._lose = ov;
        ov.active = false;
    }

    showLose(canRevive: boolean) {
        if (!this._lose) return;
        this._lose.active = true;
        this._lose.setSiblingIndex(2100);
        const op = this._lose.getComponent(UIOpacity)!;
        op.opacity = 0;
        const revive = (this._lose as any)._reviveBtn as Node;
        if (revive) {
            revive.active = canRevive;
            const lab = revive.getComponent(Label);
            if (lab) lab.string = canRevive ? '看广告复活' : '已复活过';
        }
        tween(op).to(0.6, { opacity: 255 }).start();
    }

    hideLose() {
        if (this._lose) this._lose.active = false;
    }

    // ─── Win ───
    private _buildWin() {
        if (!this.uiRoot) return;
        const ov = new Node('WinOverlay');
        ov.layer = Layers.Enum.UI_2D;
        ov.addComponent(UITransform).setContentSize(this.designW, this.designH);
        ov.addComponent(BlockInputEvents);
        const g = ov.addComponent(Graphics);
        g.fillColor = new Color(0, 0, 0, 130);
        g.rect(-this.designW / 2, -this.designH / 2, this.designW, this.designH);
        g.fill();
        const op = ov.addComponent(UIOpacity);
        op.opacity = 0;

        const panel = new Node('WinPanel');
        panel.layer = Layers.Enum.UI_2D;
        panel.addComponent(UITransform).setContentSize(420, 320);
        const pg = panel.addComponent(Graphics);
        pg.fillColor = Color.WHITE;
        pg.roundRect(-210, -160, 420, 320, 20);
        pg.fill();
        ov.addChild(panel);

        const icon = this._makeLabel('Icon', '🎉', 48, Color.WHITE, 0, 110);
        panel.addChild(icon.node);
        (ov as any)._icon = icon.label;

        const title = this._makeLabel('WinTitle', '恭喜通关', 30, new Color(46, 125, 50, 255), 0, 55);
        
        panel.addChild(title.node);

        const msg = this._makeLabel('WinMsg', '', 18, new Color(85, 85, 85, 255), 0, 10);
        msg.label.overflow = Label.Overflow.RESIZE_HEIGHT;
        msg.node.getComponent(UITransform)!.setContentSize(360, 80);
        panel.addChild(msg.node);
        (ov as any)._msg = msg.label;

        const rank = this._makeLabel('Rank', '', 18, new Color(21, 101, 192, 255), 0, -40);
        rank.label.overflow = Label.Overflow.RESIZE_HEIGHT;
        rank.node.getComponent(UITransform)!.setContentSize(380, 70);
        panel.addChild(rank.node);
        (ov as any)._rank = rank.label;

        const action = this._makeButton('BtnWinAction', '下一关', 260, 48, new Color(67, 160, 71, 255), 0, -120, () => {
            this._game?.onWinAction();
        });
        panel.addChild(action);
        (ov as any)._action = action;

        this.uiRoot.addChild(ov);
        this._win = ov;
        ov.active = false;
    }

    showWin(opts: { icon: string; msg: string; rank: string; actionText: string }) {
        if (!this._win) return;
        this._win.active = true;
        this._win.setSiblingIndex(2200);
        const icon = (this._win as any)._icon as Label;
        const msg = (this._win as any)._msg as Label;
        const rank = (this._win as any)._rank as Label;
        const action = (this._win as any)._action as Node;
        if (icon) icon.string = opts.icon;
        if (msg) msg.string = opts.msg;
        if (rank) rank.string = opts.rank;
        const al = action?.getComponent(Label);
        if (al) al.string = opts.actionText;
        const op = this._win.getComponent(UIOpacity)!;
        op.opacity = 0;
        tween(op).to(0.5, { opacity: 255 }).start();
    }

    hideWin() {
        if (this._win) this._win.active = false;
    }

    // ─── Ad overlay ───
    private _buildAd() {
        if (!this.uiRoot) return;
        const ov = new Node('AdOverlay');
        ov.layer = Layers.Enum.UI_2D;
        ov.addComponent(UITransform).setContentSize(this.designW, this.designH);
        ov.addComponent(BlockInputEvents);
        const g = ov.addComponent(Graphics);
        g.fillColor = new Color(0, 0, 0, 240);
        g.rect(-this.designW / 2, -this.designH / 2, this.designW, this.designH);
        g.fill();
        const text = this._makeLabel('AdText', '广告播放中...（5）', 32, Color.WHITE, 0, 20);
        tex
        ov.addChild(text.node);
        (ov as any)._text = text.label;
        const sub = this._makeLabel('AdSub', '模拟广告，稍后可接入真实 SDK', 16, new Color(170, 170, 170, 255), 0, -30);
        ov.addChild(sub.node);
        this.uiRoot.addChild(ov);
        this._ad = ov;
        ov.active = false;
    }

    showAdCountdown(onDone: () => void) {
        if (!this._ad) { onDone(); return; }
        this._ad.active = true;
        this._ad.setSiblingIndex(3000);
        const lab = (this._ad as any)._text as Label;
        // Specs: 广告播放中... + (5)(4)(3)(2)(1)
        const seq = [5, 4, 3, 2, 1];
        let i = 0;
        const show = () => {
            if (lab) lab.string = `广告播放中...（${seq[i]}）`;
            i += 1;
            if (i < seq.length) {
                this.scheduleOnce(show, 1);
            } else {
                this.scheduleOnce(() => {
                    if (this._ad) this._ad.active = false;
                    onDone();
                }, 1);
            }
        };
        show();
    }

    hideAd() {
        if (this._ad) this._ad.active = false;
    }

    // ─── Toast ───
    private _buildToast() {
        if (!this.uiRoot) return;
        const t = new Node('Toast');
        t.layer = Layers.Enum.UI_2D;
        t.addComponent(UITransform).setContentSize(360, 40);
        t.setPosition(0, -this.designH / 2 + 60, 0);
        const g = t.addComponent(Graphics);
        g.fillColor = new Color(33, 33, 33, 230);
        g.roundRect(-180, -20, 360, 40, 20);
        g.fill();
        const op = t.addComponent(UIOpacity);
        op.opacity = 0;
        const lab = this._makeLabel('ToastLab', '', 18, Color.WHITE, 0, 0);
        t.addChild(lab.node);
        this._toastLabel = lab.label;
        this.uiRoot.addChild(t);
        this._toast = t;
        t.active = true;
    }

    showToast(msg: string) {
        if (!this._toast || !this._toastLabel) return;
        this._toastLabel.string = msg;
        this._toast.setSiblingIndex(4000);
        const op = this._toast.getComponent(UIOpacity)!;
        Tween.stopAllByTarget(op);
        op.opacity = 0;
        tween(op).to(0.25, { opacity: 255 }).delay(1.8).to(0.3, { opacity: 0 }).start();
    }

    // ─── Visibility helpers ───
    hideCover() {
        if (this._cover) this._cover.active = false;
        if (this._hud) this._hud.active = true;
        if (this._itemsCol) this._itemsCol.active = true;
    }

    showCover() {
        if (this._cover) {
            this.refreshCoverHS();
            this._cover.active = true;
            this._cover.setSiblingIndex(999);
        }
        if (this._hud) this._hud.active = false;
        if (this._itemsCol) this._itemsCol.active = false;
        this.hideLose();
        this.hideWin();
        this.hideAd();
    }

    setGameplayVisible(v: boolean) {
        if (this._hud) this._hud.active = v;
        if (this._itemsCol) this._itemsCol.active = v;
    }

    updateTimer(sec: number) {
        if (this._timerLabel) this._timerLabel.string = `本局用时：${this.formatTime(sec)}`;
    }

    updateRemain(n: number) {
        if (this._remainLabel) this._remainLabel.string = `剩余：${n}`;
    }

    updateLevel(level: number) {
        if (this._levelLabel) {
            this._levelLabel.string = `第${level}关`;
            // badge color
            const badge = this._levelLabel.node;
            const g = badge.getComponent(Graphics);
            if (g) {
                g.clear();
                g.fillColor = level === 2 ? new Color(230, 81, 0, 255) : new Color(67, 160, 71, 255);
                g.roundRect(-36, -11, 72, 22, 11);
                g.fill();
            }
        }
    }

    updateItemButtons(shuffleLeft: number, removeLeft: number, undoLeft: number, canUndo: boolean, busy: boolean, over: boolean, blocked: boolean) {
        const setUses = (lab: Label | null, n: number) => { if (lab) lab.string = `${n}/1`; };
        setUses(this._shuffleUses, shuffleLeft);
        setUses(this._removeUses, removeLeft);
        setUses(this._undoUses, undoLeft);
        this._setBtnEnabled(this._btnShuffle, shuffleLeft > 0 && !busy && !over && !blocked);
        this._setBtnEnabled(this._btnRemove, removeLeft > 0 && !busy && !over && !blocked);
        this._setBtnEnabled(this._btnUndo, undoLeft > 0 && canUndo && !busy && !over && !blocked);
    }

    private _setBtnEnabled(btn: Node | null, enabled: boolean) {
        if (!btn) return;
        const b = btn.getComponent(Button);
        if (b) b.interactable = enabled;
        const lab = btn.getComponent(Label);
        if (lab) lab.color = enabled ? new Color(46, 125, 50, 255) : new Color(158, 158, 158, 255);
        const g = btn.getComponent(Graphics);
        if (g) {
            // redraw muted
            const ut = btn.getComponent(UITransform)!;
            const w = ut.contentSize.width;
            const h = ut.contentSize.height;
            g.clear();
            g.fillColor = enabled ? new Color(255, 255, 255, 255) : new Color(238, 238, 238, 255);
            g.roundRect(-w / 2, -h / 2, w, h, 12);
            g.fill();
            g.strokeColor = enabled ? new Color(129, 199, 132, 255) : new Color(189, 189, 189, 255);
            g.lineWidth = 2;
            g.roundRect(-w / 2, -h / 2, w, h, 12);
            g.stroke();
        }
    }

    // ─── High score ───
    loadHighScore(): HighScoreRecord | null {
        try {
            const raw = sys.localStorage.getItem(HS_KEY);
            if (!raw) return null;
            const o = JSON.parse(raw);
            if (typeof o.level === 'number' && typeof o.time === 'number') return o as HighScoreRecord;
            return null;
        } catch {
            return null;
        }
    }

    /**
     * Higher level cleared wins; same level → shorter time wins.
     */
    saveHighScoreIfBetter(clearedLevel: number, timeSec: number) {
        const cur = this.loadHighScore();
        let better = false;
        if (!cur || cur.level <= 0) better = true;
        else if (clearedLevel > cur.level) better = true;
        else if (clearedLevel === cur.level && timeSec < cur.time) better = true;
        if (better) {
            try {
                sys.localStorage.setItem(HS_KEY, JSON.stringify({ level: clearedLevel, time: timeSec }));
            } catch { /* ignore */ }
            this.refreshHighScoreDisplay();
        }
    }

    refreshHighScoreDisplay() {
        const rec = this.loadHighScore();
        if (this._hsLabel) {
            if (!rec || rec.level <= 0) this._hsLabel.string = '最高分：—';
            else this._hsLabel.string = `最高分：L${rec.level}·${this.formatTime(rec.time)}`;
        }
        this.refreshCoverHS();
    }

    formatTime(sec: number): string {
        if (sec < 60) return `${sec}秒`;
        const m = Math.floor(sec / 60);
        const s = sec % 60;
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    }

    /**
     * Share PNG via browser canvas toDataURL; fallback draws poster description via toast.
     */
    exportSharePng(elapsedSec: number, level: number) {
        const line = `我在《羊羊消》坚持了${elapsedSec}秒，你能超过我吗？`;
        try {
            // Browser preview path
            const doc = (globalThis as any).document;
            if (doc && typeof doc.createElement === 'function') {
                const canvas = doc.createElement('canvas');
                canvas.width = 720;
                canvas.height = 400;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    const grd = ctx.createLinearGradient(0, 0, 720, 400);
                    grd.addColorStop(0, '#66bb6a');
                    grd.addColorStop(0.5, '#fff176');
                    grd.addColorStop(1, '#4fc3f7');
                    ctx.fillStyle = grd;
                    ctx.fillRect(0, 0, 720, 400);
                    ctx.fillStyle = 'rgba(255,255,255,0.88)';
                    this._roundRect(ctx, 40, 50, 640, 300, 24);
                    ctx.fill();
                    ctx.fillStyle = '#2e7d32';
                    ctx.font = 'bold 42px sans-serif';
                    ctx.textAlign = 'center';
                    ctx.fillText('🐑 羊羊消 🐑', 360, 130);
                    ctx.fillStyle = '#333';
                    ctx.font = 'bold 26px sans-serif';
                    ctx.fillText(line, 360, 210);
                    ctx.fillStyle = '#888';
                    ctx.font = '20px sans-serif';
                    ctx.fillText(`第${level}关`, 360, 280);
                    const url = canvas.toDataURL('image/png');
                    const a = doc.createElement('a');
                    a.href = url;
                    a.download = '羊羊消-挑战.png';
                    doc.body.appendChild(a);
                    a.click();
                    doc.body.removeChild(a);
                    this.showToast('挑战图已保存');
                    return;
                }
            }
        } catch { /* fall through */ }
        // Fallback: toast the challenge text (native / no DOM)
        this.showToast(line);
    }

    private _roundRect(ctx: any, x: number, y: number, w: number, h: number, r: number) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y, x + w, y + h, r);
        ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r);
        ctx.arcTo(x, y, x + w, y, r);
        ctx.closePath();
    }

    // ─── UI helpers ───
    private _makeLabel(name: string, text: string, size: number, color: Color, x: number, y: number) {
        const n = new Node(name);
        n.layer = Layers.Enum.UI_2D;
        const ut = n.addComponent(UITransform);
        ut.setContentSize(400, size + 12);
        n.setPosition(x, y, 0);
        const lab = n.addComponent(Label);
        lab.string = text;
        lab.fontSize = size;
        lab.lineHeight = size + 8;
        lab.horizontalAlign = Label.HorizontalAlign.CENTER;
        lab.verticalAlign = Label.VerticalAlign.CENTER;
        lab.color = color;
        lab.overflow = Label.Overflow.NONE;
        return { node: n, label: lab };
    }

    private _makeButton(
        name: string, text: string, w: number, h: number,
        bgColor: Color, x: number, y: number, onClick: () => void,
        textColor?: Color, borderColor?: Color
    ): Node {
        const n = new Node(name);
        n.layer = Layers.Enum.UI_2D;
        const ut = n.addComponent(UITransform);
        ut.setContentSize(w, h);
        n.setPosition(x, y, 0);
        const g = n.addComponent(Graphics);
        const isLight = bgColor.r > 240 && bgColor.g > 240;
        g.fillColor = bgColor;
        g.roundRect(-w / 2, -h / 2, w, h, 12);
        g.fill();
        if (borderColor || isLight) {
            g.strokeColor = borderColor || new Color(129, 199, 132, 255);
            g.lineWidth = 2;
            g.roundRect(-w / 2, -h / 2, w, h, 12);
            g.stroke();
        }
        const lab = n.addComponent(Label);
        lab.string = text;
        lab.fontSize = Math.min(22, Math.floor(h * 0.42));
        lab.lineHeight = h;
        lab.horizontalAlign = Label.HorizontalAlign.CENTER;
        lab.verticalAlign = Label.VerticalAlign.CENTER;
        lab.color = textColor || (isLight ? new Color(46, 125, 50, 255) : Color.WHITE);
        lab.overflow = Label.Overflow.SHRINK;
        const btn = n.addComponent(Button);
        btn.transition = Button.Transition.SCALE;
        btn.zoomScale = 0.96;
        n.on(Button.EventType.CLICK, onClick, this);
        return n;
    }
}
