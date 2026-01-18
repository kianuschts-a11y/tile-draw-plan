import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  companyId: string | null;
  companyName: string | null;
  loading: boolean;
  signUp: (email: string, password: string, companyName: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchCompanyInfo = async (userId: string) => {
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('user_id', userId)
        .maybeSingle();

      if (profile?.company_id) {
        setCompanyId(profile.company_id);
        
        const { data: company } = await supabase
          .from('companies')
          .select('name')
          .eq('id', profile.company_id)
          .maybeSingle();
        
        if (company) {
          setCompanyName(company.name);
        }
      }
    } catch (error) {
      console.error('Error fetching company info:', error);
    }
  };

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          // Defer Supabase calls with setTimeout
          setTimeout(() => {
            fetchCompanyInfo(session.user.id);
          }, 0);
        } else {
          setCompanyId(null);
          setCompanyName(null);
        }
        
        setLoading(false);
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        fetchCompanyInfo(session.user.id);
      }
      
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string, companyName: string) => {
    try {
      const redirectUrl = `${window.location.origin}/`;
      
      // First create the company
      const { data: newCompany, error: companyError } = await supabase
        .from('companies')
        .insert({ name: companyName })
        .select()
        .single();

      if (companyError) {
        return { error: new Error(companyError.message) };
      }

      // Then sign up the user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl
        }
      });

      if (authError) {
        // Clean up company if auth fails
        await supabase.from('companies').delete().eq('id', newCompany.id);
        return { error: new Error(authError.message) };
      }

      if (authData.user) {
        // Create profile linking user to company
        const { error: profileError } = await supabase
          .from('profiles')
          .insert({
            user_id: authData.user.id,
            company_id: newCompany.id,
            email: email
          });

        if (profileError) {
          console.error('Profile creation error:', profileError);
          return { error: new Error(profileError.message) };
        }
      }

      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    
    if (error) {
      return { error: new Error(error.message) };
    }
    
    return { error: null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setCompanyId(null);
    setCompanyName(null);
  };

  return (
    <AuthContext.Provider value={{
      user,
      session,
      companyId,
      companyName,
      loading,
      signUp,
      signIn,
      signOut
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
