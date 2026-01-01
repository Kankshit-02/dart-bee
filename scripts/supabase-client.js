/**
 * Supabase Client Module
 * Initializes and manages Supabase connection
 */

const SupabaseClient = (() => {
    let supabaseInstance = null;
    let connectionStatus = 'disconnected';

    /**
     * Initialize Supabase client
     */
    function init() {
        try {
            if (typeof AppConfig === 'undefined') {
                console.error('Error: scripts/config.js not found!');
                console.error('Please follow the setup instructions in scripts/config.example.js');
                throw new Error('Configuration file missing');
            }

            const { url, anonKey } = AppConfig.supabase;

            if (!url || !anonKey || url.includes('YOUR_PROJECT')) {
                console.error('Error: Supabase credentials not configured!');
                console.error('Please update scripts/config.js with your Supabase project credentials');
                throw new Error('Supabase credentials not configured');
            }

            supabaseInstance = window.supabase.createClient(url, anonKey);
            connectionStatus = 'connected';

            console.log('✓ Supabase client initialized successfully');
            return true;
        } catch (error) {
            console.error('✗ Failed to initialize Supabase:', error.message);
            connectionStatus = 'error';
            return false;
        }
    }

    /**
     * Get Supabase client instance
     */
    function getClient() {
        if (!supabaseInstance) {
            throw new Error('Supabase client not initialized. Call SupabaseClient.init() first.');
        }
        return supabaseInstance;
    }

    /**
     * Check if connected to Supabase
     */
    function isConnected() {
        return connectionStatus === 'connected' && supabaseInstance !== null;
    }

    /**
     * Get connection status
     */
    function getStatus() {
        return connectionStatus;
    }

    /**
     * Test connection to Supabase
     */
    async function testConnection() {
        try {
            const { data, error } = await getClient()
                .from('games')
                .select('id')
                .limit(1);

            if (error) {
                console.error('Connection test failed:', error);
                connectionStatus = 'error';
                return false;
            }

            connectionStatus = 'connected';
            console.log('✓ Supabase connection verified');
            return true;
        } catch (error) {
            console.error('Connection test error:', error);
            connectionStatus = 'error';
            return false;
        }
    }

    /**
     * Unsubscribe from a channel
     */
    function unsubscribe(channel) {
        if (supabaseInstance && channel) {
            supabaseInstance.removeChannel(channel);
        }
    }

    // Public API
    return {
        init,
        getClient,
        isConnected,
        getStatus,
        testConnection,
        unsubscribe
    };
})();

/**
 * Initialize Supabase immediately after config is loaded
 * This runs before other scripts that need the client
 */
if (typeof AppConfig !== 'undefined') {
    SupabaseClient.init();
} else {
    // Fallback: try during DOMContentLoaded if config wasn't loaded yet
    document.addEventListener('DOMContentLoaded', () => {
        if (typeof AppConfig !== 'undefined' && !SupabaseClient.isConnected()) {
            SupabaseClient.init();
        }
    });
}
