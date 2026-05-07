import { createClient } from '@/lib/supabase/server';

export type Profile = {
  id: string;
  full_name: string | null;
  plan_id: string;
  is_admin: boolean;
  effective_plan_id: string; // 'enterprise' for admins regardless of plan_id
};

/** Fetch the current user's profile and resolve effective plan (admins = enterprise). */
export async function getProfile(): Promise<Profile | null> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from('profiles')
    .select('id, full_name, plan_id, is_admin')
    .eq('id', user.id)
    .single();

  if (!data) return null;

  return {
    ...data,
    is_admin: data.is_admin ?? false,
    effective_plan_id: data.is_admin ? 'enterprise' : (data.plan_id ?? 'free'),
  };
}
