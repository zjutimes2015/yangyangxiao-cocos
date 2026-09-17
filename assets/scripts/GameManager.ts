import {
    _decorator, Component, Node, UITransform, Widget, Canvas, Camera,
    director, view, ResolutionPolicy, Layers, find, Color
} from 'cc';
import { CardManager, CardData, LayerPlan } from './CardManager';
import { SlotManager } from './SlotManager';
import { UIManager } from './UIManager';

const { ccclass } = _decorator;

const ALL_EMOJIS = [
    '🐑', '🌿', '🥕', '🌽', '🍎',
    '🌸', '🍀', '⭐', '🌙', '🔥',
    '💧', '🎯', '🧩', '🎲', '🔔'
];

const PROVINCES = [
    '北京', '上海', '天津', '重庆', '河北', '山西', '辽宁', '吉林',
    '黑龙江', '江苏', '浙江', '安徽', '福建', '江西', '山东', '河南',
    '湖北', '湖南', '广东', '广西', '海南', '四川', '贵州', '云南',
    '陕西', '甘肃', '青海', '内蒙古', '宁夏', '新疆'
];

/** L1 teaching: 5×3=15; L2: exactly 45 = 15×3 */
const LEVELS: Record<number, {
    name: string;
    types: number;
    copies: number;
    clearBonus: number;
    layers: LayerPlan[];
}> = {
    1: {
        name: '第1关',
        types: 5,
        copies: 3,
        clearBonus: 100,
        layers: [
            { count: 2, cols: 2, ox: 0.36, oy: 0.55, gapX: 0.28, gapY: 0.16 },
            { count: 4, cols: 3, ox: 0.22, oy: 0.38, gapX: 0.26, gapY: 0.15 },
            { count: 5, cols: 3, ox: 0.18, oy: 0.22, gapX: 0.28, gapY: 0.14 },
            { count: 3, cols: 3, ox: 0.24, oy: 0.10, gapX: 0.26, gapY: 0.12 },
            { count: 1, cols: 1, ox: 0.42, oy: 0.00, gapX: 0.30, gapY: 0.10 }
        ]
    },
    2: {
        name: '第2关',
        types: 15,
        copies: 3, // exactly 45 cards
        clearBonus: 300,
        // spindle: front-loose back-tight, total ~45
        layers: [
            { count: 3,  cols: 3, ox: 0.30, oy: 0.70, gapX: 0.20, gapY: 0.10 },
            { count: 5,  cols: 4, ox: 0.18, oy: 0.58, gapX: 0.18, gapY: 0.10 },
            { count: 7,  cols: 4, ox: 0.14, oy: 0.46, gapX: 0.18, gapY: 0.09 },
            { count: 9,  cols: 5, ox: 0.08, oy: 0.34, gapX: 0.17, gapY: 0.09 },
            { count: 9,  cols: 5, ox: 0.08, oy: 0.22, gapX: 0.17, gapY: 0.08 },
            { count: 7,  cols: 4, ox: 0.16, oy: 0.12, gapX: 0.18, gapY: 0.08 },
            { count: 5,  cols: 3, ox: 0.26, oy: 0.04, gapX: 0.20, gapY: 0.07 }
            // 3+5+7+9+9+7+5 = 45
        ]
    }
};

interface HistorySnap {
    cardId: number;
    slots: string[];
    remain: number;
    score: number;
    cardsRemoved: boolean[];
}

@ccclass('GameManager')
export class GameManager extends Component {
    private _cards: CardManager | null = null;
    private _slots: SlotManager | null = null;
    private _ui: UIManager | null = null;

    private level = 1;
    private busy = false;
    private over = false;
    private sloganBlocking = true;
    private shuffleLeft = 1;
    private removeLeft = 1;
    private undoLeft = 1;
    private reviveLeft = 1;
    private history: HistorySnap | null = null;
    private score = 0;
    private elapsedSec = 0;
    private timerRunning = false;
    private remain = 0;
    private started = false;

    designW = 1280;
    designH = 720;

