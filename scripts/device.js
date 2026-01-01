/**
 * Device Manager Module
 * Manages unique device ID for distinguishing active game owners from spectators
 */

const Device = (() => {
    const DEVICE_ID_KEY = 'dart_bee_device_id';

    /**
     * Generate a unique device ID (UUID v4)
     */
    function generateDeviceId() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    /**
     * Get or create device ID
     */
    function getDeviceId() {
        let deviceId = localStorage.getItem(DEVICE_ID_KEY);

        if (!deviceId) {
            deviceId = generateDeviceId();
            localStorage.setItem(DEVICE_ID_KEY, deviceId);
            console.log('Generated new device ID:', deviceId);
        } else {
            console.log('Using existing device ID:', deviceId);
        }

        return deviceId;
    }

    /**
     * Check if current device owns the game
     */
    function isGameOwner(gameDeviceId) {
        const currentDeviceId = getDeviceId();
        return currentDeviceId === gameDeviceId;
    }

    /**
     * Get current device ID (ensures it's initialized)
     */
    function init() {
        return getDeviceId();
    }

    return {
        init,
        getDeviceId,
        isGameOwner
    };
})();

// Initialize device ID on load
console.log('Device ID:', Device.init());
