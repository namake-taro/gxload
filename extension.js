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
 * XLoadButton - Panel button that displays load average graph and label
 */
const XLoadButton = GObject.registerClass({
    GTypeName: 'XLoadButton',
}, class XLoadButton extends PanelMenu.Button {
    _init(extensionObject) {
        super._init(0.0, 'XLoad Monitor');

        this._extensionObject = extensionObject;
        this._settings = extensionObject.getSettings();

        this._box = new St.BoxLayout({
            vertical: false,
            style_class: 'xload-panel-box',
        });

        this._graph = new LoadGraph(this._settings);
        this._box.add_child(this._graph);

        this._label = new St.Label({
            text: '0.00',
            y_align: Clutter.ActorAlign.CENTER,
            style_class: 'xload-panel-label',
        });
        this._box.add_child(this._label);

        this.add_child(this._box);

        this._monitor = new LoadMonitor();

        this._timerId = null;
        this._startTimer();

        this._settingsChangedId = this._settings.connect('changed',
            this._onSettingsChanged.bind(this));

        this._setupPopupMenu();
    }

    _setupPopupMenu() {
        this._topOutputLabel = new St.Label({
            text: 'Loading...',
            style_class: 'xload-top-output',
        });

        const box = new St.BoxLayout({
            vertical: true,
            style_class: 'xload-top-container',
        });
        box.add_child(this._topOutputLabel);

        const menuItem = new PopupMenu.PopupBaseMenuItem({
            reactive: false,
            can_focus: false,
            style_class: 'xload-menu-item',
        });
        menuItem.add_child(box);
        this.menu.addMenuItem(menuItem);

        this._updateTopTextColor();

        this.menu.connect('open-state-changed', (menu, isOpen) => {
            if (isOpen) {
                this._updateTopOutput();
            }
        });
    }

    _updateTopTextColor() {
        const color = this._settings.get_string('top-text-color');
        this._topOutputLabel.set_style(`color: ${color};`);
    }

    _updateTopOutput() {
        try {
            const proc = Gio.Subprocess.new(
                ['top', '-b', '-n', '1', '-w', '120'],
                Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE
            );

            proc.communicate_utf8_async(null, null, (proc, result) => {
                if (!this.menu.isOpen)
                    return;

                try {
                    const [, stdout, stderr] = proc.communicate_utf8_finish(result);
                    if (stdout) {
                        const lines = stdout.split('\n');
                        const output = lines.slice(0, 17).join('\n');
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

    _startTimer() {
        if (this._timerId) {
            GLib.Source.remove(this._timerId);
            this._timerId = null;
        }

        const interval = this._settings.get_int('update-interval');
        this._timerId = GLib.timeout_add_seconds(
            GLib.PRIORITY_DEFAULT,
            interval,
            () => {
                this._updateLoad();
                return GLib.SOURCE_CONTINUE;
            }
        );
        this._updateLoad();
    }

    _updateLoad() {
        this._monitor.getLoadAverage().then(loads => {
            const load1m = loads[0];
            this._label.set_text(load1m.toFixed(2));
            this._graph.addDataPoint(load1m);
        }).catch(e => {
            console.error('XLoad:', e);
        });

        if (this.menu.isOpen)
            this._updateTopOutput();
    }

    _onSettingsChanged(settings, key) {
        this._graph.updateSettings();

        if (key === 'update-interval')
            this._restartTimer();

        if (key === 'top-text-color')
            this._updateTopTextColor();
    }

    _restartTimer() {
        this._startTimer();
    }

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
 * XLoadExtension - Main extension class that manages the lifecycle
 */
export default class XLoadExtension extends Extension {
    enable() {
        this._button = new XLoadButton(this);
        Main.panel.addToStatusArea('xload-indicator', this._button);
    }

    disable() {
        if (this._button) {
            this._button.destroy();
            this._button = null;
        }
    }
}