    onLoad() {
        view.setDesignResolutionSize(this.designW, this.designH, ResolutionPolicy.SHOW_ALL);
        this.ensureHierarchy();
        this._cards = this.getComponent(CardManager) || this.addComponent(CardManager);
        this._slots = this.getComponent(SlotManager) || this.addComponent(SlotManager);
        this._ui = this.getComponent(UIManager) || this.addComponent(UIManager);

        const board = find('Canvas/BoardRoot') || this.node.scene?.getChildByName('Canvas')?.getChildByName('BoardRoot') || null;
        const slot = find('Canvas/SlotRoot') || null;
        const ui = find('Canvas/UIRoot') || null;

        if (board) this._cards.setBoardRoot(board);
        if (slot) this._slots.setSlotRoot(slot);
        if (ui) this._ui.setUIRoot(ui);

        this._cards.bind(this, this._slots, this._ui);
        this._slots.bind(this, this._ui);
        this._ui.bind(this);

        // Board safe zone: below compact HUD with clear gap
        if (board) {
            board.setPosition( -40, 30, 0); // slightly left to leave room for right items
            const but = board.getComponent(UITransform) || board.addComponent(UITransform);
            but.setContentSize(780, 420);
            this._cards.boardW = 780;
            this._cards.boardH = 420;
        }
        if (slot) {
            slot.setPosition(0, -this.designH / 2 + 90, 0);
        }
        if (ui) {
            ui.setSiblingIndex(100);
        }

        this._ui.buildAll();
        this._ui.showCover();
    }

    start() {
        // Cover waits for 开始 — do not auto-start level
    }

    /**
     * Belt-and-suspenders: create Canvas / BoardRoot / SlotRoot / UIRoot if missing.
     */
    ensureHierarchy() {
        let canvas = find('Canvas');
        if (!canvas) {
            canvas = new Node('Canvas');
            canvas.layer = Layers.Enum.UI_2D;
            const scene = director.getScene();
            if (scene) scene.addChild(canvas);
            else this.node.addChild(canvas);

            const ut = canvas.addComponent(UITransform);
            ut.setContentSize(this.designW, this.designH);
            const widget = canvas.addComponent(Widget);
            widget.isAlignTop = widget.isAlignBottom = widget.isAlignLeft = widget.isAlignRight = true;
            widget.top = widget.bottom = widget.left = widget.right = 0;
            widget.alignMode = Widget.AlignMode.ON_WINDOW_RESIZE;

            this.ensureCanvasCamera(canvas);
        } else {
            // ensure stretch widget
            let w = canvas.getComponent(Widget);
            if (!w) {
                w = canvas.addComponent(Widget);
                w.isAlignTop = w.isAlignBottom = w.isAlignLeft = w.isAlignRight = true;
                w.top = w.bottom = w.left = w.right = 0;
            }
            if (!canvas.getComponent(UITransform)) {
                const ut = canvas.addComponent(UITransform);
                ut.setContentSize(this.designW, this.designH);
            }
            canvas.layer = Layers.Enum.UI_2D;
            this.ensureCanvasCamera(canvas);
        }

        const ensureChild = (name: string, sibling = 1) => {
            let n = canvas!.getChildByName(name);
            if (!n) {
                n = new Node(name);
                n.layer = Layers.Enum.UI_2D;
                n.addComponent(UITransform).setContentSize(100, 100);
                canvas!.addChild(n);
            }
            n.setSiblingIndex(sibling);
            return n;
        };

        // Z-order: Bg(0) → Board+Slots middle → UI top
        // BgRoot created by UIManager
        const board = ensureChild('BoardRoot', 2);
        const slot = ensureChild('SlotRoot', 3);
        const ui = ensureChild('UIRoot', 10);

        board.getComponent(UITransform)!.setContentSize(780, 420);
        slot.getComponent(UITransform)!.setContentSize(520, 90);
        ui.getComponent(UITransform)!.setContentSize(this.designW, this.designH);

        // Ensure this GameController node exists / has components
        let gc = find('GameController') || this.node;
        if (gc.name !== 'GameController' && !find('GameController')) {
            // rename or create
            if (this.node.parent) {
                this.node.name = 'GameController';
            }
        }
        // Re-assert Camera after sibling reorders from ensureChild
        this.ensureCanvasCamera(canvas!);
        return { canvas, board, slot, ui };
    }

    onStartPressed() {
        this.started = true;
        this.startLevel(1, true);
    }

    restartFromCover(_showSlogan: boolean) {
        // used by HUD restart — goes to L1
    }

    isBusy() { return this.busy; }
    isOver() { return this.over; }
    isBlocked() { return this.sloganBlocking; }

    addScore(n: number) {
        this.score += n;
    }

