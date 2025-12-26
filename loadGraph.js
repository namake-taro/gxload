import GObject from 'gi://GObject';
import St from 'gi://St';

/**
 * LoadGraph - Graph drawing component using St.DrawingArea and Cairo
 */
export const LoadGraph = GObject.registerClass({
    GTypeName: 'XLoadGraph',
}, class LoadGraph extends St.DrawingArea {
    _init(settings) {
        const graphWidth = settings.get_int('graph-width');

        super._init({
            width: graphWidth,
            height: 22,
            style_class: 'xload-graph',
        });

        this._settings = settings;
        this._dataPoints = [];
        this._maxDataPoints = graphWidth;
        this._maxLoad = settings.get_double('max-load');

        this.connect('repaint', this._onRepaint.bind(this));
    }

    /**
     * Add a new data point to the graph
     * @param {number} value - Load average value
     */
    addDataPoint(value) {
        this._dataPoints.push(value);

        if (this._dataPoints.length > this._maxDataPoints)
            this._dataPoints.shift();

        if (this._settings.get_boolean('auto-scale')) {
            const maxValue = Math.max(...this._dataPoints);
            this._maxLoad = Math.max(maxValue * 1.2, 1.0);
        }

        this.queue_repaint();
    }

    _onRepaint(area) {
        const cr = area.get_context();
        const [width, height] = area.get_surface_size();

        const bgColor = this._parseColor(
            this._settings.get_string('background-color')
        );
        cr.setSourceRGBA(bgColor.r, bgColor.g, bgColor.b, bgColor.a);
        cr.rectangle(0, 0, width, height);
        cr.fill();

        if (this._dataPoints.length < 2) {
            cr.$dispose();
            return;
        }

        const graphType = this._settings.get_string('graph-type');
        if (graphType === 'line')
            this._drawLineGraph(cr, width, height);
        else
            this._drawBarGraph(cr, width, height);

        cr.$dispose();
    }

    _drawLineGraph(cr, width, height) {
        const fgColor = this._parseColor(
            this._settings.get_string('foreground-color')
        );

        const pointWidth = width / (this._maxDataPoints - 1);
        const startIndex = this._maxDataPoints - this._dataPoints.length;

        if (this._settings.get_boolean('fill-graph')) {
            const startX = startIndex * pointWidth;
            const startY = height - (this._dataPoints[0] / this._maxLoad) * height;

            cr.moveTo(startX, height);
            cr.lineTo(startX, Math.max(0, Math.min(startY, height)));

            for (let i = 1; i < this._dataPoints.length; i++) {
                const x = (startIndex + i) * pointWidth;
                const y = height - (this._dataPoints[i] / this._maxLoad) * height;
                cr.lineTo(x, Math.max(0, Math.min(y, height)));
            }

            const lastX = (startIndex + this._dataPoints.length - 1) * pointWidth;
            cr.lineTo(lastX, height);
            cr.closePath();

            cr.setSourceRGBA(fgColor.r, fgColor.g, fgColor.b, fgColor.a * 0.3);
            cr.fill();
        }

        cr.setSourceRGBA(fgColor.r, fgColor.g, fgColor.b, fgColor.a);
        cr.setLineWidth(1.5);

        const startX = startIndex * pointWidth;
        const startY = height - (this._dataPoints[0] / this._maxLoad) * height;
        cr.moveTo(startX, Math.max(0, Math.min(startY, height)));

        for (let i = 1; i < this._dataPoints.length; i++) {
            const x = (startIndex + i) * pointWidth;
            const y = height - (this._dataPoints[i] / this._maxLoad) * height;
            cr.lineTo(x, Math.max(0, Math.min(y, height)));
        }

        cr.stroke();
    }

    _drawBarGraph(cr, width, height) {
        const fgColor = this._parseColor(
            this._settings.get_string('foreground-color')
        );

        const barWidth = width / this._maxDataPoints;
        const startIndex = this._maxDataPoints - this._dataPoints.length;

        cr.setSourceRGBA(fgColor.r, fgColor.g, fgColor.b, fgColor.a);

        for (let i = 0; i < this._dataPoints.length; i++) {
            const x = (startIndex + i) * barWidth;
            const barHeight = (this._dataPoints[i] / this._maxLoad) * height;
            const y = height - barHeight;

            cr.rectangle(x, y, Math.max(barWidth - 1, 1), barHeight);
        }

        cr.fill();
    }

    /**
     * Parse color string to RGBA object
     * @param {string} colorString - 'rgba(r,g,b,a)' or '#RRGGBB' format
     * @returns {{r: number, g: number, b: number, a: number}}
     */
    _parseColor(colorString) {
        if (colorString.startsWith('rgba')) {
            const match = colorString.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,?\s*([\d.]+)?\s*\)/);
            if (match) {
                return {
                    r: parseInt(match[1]) / 255,
                    g: parseInt(match[2]) / 255,
                    b: parseInt(match[3]) / 255,
                    a: match[4] ? parseFloat(match[4]) : 1.0,
                };
            }
        } else if (colorString.startsWith('#')) {
            const hex = colorString.slice(1);
            return {
                r: parseInt(hex.slice(0, 2), 16) / 255,
                g: parseInt(hex.slice(2, 4), 16) / 255,
                b: parseInt(hex.slice(4, 6), 16) / 255,
                a: 1.0,
            };
        }
        return {r: 0.3, g: 0.69, b: 0.31, a: 1.0};
    }

    updateSettings() {
        this._maxDataPoints = this._settings.get_int('graph-width');
        this._maxLoad = this._settings.get_double('max-load');
        this.set_width(this._maxDataPoints);
        this.queue_repaint();
    }

    clearData() {
        this._dataPoints = [];
        this.queue_repaint();
    }
});
