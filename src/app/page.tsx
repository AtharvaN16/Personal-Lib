import { createClient } from '@/lib/supabase/server';
import Dashboard from '@/components/Dashboard';

export default async function Home() {
  const supabase = await createClient();
  
  // Verify user session in background
  await supabase.auth.getUser();

  return <Dashboard />;
}