    startLevel(level: number, withSlogan: boolean) {
        this._ui?.hideLose();
        this._ui?.hideWin();
        this._ui?.hideAd();
        this.stopTimer();

        this.level = level;
        this.busy = false;
        this.over = false;
        this.history = null;
        this.shuffleLeft = 1;
        this.removeLeft = 1;
        this.undoLeft = 1;
        this.reviveLeft = 1;
        this.elapsedSec = 0;
        this._ui?.updateTimer(0);
        if (level === 1) this.score = 0;

        this._ui?.updateLevel(level);
        this._ui?.setGameplayVisible(true);

        const cfg = LEVELS[level];
        const deck = this._cards!.buildDeck(cfg.types, cfg.copies, ALL_EMOJIS);
        this.remain = deck.length;
        this._ui?.updateRemain(this.remain);
        this._slots!.reset();
        this._cards!.spawnCards(deck, cfg.layers);

        this._refreshItems();

        if (withSlogan) {
            this.sloganBlocking = true;
            this.pauseTimer();
            this._ui?.showSlogan(() => {
                this.sloganBlocking = false;
                this.startTimer();
                this._refreshItems();
            });
        } else {
            this.sloganBlocking = false;
            this.startTimer();
            this._refreshItems();
        }
    }

    restartCurrent() {
        this.score = 0;
        this.startLevel(this.level, true);
    }

    pickCard(card: CardData) {
        this.busy = true;
        this.pushHistory(card.id);
        this._cards!.markRemoved(card);
        this._slots!.insert(card.emoji);
        this.remain = Math.max(0, this.remain - 1);
        this._ui?.updateRemain(this.remain);

        this.scheduleOnce(() => {
            this._cards!.updateBlockedState();
            this._slots!.clearTriples(() => {
                this.busy = false;
                this._refreshItems();
                this.checkEnd();
            });
        }, 0.2);
    }

    pushHistory(cardId: number) {
        this.history = {
            cardId,
            slots: this._slots!.getSlots(),
            remain: this.remain,
            score: this.score,
            cardsRemoved: this._cards!.getRemovedFlags()
        };
    }

    checkEnd() {
        if (this.over) return;
        if (this._cards!.allCleared() && this._slots!.length() === 0) {
            this.triggerWin();
            return;
        }
        if (this._slots!.isFull() && !this._slots!.hasClearableTriple()) {
            this.triggerLose();
        }
    }

    triggerLose() {
        if (this.over) return;
        this.over = true;
        this.pauseTimer();
        this._refreshItems();
        this._ui?.showLose(this.reviveLeft > 0);
    }

    triggerWin() {
        if (this.over) return;
        this.over = true;
        this.pauseTimer();
        this.score += LEVELS[this.level].clearBonus;
        // High score: level cleared + time
        this._ui?.saveHighScoreIfBetter(this.level, this.elapsedSec);

        if (this.level === 1) {
            this._ui?.showWin({
                icon: '🐑',
                msg: '第1关轻松过关！准备好加入更深的羊群了吗？',
                rank: '',
                actionText: '下一关'
            });
        } else {
            const prov = PROVINCES[Math.floor(Math.random() * PROVINCES.length)];
            const rank = 12 + Math.floor(Math.random() * 988);
            let label: string;
            if (['北京', '上海', '天津', '重庆'].indexOf(prov) >= 0) label = prov + '市';
            else if (prov === '内蒙古') label = '内蒙古自治区';
            else if (prov === '广西') label = '广西壮族自治区';
            else if (prov === '宁夏') label = '宁夏回族自治区';
            else if (prov === '新疆') label = '新疆维吾尔自治区';
            else label = prov + '省';
            this._ui?.showWin({
                icon: '🏆',
                msg: '',
                rank: `恭喜！你已加入${label}羊群战队，当前省份排名第${rank}名`,
                actionText: '再来一次'
            });
        }
    }

    onWinAction() {
        this._ui?.hideWin();
        if (this.level === 1) {
            this.startLevel(2, true);
        } else {
            this.startLevel(1, true);
        }
    }

    useShuffle() {
        if (this.shuffleLeft <= 0 || this.busy || this.over || this.sloganBlocking) return;
        const cfg = LEVELS[this.level];
        const ok = this._cards!.shuffleRemaining(cfg.layers);
        if (!ok) return;
        this.shuffleLeft = 0;
        this.history = null;
        this._refreshItems();
        this._ui?.showToast('已洗牌');
    }

    useRemove() {
        if (this.removeLeft <= 0 || this.busy || this.over || this.sloganBlocking) return;
        if (this._slots!.length() === 0) return;
        this.removeLeft = 0;
        this.history = null;
        const n = this._slots!.removeFirst3();
        this.addScore(5 * n);
        this._refreshItems();
        this._ui?.showToast(`已移除 ${n} 张`);
        this.checkEnd();
    }

