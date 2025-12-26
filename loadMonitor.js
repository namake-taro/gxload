import Gio from 'gi://Gio';

/**
 * LoadMonitor - Reads load average from /proc/loadavg
 */
export class LoadMonitor {
    constructor() {
        this._file = Gio.File.new_for_path('/proc/loadavg');
    }

    /**
     * Get load average asynchronously
     * @returns {Promise<number[]>} [1min, 5min, 15min] averages
     */
    getLoadAverage() {
        return new Promise((resolve, reject) => {
            this._file.load_contents_async(null, (file, res) => {
                try {
                    const [success, contents] = file.load_contents_finish(res);
                    if (!success) {
                        reject(new Error('Failed to read /proc/loadavg'));
                        return;
                    }

                    const decoder = new TextDecoder('utf-8');
                    const text = decoder.decode(contents).trim();
                    const parts = text.split(/\s+/);

                    const loads = [
                        parseFloat(parts[0]),
                        parseFloat(parts[1]),
                        parseFloat(parts[2]),
                    ];

                    resolve(loads);
                } catch (e) {
                    reject(e);
                }
            });
        });
    }

    /**
     * Get load average synchronously
     * @returns {number[]} [1min, 5min, 15min] averages
     */
    getLoadAverageSync() {
        try {
            const [success, contents] = this._file.load_contents(null);
            if (!success)
                return [0, 0, 0];

            const decoder = new TextDecoder('utf-8');
            const text = decoder.decode(contents).trim();
            const parts = text.split(/\s+/);

            return [
                parseFloat(parts[0]),
                parseFloat(parts[1]),
                parseFloat(parts[2]),
            ];
        } catch (e) {
            console.error('XLoad: Failed to read load average:', e);
            return [0, 0, 0];
        }
    }
}
