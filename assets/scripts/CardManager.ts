import {
    _decorator, Component, Node, UITransform, Graphics, Label, Color,
    EventTouch, Vec3, tween, UIOpacity, BlockInputEvents, Layers
} from 'cc';
import type { SlotManager } from './SlotManager';
import type { UIManager } from './UIManager';
import type { GameManager } from './GameManager';

const { ccclass, property } = _decorator;

export interface CardData {
    id: number;
    emoji: string;
    layer: number;
    x: number;
    y: number;
    w: number;
    h: number;
    homeX: number;
    homeY: number;
    homeLayer: number;
    removed: boolean;
    node: Node | null;
    blocked: boolean;
}

export interface LayerPlan {
    count: number;
    cols: number;
    ox: number;
    oy: number;
    gapX: number;
    gapY: number;
}

@ccclass('CardManager')
export class CardManager extends Component {
    boardRoot: Node | null = null;
    cards: CardData[] = [];
    cardW = 56;
    cardH = 62;
    boardW = 780;
    boardH = 420;
    private _nextId = 1;
    private _game: GameManager | null = null;
    private _slots: SlotManager | null = null;
    private _ui: UIManager | null = null;

    bind(game: GameManager, slots: SlotManager, ui: UIManager) {
        this._game = game;
        this._slots = slots;
        this._ui = ui;
    }

    setBoardRoot(root: Node) {
        this.boardRoot = root;
    }

    clearBoard() {
        if (this.boardRoot) this.boardRoot.removeAllChildren();
        this.cards = [];
    }

    buildDeck(types: number, copies: number, emojis: string[]): string[] {
        const pool = emojis.slice(0, types);
        const deck: string[] = [];
        for (const e of pool) {
            for (let k = 0; k < copies; k++) deck.push(e);
        }
        return this.shuffleArray(deck);
    }