    useUndo() {
        if (this.undoLeft <= 0 || this.busy || this.over || this.sloganBlocking) return;
        if (!this.history) return;
        const h = this.history;
        this.undoLeft = 0;
        this.history = null;

        this._cards!.applyRemovedFlags(h.cardsRemoved);
        const card = this._cards!.findById(h.cardId);
        if (card) {
            // Ensure card is restored on board
            for (const c of this._cards!.cards) {
                if (!c.removed && !c.node) this._cards!.restoreCard(c);
            }
            card.removed = false;
            this._cards!.restoreCard(card);
        }
        // Re-render to sync nodes with flags
        this._cards!.reRenderAll();
        this._slots!.setSlots(h.slots);
        this.remain = h.remain;
        this.score = h.score;
        this._ui?.updateRemain(this.remain);
        this._refreshItems();
        this._ui?.showToast('已撤回');
    }

    useRevive() {
        if (this.reviveLeft <= 0) {
            this._ui?.showToast('本关已复活过');
            return;
        }
        this.pauseTimer();
        // TODO: replace with real ad SDK
        this.showRewardedAd(
            () => {
                this.reviveLeft = 0;
                this._slots!.reset();
                this.history = null;
                this.over = false;
                this.busy = false;
                this._ui?.hideLose();
                this._cards!.updateBlockedState();
                this._refreshItems();
                this.resumeTimer();
                if (!this.timerRunning) this.startTimer();
                this._ui?.showToast('复活成功！槽位已清空');
            },
            () => {
                this._ui?.showToast('广告未完成');
            }
        );
    }

    /**
     * TODO: replace with real ad SDK
     */
    showRewardedAd(onSuccess: () => void, onFail: () => void) {
        this._ui?.showAdCountdown(() => {
            onSuccess();
        });
        // onFail reserved for real SDK failure path
        void onFail;
    }

    shareChallenge() {
        this._ui?.exportSharePng(this.elapsedSec, this.level);
    }

    private _refreshItems() {
        this._ui?.updateItemButtons(
            this.shuffleLeft, this.removeLeft, this.undoLeft,
            !!this.history, this.busy, this.over, this.sloganBlocking
        );
    }

    // ─── Timer ───
    startTimer() {
        this.stopTimer();
        this.timerRunning = true;
        this.schedule(this._tick, 1);
    }
    private _tick = () => {
        if (!this.timerRunning) return;
        this.elapsedSec += 1;
        this._ui?.updateTimer(this.elapsedSec);
    };
    stopTimer() {
        this.timerRunning = false;
        this.unschedule(this._tick);
    }
    pauseTimer() { this.timerRunning = false; }
    resumeTimer() {
        if (!this.over && !this.sloganBlocking) {
            this.timerRunning = true;
            // ensure scheduled
            this.unschedule(this._tick);
            this.schedule(this._tick, 1);
        }
    }
    /**
     * Ensure Canvas has an orthographic UI Camera (editor/preview + runtime fallback).
     * Scene file already wires this; this keeps auto-created Canvas renderable too.
     */
    ensureCanvasCamera(canvas: Node) {
        let camNode = canvas.getChildByName('Camera');
        if (!camNode) {
            camNode = new Node('Camera');
            camNode.layer = Layers.Enum.UI_2D;
            canvas.insertChild(camNode, 0);
            camNode.setPosition(0, 0, 1000);
        } else {
            camNode.setSiblingIndex(0);
            if (camNode.position.z === 0) camNode.setPosition(0, 0, 1000);
        }

        let camera = camNode.getComponent(Camera);
        if (!camera) camera = camNode.addComponent(Camera);

        // Cocos 3.8: ProjectionType.ORTHO = 0; ClearFlag.SOLID_COLOR clears color+depth+stencil
        camera.projection = Camera.ProjectionType.ORTHO;
        camera.orthoHeight = this.designH / 2; // 360 for 720 design height
        camera.near = 1;
        camera.far = 2000;
        camera.clearFlags = Camera.ClearFlag.SOLID_COLOR;
        camera.clearColor = new Color(0xe8, 0xf5, 0xe9, 255);
        camera.visibility = Layers.Enum.UI_2D;
        camera.priority = 0;

        const canvasComp = canvas.getComponent(Canvas);
        if (canvasComp) {
            canvasComp.cameraComponent = camera;
            canvasComp.alignCanvasWithScreen = true;
        }
    }

}
