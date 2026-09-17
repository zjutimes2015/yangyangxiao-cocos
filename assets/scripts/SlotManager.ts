import {
    _decorator, Component, Node, UITransform, Graphics, Label, Color,
    tween, UIOpacity, Vec3, Layers
} from 'cc';
import type { GameManager } from './GameManager';
import type { UIManager } from './UIManager';

const { ccclass } = _decorator;

export const SLOT_COUNT = 7;

@ccclass('SlotManager')
export class SlotManager extends Component {
    slotRoot: Node | null = null;
    slots: string[] = [];
    private _cellNodes: Node[] = [];
    private _game: GameManager | null = null;
    private _ui: UIManager | null = null;
    private _busyClear = false;

    cellW = 56;
    cellH = 62;
    gap = 10;

    bind(game: GameManager, ui: UIManager) {
        this._game = game;
        this._ui = ui;
    }

    setSlotRoot(root: Node) {
        this.slotRoot = root;
        this._buildCells();
    }

    private _buildCells() {
        if (!this.slotRoot) return;
        this.slotRoot.removeAllChildren();
        this._cellNodes = [];

        const totalW = SLOT_COUNT * this.cellW + (SLOT_COUNT - 1) * this.gap;
        const bg = new Node('SlotsBg');
        bg.layer = Layers.Enum.UI_2D;
        const bgUt = bg.addComponent(UITransform);
        bgUt.setContentSize(totalW + 28, this.cellH + 24);
        const bgG = bg.addComponent(Graphics);
        bgG.fillColor = new Color(255, 255, 255, 190);
        bgG.roundRect(-(totalW + 28) / 2, -(this.cellH + 24) / 2, totalW + 28, this.cellH + 24, 14);
        bgG.fill();
        bgG.strokeColor = new Color(165, 214, 167, 255);
        bgG.lineWidth = 2;
        bgG.roundRect(-(totalW + 28) / 2, -(this.cellH + 24) / 2, totalW + 28, this.cellH + 24, 14);
        bgG.stroke();
        this.slotRoot.addChild(bg);

        const startX = -totalW / 2 + this.cellW / 2;
        for (let i = 0; i < SLOT_COUNT; i++) {
            const cell = new Node(`Slot_${i}`);
            cell.layer = Layers.Enum.UI_2D;
            const ut = cell.addComponent(UITransform);
            ut.setContentSize(this.cellW, this.cellH);
            cell.setPosition(startX + i * (this.cellW + this.gap), 0, 0);
            const g = cell.addComponent(Graphics);
            this._drawEmptyCell(g);
            bg.addChild(cell);
            this._cellNodes.push(cell);
        }
    }

    private _drawEmptyCell(g: Graphics) {
        g.clear();
        g.fillColor = new Color(241, 248, 233, 255);
        g.roundRect(-this.cellW / 2, -this.cellH / 2, this.cellW, this.cellH, 8);
        g.fill();
        g.strokeColor = new Color(165, 214, 167, 255);
        g.lineWidth = 2;
        // dashed look approximated by solid light border
        g.roundRect(-this.cellW / 2, -this.cellH / 2, this.cellW, this.cellH, 8);
        g.stroke();
    }

    private _drawFilledCell(g: Graphics) {
        g.clear();
        g.fillColor = new Color(255, 255, 255, 255);
        g.roundRect(-this.cellW / 2, -this.cellH / 2, this.cellW, this.cellH, 8);
        g.fill();
        g.strokeColor = new Color(129, 199, 132, 255);
        g.lineWidth = 2;
        g.roundRect(-this.cellW / 2, -this.cellH / 2, this.cellW, this.cellH, 8);
        g.stroke();
    }

    reset() {
        this.slots = [];
        this.renderSlots();
    }

    isFull(): boolean {
        return this.slots.length >= SLOT_COUNT;
    }

    length(): number {
        return this.slots.length;
    }

    getSlots(): string[] {
        return this.slots.slice();
    }

    setSlots(arr: string[]) {
        this.slots = arr.slice();
        this.renderSlots();
    }

    /** Insert emoji next to same group (yang-style grouping) */
    insert(emoji: string) {
        const filled = this.slots.slice();
        let insertAt = filled.length;
        for (let i = filled.length - 1; i >= 0; i--) {
            if (filled[i] === emoji) { insertAt = i + 1; break; }
        }
        filled.splice(insertAt, 0, emoji);
        this.slots = filled;
        this.renderSlots();
    }

    renderSlots() {
        if (!this.slotRoot) return;
        if (this._cellNodes.length === 0) this._buildCells();
        for (let i = 0; i < SLOT_COUNT; i++) {
            const cell = this._cellNodes[i];
            if (!cell) continue;
            // clear emoji children
            const kids = cell.children.slice();
            for (const k of kids) k.destroy();
            const g = cell.getComponent(Graphics);
            if (!g) continue;
            if (this.slots[i]) {
                this._drawFilledCell(g);
                const labelN = new Node('Emoji');
                labelN.layer = Layers.Enum.UI_2D;
                const lut = labelN.addComponent(UITransform);
                lut.setContentSize(this.cellW, this.cellH);
                const lab = labelN.addComponent(Label);
                lab.string = this.slots[i];
                lab.fontSize = 28;
                lab.lineHeight = this.cellH;
                lab.horizontalAlign = Label.HorizontalAlign.CENTER;
                lab.verticalAlign = Label.VerticalAlign.CENTER;
                lab.color = new Color(40, 40, 40, 255);
                cell.addChild(labelN);
                const op = labelN.addComponent(UIOpacity);
                op.opacity = 0;
                tween(op).to(0.18, { opacity: 255 }).start();
                tween(labelN).set({ scale: new Vec3(0.4, 0.4, 1) }).to(0.18, { scale: new Vec3(1, 1, 1) }, { easing: 'backOut' }).start();
            } else {
                this._drawEmptyCell(g);
            }
        }
    }

    /** Clear triples recursively; calls done when finished */
    clearTriples(done?: () => void) {
        const slots = this.slots;
        let found = -1;
        for (let i = 0; i <= slots.length - 3; i++) {
            if (slots[i] && slots[i] === slots[i + 1] && slots[i] === slots[i + 2]) {
                found = i;
                break;
            }
        }
        if (found < 0) {
            this.renderSlots();
            if (done) done();
            return;
        }
        // animate clear
        for (let k = found; k < found + 3 && k < this._cellNodes.length; k++) {
            const cell = this._cellNodes[k];
            const emoji = cell?.getChildByName('Emoji');
            if (emoji) {
                tween(emoji)
                    .to(0.17, { scale: new Vec3(1.25, 1.25, 1) })
                    .to(0.17, { scale: new Vec3(0, 0, 1) })
                    .start();
                const op = emoji.getComponent(UIOpacity);
                if (op) tween(op).delay(0.17).to(0.17, { opacity: 0 }).start();
            }
        }
        this.scheduleOnce(() => {
            this.slots.splice(found, 3);
            if (this._game) this._game.addScore(30);
            this.renderSlots();
            this.clearTriples(done);
        }, 0.36);
    }

    hasClearableTriple(): boolean {
        const s = this.slots;
        for (let i = 0; i <= s.length - 3; i++) {
            if (s[i] === s[i + 1] && s[i] === s[i + 2]) return true;
        }
        return false;
    }

    /** 移除: discard first up to 3 slot cards */
    removeFirst3(): number {
        if (this.slots.length === 0) return 0;
        const n = Math.min(3, this.slots.length);
        this.slots.splice(0, n);
        this.renderSlots();
        return n;
    }
}
