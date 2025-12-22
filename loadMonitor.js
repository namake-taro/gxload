import Gio from 'gi://Gio';

/**
 * LoadMonitor - /proc/loadavg からロードアベレージを読み取るクラス
 */
export class LoadMonitor {
    constructor() {
        this._file = Gio.File.new_for_path('/proc/loadavg');
    }

    /**
     * ロードアベレージを非同期で取得
     * @returns {Promise<number[]>} [1分平均, 5分平均, 15分平均]
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

                    // [0]: 1分平均, [1]: 5分平均, [2]: 15分平均
                    // [3]: 実行中/総プロセス, [4]: 最後のPID
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
     * ロードアベレージを同期で取得
     * @returns {number[]} [1分平均, 5分平均, 15分平均]
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
