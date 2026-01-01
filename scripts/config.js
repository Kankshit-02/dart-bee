/**
 * Dart Bee - Configuration
 * Supabase credentials for dart-bee project
 *
 * NOTE: This file is COMMITTED to the repository
 * It contains only the PUBLIC anon key which is safe to expose
 * The anon key only has permissions granted by Row Level Security policies
 */

const AppConfig = {
    supabase: {
        // Your Supabase project URL
        url: 'https://hdiesaupdtjtazkxtylt.supabase.co',

        // Your Supabase anonymous (publishable) key
        // This is safe to use on the client-side (frontend)
        // It only has permissions granted by RLS policies
        anonKey: 'sb_publishable_6y9PlIYK4zl_ry2Cmm79Hw_BE96CJSZ'
    }
};
