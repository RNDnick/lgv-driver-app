import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = 'https://qobuzkmdwjppfgyahuib.supabase.co';
const SUPABASE_KEY = 'sb_publishable_vyVXNVZTTXTxi5k88XA1WA_FclFslx8';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