    shuffleArray<T>(arr: T[]): T[] {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
        }
        return arr;
    }

    layoutCards(deck: string[], layers: LayerPlan[]): CardData[] {
        const size = { w: this.boardW, h: this.boardH };
        const cw = this.cardW;
        const ch = this.cardH;
        const cards: CardData[] = [];
        let idx = 0;
        for (let L = 0; L < layers.length; L++) {
            const plan = layers[L];
            let placed = 0;
            let row = 0;
            while (placed < plan.count && idx < deck.length) {
                const colsThisRow = Math.min(plan.cols, plan.count - placed);
                const offsetCols = (plan.cols - colsThisRow) * 0.5;
                for (let c = 0; c < colsThisRow && placed < plan.count && idx < deck.length; c++) {
                    const topFactor = L / Math.max(1, layers.length - 1);
                    const jitterX = (Math.random() - 0.5) * (8 + topFactor * 6);
                    const jitterY = (Math.random() - 0.5) * (6 + topFactor * 4);
                    let x = (plan.ox + (c + offsetCols) * plan.gapX) * size.w + jitterX;
                    let y = (plan.oy + row * plan.gapY) * size.h + jitterY;
                    x = Math.max(0, Math.min(size.w - cw, x));
                    y = Math.max(0, Math.min(size.h - ch, y));
                    // Convert: layout uses top-left origin; Cocos UI uses center of boardRoot
                    const lx = x - size.w / 2 + cw / 2;
                    const ly = size.h / 2 - y - ch / 2;
                    cards.push({
                        id: this._nextId++,
                        emoji: deck[idx++],
                        layer: L,
                        x: lx, y: ly, w: cw, h: ch,
                        homeX: lx, homeY: ly, homeLayer: L,
                        removed: false, node: null, blocked: false
                    });
                    placed++;
                }
                row++;
            }
        }
        while (idx < deck.length) {
            const xx = size.w * 0.4 + (Math.random() - 0.5) * 20;
            const yy = 4 + (Math.random() - 0.5) * 8;
            const lx = xx - size.w / 2 + cw / 2;
            const ly = size.h / 2 - yy - ch / 2;
            cards.push({
                id: this._nextId++,
                emoji: deck[idx++],
                layer: layers.length,
                x: lx, y: ly, w: cw, h: ch,
                homeX: lx, homeY: ly, homeLayer: layers.length,
                removed: false, node: null, blocked: false
            });
        }
        return cards;
    }

    spawnCards(deck: string[], layers: LayerPlan[]) {
        if (!this.boardRoot) {
            console.warn('[CardManager] boardRoot missing — skip spawn');
            return;
        }
        this.clearBoard();
        this.cards = this.layoutCards(deck, layers);
        for (let i = 0; i < this.cards.length; i++) {
            this._createCardNode(this.cards[i], i);
        }
        this.updateBlockedState();
    }

    private _createCardNode(card: CardData, index: number) {
        if (!this.boardRoot) return;
        const n = new Node(`Card_${card.id}`);
        n.layer = Layers.Enum.UI_2D;
        const ut = n.addComponent(UITransform);
        ut.setContentSize(card.w, card.h);
        n.setPosition(card.x, card.y, 0);
        n.setSiblingIndex(10 + card.layer * 10 + (index % 10));

        // soft shadow
        const shadow = new Node('Shadow');
        shadow.layer = Layers.Enum.UI_2D;
        const sut = shadow.addComponent(UITransform);
        sut.setContentSize(card.w, card.h);
        shadow.setPosition(3, -3, 0);
        const sg = shadow.addComponent(Graphics);
        sg.fillColor = new Color(0, 0, 0, 45);
        sg.roundRect(-card.w / 2, -card.h / 2, card.w, card.h, 10);
        sg.fill();
        n.addChild(shadow);

        // body
        const body = new Node('Body');
        body.layer = Layers.Enum.UI_2D;
        const but = body.addComponent(UITransform);
        but.setContentSize(card.w, card.h);
        const g = body.addComponent(Graphics);
        g.fillColor = new Color(255, 255, 255, 255);
        g.roundRect(-card.w / 2, -card.h / 2, card.w, card.h, 10);
        g.fill();
        g.strokeColor = new Color(200, 230, 201, 255);
        g.lineWidth = 2;
        g.roundRect(-card.w / 2, -card.h / 2, card.w, card.h, 10);
        g.stroke();
        n.addChild(body);

        const labelN = new Node('Emoji');
        labelN.layer = Layers.Enum.UI_2D;
        const lut = labelN.addComponent(UITransform);
        lut.setContentSize(card.w, card.h);
        const lab = labelN.addComponent(Label);
        lab.string = card.emoji;
        lab.fontSize = card.w < 50 ? 26 : 30;
        lab.lineHeight = card.h;
        lab.horizontalAlign = Label.HorizontalAlign.CENTER;
        lab.verticalAlign = Label.VerticalAlign.CENTER;
        lab.color = Color.WHITE;
        lab.overflow = Label.Overflow.NONE;
        n.addChild(labelN);

        const op = n.addComponent(UIOpacity);
        op.opacity = 255;

        n.on(Node.EventType.TOUCH_END, (e: EventTouch) => {
            e.propagationStopped = true;
            this.onCardClick(card.id);
        }, this);

        this.boardRoot.addChild(n);
        card.node = n;
    }

    isOverlapped(card: CardData, others: CardData[]): boolean {
        // Card positions are center-based; convert to AABB
        const cx = card.x;
        const cy = card.y;
        const halfW = card.w / 2;
        const halfH = card.h / 2;
        const left = card.x - halfW;
        const right = card.x + halfW;
        const bottom = card.y - halfH;
        const top = card.y + halfH;

        for (const o of others) {
            if (o.removed || o.id === card.id) continue;
            if (o.layer <= card.layer) continue;
            const ol = o.x - o.w / 2;
            const or = o.x + o.w / 2;
            const ob = o.y - o.h / 2;
            const ot = o.y + o.h / 2;
            // center point inside higher card
            if (cx >= ol && cx <= or && cy >= ob && cy <= ot) return true;
            const ox = Math.max(0, Math.min(right, or) - Math.max(left, ol));
            const oy = Math.max(0, Math.min(top, ot) - Math.max(bottom, ob));
            if (ox * oy > card.w * card.h * 0.28) return true;
        }
        return false;
    }

    updateBlockedState() {
        const live = this.cards.filter(c => !c.removed);
        for (const c of live) {
            if (!c.node) continue;
            const blocked = this.isOverlapped(c, live);
            c.blocked = blocked;
            const op = c.node.getComponent(UIOpacity);
            if (op) op.opacity = blocked ? 110 : 255;
            // dim body
            const body = c.node.getChildByName('Body');
            if (body) {
                const g = body.getComponent(Graphics);
                if (g) {
                    g.clear();
                    if (blocked) {
                        g.fillColor = new Color(220, 220, 220, 255);
                        g.roundRect(-c.w / 2, -c.h / 2, c.w, c.h, 10);
                        g.fill();
                        g.strokeColor = new Color(180, 180, 180, 255);
                    } else {
                        g.fillColor = new Color(255, 255, 255, 255);
                        g.roundRect(-c.w / 2, -c.h / 2, c.w, c.h, 10);
                        g.fill();
                        g.strokeColor = new Color(102, 187, 106, 255);
                    }
                    g.lineWidth = 2;
                    g.roundRect(-c.w / 2, -c.h / 2, c.w, c.h, 10);
                    g.stroke();
                }
            }
        }
    }

    onCardClick(id: number) {
        if (!this._game || this._game.isBusy() || this._game.isOver() || this._game.isBlocked()) return;
        const card = this.cards.find(c => c.id === id);
        if (!card || card.removed || !card.node || card.blocked) return;
        if (!this._slots) return;
        if (this._slots.isFull()) {
            this._game.triggerLose();
            return;
        }
        this._game.pickCard(card);
    }

    remainingCount(): number {
        return this.cards.filter(c => !c.removed).length;
    }

    allCleared(): boolean {
        return this.cards.every(c => c.removed);
    }

    /** 洗牌: reshuffle remaining tower only */
    shuffleRemaining(layers: LayerPlan[]): boolean {
        const remaining = this.cards.filter(c => !c.removed);
        if (remaining.length === 0) return false;
        const emojis = remaining.map(c => c.emoji);
        this.shuffleArray(emojis);
        // remove old remaining nodes
        for (const c of remaining) {
            if (c.node) {
                c.node.destroy();
                c.node = null;
            }
            c.removed = true; // drop from live list
        }
        const kept = this.cards.filter(c => c.removed && !remaining.includes(c));
        // also keep already-picked (removed) placeholders — remaining marked removed above
        const allRemoved = this.cards.filter(c => c.removed);
        const fresh = this.layoutCards(emojis, layers);
        this.cards = allRemoved.concat(fresh);
        for (let i = 0; i < fresh.length; i++) {
            this._createCardNode(fresh[i], i);
        }
        this.updateBlockedState();
        return true;
    }

    markRemoved(card: CardData) {
        card.removed = true;
        if (card.node) {
            const n = card.node;
            card.node = null;
            const op = n.getComponent(UIOpacity) || n.addComponent(UIOpacity);
            tween(op).to(0.18, { opacity: 0 }).call(() => {
                if (n.isValid) n.destroy();
            }).start();
        }
    }

    restoreCard(card: CardData) {
        card.removed = false;
        card.x = card.homeX;
        card.y = card.homeY;
        card.layer = card.homeLayer;
        if (!card.node) {
            this._createCardNode(card, card.layer);
        } else {
            card.node.setPosition(card.x, card.y, 0);
            const op = card.node.getComponent(UIOpacity);
            if (op) op.opacity = 255;
        }
    }

    getRemovedFlags(): boolean[] {
        return this.cards.map(c => c.removed);
    }

    applyRemovedFlags(flags: boolean[]) {
        for (let i = 0; i < this.cards.length && i < flags.length; i++) {
            this.cards[i].removed = flags[i];
        }
    }

    findById(id: number): CardData | undefined {
        return this.cards.find(c => c.id === id);
    }

    reRenderAll() {
        if (this.boardRoot) this.boardRoot.removeAllChildren();
        for (let i = 0; i < this.cards.length; i++) {
            const c = this.cards[i];
            c.node = null;
            if (!c.removed) this._createCardNode(c, i);
        }
        this.updateBlockedState();
    }
}
