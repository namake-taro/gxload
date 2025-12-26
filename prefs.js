import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';

import {ExtensionPreferences, gettext as _} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

/**
 * XLoadPreferences - Preferences window for the extension
 */
export default class XLoadPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();

        const page = new Adw.PreferencesPage({
            title: _('General'),
            icon_name: 'preferences-system-symbolic',
        });
        window.add(page);

        const displayGroup = new Adw.PreferencesGroup({
            title: _('Display Settings'),
        });
        page.add(displayGroup);

        const intervalRow = new Adw.SpinRow({
            title: _('Update Interval'),
            subtitle: _('Seconds between updates'),
            adjustment: new Gtk.Adjustment({
                lower: 1,
                upper: 60,
                step_increment: 1,
                value: settings.get_int('update-interval'),
            }),
        });
        intervalRow.connect('notify::value', () => {
            settings.set_int('update-interval', intervalRow.get_value());
        });
        displayGroup.add(intervalRow);

        const widthRow = new Adw.SpinRow({
            title: _('Graph Width'),
            subtitle: _('Width in pixels'),
            adjustment: new Gtk.Adjustment({
                lower: 20,
                upper: 200,
                step_increment: 10,
                value: settings.get_int('graph-width'),
            }),
        });
        widthRow.connect('notify::value', () => {
            settings.set_int('graph-width', widthRow.get_value());
        });
        displayGroup.add(widthRow);

        const typeRow = new Adw.ComboRow({
            title: _('Graph Type'),
            subtitle: _('Style of the graph'),
        });
        const typeModel = new Gtk.StringList();
        typeModel.append(_('Line'));
        typeModel.append(_('Bar'));
        typeRow.set_model(typeModel);
        typeRow.set_selected(settings.get_string('graph-type') === 'bar' ? 1 : 0);
        typeRow.connect('notify::selected', () => {
            settings.set_string('graph-type',
                typeRow.get_selected() === 0 ? 'line' : 'bar');
        });
        displayGroup.add(typeRow);

        const maxLoadRow = new Adw.SpinRow({
            title: _('Max Load Value'),
            subtitle: _('Maximum value for graph scale'),
            adjustment: new Gtk.Adjustment({
                lower: 1.0,
                upper: 100.0,
                step_increment: 1.0,
                value: settings.get_double('max-load'),
            }),
        });
        maxLoadRow.connect('notify::value', () => {
            settings.set_double('max-load', maxLoadRow.get_value());
        });
        displayGroup.add(maxLoadRow);

        const optionsGroup = new Adw.PreferencesGroup({
            title: _('Options'),
        });
        page.add(optionsGroup);

        const autoScaleRow = new Adw.SwitchRow({
            title: _('Auto Scale'),
            subtitle: _('Automatically adjust graph scale'),
        });
        settings.bind('auto-scale', autoScaleRow, 'active',
            Gio.SettingsBindFlags.DEFAULT);
        optionsGroup.add(autoScaleRow);

        const fillRow = new Adw.SwitchRow({
            title: _('Fill Graph'),
            subtitle: _('Fill area under the line'),
        });
        settings.bind('fill-graph', fillRow, 'active',
            Gio.SettingsBindFlags.DEFAULT);
        optionsGroup.add(fillRow);

        const colorGroup = new Adw.PreferencesGroup({
            title: _('Colors'),
        });
        page.add(colorGroup);

        const fgColorRow = new Adw.EntryRow({
            title: _('Foreground Color'),
        });
        fgColorRow.set_text(settings.get_string('foreground-color'));
        fgColorRow.connect('changed', () => {
            settings.set_string('foreground-color', fgColorRow.get_text());
        });
        colorGroup.add(fgColorRow);

        const bgColorRow = new Adw.EntryRow({
            title: _('Background Color'),
        });
        bgColorRow.set_text(settings.get_string('background-color'));
        bgColorRow.connect('changed', () => {
            settings.set_string('background-color', bgColorRow.get_text());
        });
        colorGroup.add(bgColorRow);

        const topTextColorRow = new Adw.EntryRow({
            title: _('Top Output Text Color'),
        });
        topTextColorRow.set_text(settings.get_string('top-text-color'));
        topTextColorRow.connect('changed', () => {
            settings.set_string('top-text-color', topTextColorRow.get_text());
        });
        colorGroup.add(topTextColorRow);
    }
}
