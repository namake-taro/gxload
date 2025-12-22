import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Clutter from 'gi://Clutter';
import St from 'gi://St';
import Gio from 'gi://Gio';

import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';

import {LoadGraph} from './loadGraph.js';
import {LoadMonitor} from './loadMonitor.js';

/**
 * XLoadButton - トップバーに表示されるボタン
 */
const XLoadButton = GObject.registerClass({
    GTypeName: 'XLoadButton',
}, class XLoadButton extends PanelMenu.Button {
    _init(extensionObject) {
        super._init(0.0, 'XLoad Monitor');

        this._extensionObject = extensionObject;
        this._settings = extensionObject.getSettings();

        // レイアウト: グラフ + 数値ラベル
        this._box = new St.BoxLayout({
            vertical: false,
            style_class: 'xload-panel-box',
        });

        // グラフコンポーネント
        this._graph = new LoadGraph(this._settings);
        this._box.add_child(this._graph);

        // 数値ラベル
        this._label = new St.Label({
            text: '0.00',
            y_align: Clutter.ActorAlign.CENTER,
            style_class: 'xload-panel-label',
        });
        this._box.add_child(this._label);

        this.add_child(this._box);

        // ロードモニター
        this._monitor = new LoadMonitor();

        // タイマー設定
        this._timerId = null;
        this._startTimer();

        // 設定変更の監視
        this._settingsChangedId = this._settings.connect('changed',
            this._onSettingsChanged.bind(this));

        // ポップアップメニューの設定
        this._setupPopupMenu();
    }

    /**
     * ポップアップメニューを設定
     */
    _setupPopupMenu() {
        // topの結果を表示するラベル
        this._topOutputLabel = new St.Label({
            text: 'Loading...',
            style_class: 'xload-top-output',
        });

        // BoxLayoutでラップ（サイズ制御用）
        const box = new St.BoxLayout({
            vertical: true,
            style_class: 'xload-top-container',
        });
        box.add_child(this._topOutputLabel);

        // メニューアイテムとしてラップ
        const menuItem = new PopupMenu.PopupBaseMenuItem({
            reactive: false,
            can_focus: false,
            style_class: 'xload-menu-item',
        });
        menuItem.add_child(box);
        this.menu.addMenuItem(menuItem);

        // 初期色を適用
        this._updateTopTextColor();

        // メニューが開かれたときにtopを実行（初回）
        this.menu.connect('open-state-changed', (menu, isOpen) => {
            if (isOpen) {
                this._updateTopOutput();
            }
        });
    }

    /**
     * topテキストの色を更新
     */
    _updateTopTextColor() {
        const color = this._settings.get_string('top-text-color');
        this._topOutputLabel.set_style(`color: ${color};`);
    }

    /**
     * topコマンドを実行して結果を更新
     */
    _updateTopOutput() {
        try {
            // top -b -n 1: バッチモードで1回だけ実行
            const proc = Gio.Subprocess.new(
                ['top', '-b', '-n', '1', '-w', '120'],
                Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE
            );

            proc.communicate_utf8_async(null, null, (proc, result) => {
                // メニューが閉じていたら更新しない
                if (!this.menu.isOpen) {
                    return;
                }

                try {
                    const [, stdout, stderr] = proc.communicate_utf8_finish(result);
                    if (stdout) {
                        // サマリー（最初の7行）とプロセス一覧（ヘッダー1行＋上位10プロセス）を抽出
                        const lines = stdout.split('\n');
                        const summaryLines = lines.slice(0, 7);
                        const processHeader = lines.find(line => line.includes('PID'));
                        const headerIndex = lines.indexOf(processHeader);
                        const processLines = headerIndex >= 0
                            ? lines.slice(headerIndex, headerIndex + 11)
                            : [];

                        const output = [...summaryLines, '', ...processLines].join('\n');
                        this._topOutputLabel.set_text(output);
                    } else {
                        this._topOutputLabel.set_text('Error: No output');
                    }
                } catch (e) {
                    this._topOutputLabel.set_text(`Error: ${e.message}`);
                }
            });
        } catch (e) {
            this._topOutputLabel.set_text(`Error: ${e.message}`);
        }
    }

    /**
     * タイマーを開始
     */
    _startTimer() {
        const interval = this._settings.get_int('update-interval');
        this._timerId = GLib.timeout_add_seconds(
            GLib.PRIORITY_DEFAULT,
            interval,
            () => {
                this._updateLoad();
                return GLib.SOURCE_CONTINUE;
            }
        );
        // 初回実行
        this._updateLoad();
    }

    /**
     * ロードアベレージを更新
     */
    _updateLoad() {
        this._monitor.getLoadAverage().then(loads => {
            const load1m = loads[0];
            this._label.set_text(load1m.toFixed(2));
            this._graph.addDataPoint(load1m);
        }).catch(e => {
            console.error('XLoad:', e);
        });

        // メニューが開いていればtopも更新
        if (this.menu.isOpen) {
            this._updateTopOutput();
        }
    }

    /**
     * 設定変更時のコールバック
     */
    _onSettingsChanged(settings, key) {
        this._graph.updateSettings();

        // update-intervalが変更された時のみタイマーを再起動
        if (key === 'update-interval') {
            this._restartTimer();
        }

        // top テキスト色の変更を反映
        if (key === 'top-text-color') {
            this._updateTopTextColor();
        }
    }

    /**
     * タイマーを再起動
     */
    _restartTimer() {
        if (this._timerId) {
            GLib.Source.remove(this._timerId);
            this._timerId = null;
        }
        this._startTimer();
    }

    /**
     * 破棄処理
     */
    destroy() {
        if (this._timerId) {
            GLib.Source.remove(this._timerId);
            this._timerId = null;
        }
        if (this._settingsChangedId) {
            this._settings.disconnect(this._settingsChangedId);
            this._settingsChangedId = null;
        }
        super.destroy();
    }
});

/**
 * XLoadExtension - メインエクステンションクラス
 */
export default class XLoadExtension extends Extension {
    /**
     * エクステンション有効化
     */
    enable() {
        this._button = new XLoadButton(this);
        Main.panel.addToStatusArea('xload-indicator', this._button);
    }

    /**
     * エクステンション無効化
     */
    disable() {
        if (this._button) {
            this._button.destroy();
            this._button = null;
        }
    }
}
