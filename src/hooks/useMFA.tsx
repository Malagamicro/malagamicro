import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

interface MFAFactor {
  id: string;
  friendly_name?: string;
  factor_type: 'totp';
  status: 'verified' | 'unverified';
  created_at: string;
  updated_at: string;
}

export function useMFA() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [factors, setFactors] = useState<MFAFactor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isUnenrolling, setIsUnenrolling] = useState(false);
  const [enrollmentData, setEnrollmentData] = useState<{
    id: string;
    qrCode: string;
    secret: string;
  } | null>(null);

  const fetchFactors = async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) throw error;
      setFactors(data.totp || []);
    } catch (error) {
      console.error('Error fetching MFA factors:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchFactors();
  }, [user]);

  const startEnrollment = async () => {
    setIsEnrolling(true);
    try {
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: 'Authenticator App',
      });
      
      if (error) throw error;
      
      setEnrollmentData({
        id: data.id,
        qrCode: data.totp.qr_code,
        secret: data.totp.secret,
      });
      
      return { error: null };
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'No se pudo iniciar la configuración de 2FA.',
        variant: 'destructive',
      });
      return { error };
    } finally {
      setIsEnrolling(false);
    }
  };

  const verifyEnrollment = async (code: string) => {
    if (!enrollmentData) return { error: new Error('No enrollment in progress') };
    
    setIsVerifying(true);
    try {
      const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId: enrollmentData.id,
      });
      
      if (challengeError) throw challengeError;
      
      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: enrollmentData.id,
        challengeId: challengeData.id,
        code,
      });
      
      if (verifyError) throw verifyError;
      
      setEnrollmentData(null);
      await fetchFactors();
      
      toast({
        title: '2FA activado',
        description: 'La autenticación de dos factores se ha configurado correctamente.',
      });
      
      return { error: null };
    } catch (error: any) {
      toast({
        title: 'Código inválido',
        description: 'El código no es correcto. Inténtalo de nuevo.',
        variant: 'destructive',
      });
      return { error };
    } finally {
      setIsVerifying(false);
    }
  };

  const cancelEnrollment = () => {
    setEnrollmentData(null);
  };

  const unenroll = async (factorId: string) => {
    setIsUnenrolling(true);
    try {
      const { error } = await supabase.auth.mfa.unenroll({
        factorId,
      });
      
      if (error) throw error;
      
      await fetchFactors();
      
      toast({
        title: '2FA desactivado',
        description: 'La autenticación de dos factores se ha desactivado.',
      });
      
      return { error: null };
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'No se pudo desactivar 2FA.',
        variant: 'destructive',
      });
      return { error };
    } finally {
      setIsUnenrolling(false);
    }
  };

  const verifiedFactors = factors.filter(f => f.status === 'verified');
  const isEnabled = verifiedFactors.length > 0;

  return {
    factors,
    verifiedFactors,
    isEnabled,
    isLoading,
    isEnrolling,
    isVerifying,
    isUnenrolling,
    enrollmentData,
    startEnrollment,
    verifyEnrollment,
    cancelEnrollment,
    unenroll,
    refetch: fetchFactors,
  };
}
